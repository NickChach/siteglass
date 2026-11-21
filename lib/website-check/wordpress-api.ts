import { JSON_MEDIA_TYPE } from "./json-response";
import { createPostUrlCheck } from "./post-urls";
import type { PostUrlScan } from "./post-urls";
import { isWithinSite, parseWebsiteUrl } from "./url";

const POSTS_PER_PAGE = 100;
const MAX_POST_PAGES = 10;
const POST_ROUTE = "/wp/v2/posts";
export const MAX_RESPONSE_BYTES = 1024 * 1024;

type JsonPage = {
	url: URL;
	status: number;
	mediaType: string;
	body: string;
	totalPages: string | null;
};

export type GetJsonPage = (url: URL, signal: AbortSignal) => Promise<JsonPage>;

export type WordPressApi = {
	index: URL;
	home: URL;
};

function apiCandidates(page: URL, discovered?: URL): URL[] {
	const candidates = new Set<string>();
	if (discovered?.origin === page.origin) candidates.add(discovered.href);

	const firstSegment = page.pathname.split("/")[1];
	const bases = new Set([page.pathname.slice(0, page.pathname.lastIndexOf("/") + 1)]);
	if (firstSegment) bases.add(`/${firstSegment}/`);
	bases.add("/");
	for (const base of bases) {
		const root = new URL(page.origin);
		root.pathname = base + "wp-json/";
		candidates.add(root.href);
		root.pathname = base;
		root.search = "?rest_route=/";
		candidates.add(root.href);
	}
	return [...candidates].map((url) => new URL(url));
}

function jsonFrom(page: JsonPage): unknown {
	if (page.mediaType !== JSON_MEDIA_TYPE) return;
	try {
		return JSON.parse(page.body);
	} catch {
		return;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function findWordPressApi(
	page: URL,
	getJson: GetJsonPage,
	signal: AbortSignal,
	discovered?: URL,
	attempted = new Set<string>(),
): Promise<WordPressApi | undefined> {
	for (const candidate of apiCandidates(page, discovered)) {
		if (signal.aborted) break;
		if (attempted.has(candidate.href)) continue;
		attempted.add(candidate.href);

		try {
			const response = await getJson(candidate, signal);
			if (response.status < 200 || response.status >= 300 || response.url.origin !== page.origin) continue;
			const index = jsonFrom(response);
			if (!isRecord(index) || !Array.isArray(index.namespaces) || !index.namespaces.includes("wp/v2") ||
				!isRecord(index.routes) || !Object.keys(index.routes).some((route) => route.startsWith("/wp/v2/")) ||
				typeof index.home !== "string") continue;
			const home = parseWebsiteUrl(index.home);
			if (!home || !isWithinSite(page, home)) continue;
			home.search = "";
			return { index: response.url, home };
		} catch {
			// Another discovery route may be available.
		}
	}
}

function postsUrl(index: URL, page: number): URL {
	const url = new URL(index);
	if (url.searchParams.has("rest_route")) {
		url.search = "";
		url.searchParams.set("rest_route", POST_ROUTE);
	} else {
		url.search = "";
		url.pathname = url.pathname.replace(/\/$/, "") + POST_ROUTE;
	}
	url.searchParams.set("_fields", "link");
	url.searchParams.set("per_page", String(POSTS_PER_PAGE));
	url.searchParams.set("page", String(page));
	return url;
}

export async function checkApiPostUrls(api: WordPressApi, getJson: GetJsonPage, signal: AbortSignal): Promise<PostUrlScan | undefined> {
	const check = createPostUrlCheck(api.home, "wordpress-api");
	let pagesRead = 0;
	for (let page = 1; page <= MAX_POST_PAGES && !signal.aborted; page++) {
		try {
			const response = await getJson(postsUrl(api.index, page), signal);
			if (response.url.origin !== api.index.origin) break;
			const posts = jsonFrom(response);
			if (pagesRead && response.status === 400 && isRecord(posts) && posts.code === "rest_post_invalid_page_number") {
				return check.result(false);
			}
			if (response.status < 200 || response.status >= 300 || !Array.isArray(posts) || posts.length > POSTS_PER_PAGE) break;
			pagesRead++;
			for (const post of posts) check.add(isRecord(post) ? post.link : undefined);

			const totalPages = Number(response.totalPages);
			const hasTotal = response.totalPages !== null && /^\d+$/.test(response.totalPages) && Number.isSafeInteger(totalPages);
			if (hasTotal ? page >= totalPages : posts.length < POSTS_PER_PAGE) return check.result(false);
		} catch {
			break;
		}
	}
	return pagesRead ? check.result(true) : undefined;
}
