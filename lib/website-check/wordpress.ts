import { parse } from "parse5";
import { parseWebsiteUrl } from "./url";
import { findWordPressApi } from "./wordpress-api";
import type { GetJsonPage, WordPressApi } from "./wordpress-api";

const REST_RELATION = "https://api.w.org/";
const DIRECT_API_TIMEOUT_MS = 3_500;
const adminRedirectStatuses = new Set([301, 302, 303, 307, 308]);
const linkHeaderEntry = /(?:^|,)\s*<([^<>\s]+)>((?:[^",<]|"(?:[^"\\]|\\.)*")*)/g;
const linkHeaderParameter = /;\s*([^=;\s]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^"\s;,]+))/g;

type WordPressEvidence =
	| "rest-discovery"
	| "generator"
	| "core-assets"
	| "theme-or-plugin-assets"
	| "uploads";

type WordPressSite = {
	home: URL;
	page: URL;
	api?: WordPressApi;
};

export type WordPressHtmlPage = {
	url: URL;
	body: string;
	link?: string;
};

type AdminPage = {
	status: number;
	location?: string;
};

type GetAdminPage = (url: URL, signal: AbortSignal) => Promise<AdminPage>;

function hasRestRelation(rel: string | undefined): boolean {
	return rel?.split(/\s+/).includes(REST_RELATION) ?? false;
}

function* restLinksFromHeader(header: string | undefined) {
	for (const [, href, params] of (header ?? "").matchAll(linkHeaderEntry)) {
		for (const [, key, quotedValue, value] of params.matchAll(linkHeaderParameter)) {
			if (key.toLowerCase() === "rel" && hasRestRelation(quotedValue ?? value)) {
				yield href;
				break;
			}
		}
	}
}

function inspectPage(page: WordPressHtmlPage) {
	const document = parse(page.body);
	const html = document.childNodes.find((node) => "tagName" in node && node.tagName === "html");
	const head = html && "childNodes" in html
		? html.childNodes.find((node) => "tagName" in node && node.tagName === "head")
		: undefined;
	const evidence = new Set<WordPressEvidence>();
	let base = page.url;
	let restEndpoint = Array.from(restLinksFromHeader(page.link), (href) => parseWebsiteUrl(href, page.url))
		.find((url) => url?.origin === page.url.origin);

	if (head && "childNodes" in head) {
		for (const node of head.childNodes) {
			if ("tagName" in node && node.tagName === "base") {
				const href = node.attrs.find((attribute) => attribute.name === "href")?.value;
				if (href === undefined) continue;
				base = parseWebsiteUrl(href, page.url) ?? page.url;
				break;
			}
		}

		for (const node of head.childNodes) {
			if (!("tagName" in node)) continue;

			const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
			if (node.tagName === "meta" && attrs.name?.toLowerCase() === "generator" &&
				/^wordpress(?:\s|$)/i.test(attrs.content?.trim() ?? "")) {
				evidence.add("generator");
			}
			if (!restEndpoint && node.tagName === "link" && hasRestRelation(attrs.rel) && attrs.href) {
				const url = parseWebsiteUrl(attrs.href, base);
				if (url?.origin === page.url.origin) restEndpoint = url;
			}
		}
	}

	if (restEndpoint) evidence.add("rest-discovery");

	const nodes = [...document.childNodes];
	while (nodes.length) {
		const node = nodes.pop();
		if (!node || !("tagName" in node)) continue;

		for (const child of node.childNodes) nodes.push(child);
		const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
		let asset: string | undefined;

		if (node.tagName === "script" || node.tagName === "img") asset = attrs.src;
		if (node.tagName === "link" &&
			/\b(?:stylesheet|preload|modulepreload)\b/i.test(attrs.rel ?? "")) asset = attrs.href;
		if (!asset) continue;

		const url = parseWebsiteUrl(asset, base);
		if (url?.origin !== page.url.origin) continue;

		if (/\/wp-includes\/.+/.test(url.pathname)) evidence.add("core-assets");
		if (/\/wp-content\/(?:themes|plugins)\/[^/]+\/.+/.test(url.pathname)) evidence.add("theme-or-plugin-assets");
		if (/\/wp-content\/uploads\/.+/.test(url.pathname)) evidence.add("uploads");
	}

	return { restEndpoint, evidence };
}

async function findWordPressAdmin(page: URL, signal: AbortSignal, getAdminPage: GetAdminPage): Promise<URL | undefined> {
	const bases = new Set<string>();
	const firstSegment = page.pathname.split("/")[1];
	if (firstSegment) bases.add(`/${firstSegment}/`);
	bases.add("/");

	for (const base of bases) {
		if (signal.aborted) break;
		const home = new URL(page.origin);
		home.pathname = base;
		const admin = new URL("wp-admin/", home);

		try {
			const response = await getAdminPage(admin, signal);
			if (!adminRedirectStatuses.has(response.status) || !response.location) continue;
			const login = parseWebsiteUrl(response.location, admin);
			if (login?.origin === home.origin && login.pathname === new URL("wp-login.php", home).pathname) return home;
		} catch {
			// An unavailable admin page is not evidence either way.
		}
	}
}

export async function detectWordPress(
	address: URL,
	signal: AbortSignal,
	getJson: GetJsonPage,
	getHtml: (url: URL, signal: AbortSignal) => Promise<WordPressHtmlPage>,
	getAdminPage: GetAdminPage,
): Promise<WordPressSite | undefined> {
	const attempted = new Set<string>();
	const directSignal = AbortSignal.any([signal, AbortSignal.timeout(DIRECT_API_TIMEOUT_MS)]);
	const directApi = await findWordPressApi(address, getJson, directSignal, undefined, attempted);
	if (directApi) return { api: directApi, home: directApi.home, page: address };

	let page: WordPressHtmlPage;
	try {
		page = await getHtml(address, signal);
	} catch {
		return;
	}

	if (signal.aborted) return;
	const inspection = page.body.trim() ? inspectPage(page) : undefined;
	const api = await findWordPressApi(page.url, getJson, signal, inspection?.restEndpoint, attempted);
	if (api) return { api, home: api.home, page: page.url };
	if (inspection) {
		const supportingSignals = [...inspection.evidence].filter((evidence) => evidence !== "uploads");
		if (supportingSignals.length >= 2) return { home: new URL(page.url.origin), page: page.url };
		if (supportingSignals.length === 1) {
			const home = await findWordPressAdmin(page.url, signal, getAdminPage);
			if (home) return { home, page: page.url };
		}
	}
}
