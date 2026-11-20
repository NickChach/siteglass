import { parse } from "parse5";
import { getPublicPage, parseWebsiteUrl } from "./public-website";
import type { PublicPage } from "./public-website";

const SCAN_TIMEOUT_MS = 8_000;
const REST_RELATION = "https://api.w.org/";
const linkHeaderEntry = /(?:^|,)\s*<([^<>\s]+)>((?:[^",<]|"(?:[^"\\]|\\.)*")*)/g;
const linkHeaderParameter = /;\s*([^=;\s]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^"\s;,]+))/g;

type WordPressEvidence =
	| "rest-api"
	| "rest-discovery"
	| "generator"
	| "core-assets"
	| "theme-or-plugin-assets"
	| "uploads";

export type WebsiteCheckResult =
	| {
		status: "detected" | "likely" | "not-detected";
		evidence: WordPressEvidence[];
	}
	| {
		status: "could-not-check";
		reason: "invalid-url" | "rate-limited" | "page-unavailable";
	};

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

function inspectPage(page: PublicPage) {
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

function restCandidates(page: URL, discovered?: URL): URL[] {
	const candidates = new Set<string>();
	if (discovered) candidates.add(discovered.href);

	const firstSegment = page.pathname.split("/")[1];
	const bases = firstSegment ? ["/" + firstSegment + "/", "/"] : ["/"];
	for (const base of bases) {
		candidates.add(new URL(base + "wp-json/", page).href);
		candidates.add(new URL(base + "?rest_route=/", page).href);
	}

	return Array.from(candidates, (candidate) => new URL(candidate));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function matchesRestIndex(response: PublicPage, page: URL): boolean {
	if (response.status < 200 || response.status >= 300 || response.mediaType !== "application/json") {
		return false;
	}

	let index: unknown;
	try {
		index = JSON.parse(response.body);
	} catch {
		return false;
	}

	if (!isRecord(index) || !Array.isArray(index.namespaces) || !index.namespaces.includes("wp/v2") ||
		!isRecord(index.routes) || typeof index.home !== "string" ||
		!Object.keys(index.routes).some((route) => route.startsWith("/wp/v2/"))) {
		return false;
	}

	const home = parseWebsiteUrl(index.home);
	if (!home || home.host !== page.host) return false;

	const homePath = home.pathname.replace(/\/$/, "");
	return page.pathname === homePath || page.pathname.startsWith(homePath + "/");
}

export async function detectWordPress(
	address: URL,
	getPage: typeof getPublicPage = getPublicPage,
): Promise<WebsiteCheckResult> {
	const signal = AbortSignal.timeout(SCAN_TIMEOUT_MS);
	let page: PublicPage;
	try {
		page = await getPage(address, signal);
	} catch {
		return { status: "could-not-check", reason: "page-unavailable" };
	}

	if (page.status < 200 || page.status >= 300 || !page.body.trim() ||
		!["text/html", "application/xhtml+xml"].includes(page.mediaType)) {
		return { status: "could-not-check", reason: "page-unavailable" };
	}

	const { restEndpoint, evidence } = inspectPage(page);
	for (const endpoint of restCandidates(page.url, restEndpoint)) {
		if (signal.aborted) break;

		try {
			const response = await getPage(endpoint, signal, page.url.origin);
			if (matchesRestIndex(response, page.url)) {
				evidence.add("rest-api");
				return { status: "detected", evidence: Array.from(evidence) };
			}
		} catch {
			// A blocked or unavailable REST endpoint does not erase evidence from the page.
		}
	}

	const supportingSignals = Array.from(evidence).filter((signal) => signal !== "uploads");
	return { status: supportingSignals.length >= 2 ? "likely" : "not-detected", evidence: Array.from(evidence) };
}
