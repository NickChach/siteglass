import "server-only";

import { createPostUrlCheck } from "./post-urls";
import type { PostUrlScan } from "./post-urls";
import type { getPublicPage } from "./public-website";
import { parseSitemap } from "./sitemap-xml";
import { parseWebsiteUrl, sitePath } from "./url";

const MAX_SITEMAP_FILES = 8;

function isPostSitemap(url: URL): boolean {
	return /\/(?:wp-sitemap-posts-post-\d+|post-sitemap\d*)\.xml(?:\.gz)?$/i.test(url.pathname) ||
		(url.searchParams.get("sitemap") === "posts" && url.searchParams.get("sitemap-subtype") === "post");
}

export async function checkPostSitemaps(
	home: URL,
	page: URL,
	signal: AbortSignal,
	getPage: typeof getPublicPage,
): Promise<PostUrlScan | undefined> {
	const advertised = new Set<string>();
	let incomplete = false;
	try {
		const robots = await getPage(new URL("/robots.txt", home), signal, { format: "robots", allowedOrigin: home.origin });
		for (const [, value] of robots.body.matchAll(/^[ \t]*Sitemap:[ \t]*(\S+)/gim)) {
			const url = parseWebsiteUrl(value);
			if (!url || url.origin !== home.origin) {
				incomplete = true;
				continue;
			}
			if (advertised.has(url.href)) continue;
			if (advertised.size >= MAX_SITEMAP_FILES) {
				incomplete = true;
				break;
			}
			advertised.add(url.href);
		}
	} catch {
		// Conventional sitemap locations can still be checked.
	}

	const candidates = new Set(advertised);
	const bases = new Set<string>();
	const firstSegment = page.pathname.split("/")[1];
	if (!sitePath(home) && firstSegment) bases.add("/" + firstSegment);
	bases.add(sitePath(home));
	for (const base of bases) {
		for (const path of ["wp-sitemap.xml", "sitemap_index.xml", "sitemap.xml", "?sitemap=index"]) {
			const url = new URL(home.origin);
			url.pathname = base + "/";
			candidates.add(new URL(path, url).href);
		}
	}

	const check = createPostUrlCheck(home, "post-sitemap");
	const visited = new Set<string>();
	let filesRead = 0;
	async function readSitemap(url: URL) {
		if (signal.aborted || visited.size >= MAX_SITEMAP_FILES || visited.has(url.href)) return;
		visited.add(url.href);
		try {
			const response = await getPage(url, signal, { format: "sitemap", allowedOrigin: home.origin });
			const xml = parseSitemap(response.body);
			if (xml) return { ...xml, url: response.url };
		} catch {
			// Skip unavailable and malformed XML.
		}
	}

	for (const candidate of candidates) {
		if (filesRead && !advertised.has(candidate)) break;
		const url = new URL(candidate);
		if (visited.has(candidate)) continue;
		const root = await readSitemap(url);
		if (!root) {
			if (advertised.has(candidate) || isPostSitemap(url)) incomplete = true;
			continue;
		}
		if (root.type === "urls" && (isPostSitemap(root.url) || isPostSitemap(url))) {
			for (const location of root.locations) check.add(location);
			filesRead++;
			continue;
		}
		if (root.type !== "index") continue;
		for (const location of root.locations) {
			const child = parseWebsiteUrl(location);
			if (!child || !isPostSitemap(child) || visited.has(child.href)) continue;
			const sitemap = child.origin === home.origin ? await readSitemap(child) : undefined;
			if (sitemap?.type !== "urls") {
				incomplete = true;
				continue;
			}
			for (const post of sitemap.locations) check.add(post);
			filesRead++;
		}
	}
	return filesRead ? check.result(incomplete) : undefined;
}
