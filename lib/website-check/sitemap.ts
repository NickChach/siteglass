import "server-only";

import { createPostUrlCheck } from "./post-urls";
import type { PostUrlScan } from "./post-urls";
import { parseSitemap } from "./sitemap-xml";
import { parseWebsiteUrl } from "./url";

const MAX_SITEMAP_FILES = 8;

type SitemapReaders = {
	getRobots(url: URL): Promise<string>;
	getSitemap(url: URL): Promise<{ url: URL; body: string }>;
};

function isPostSitemap(url: URL): boolean {
	return /\/(?:wp-sitemap-posts-post-\d+|post-sitemap\d*)\.xml(?:\.gz)?$/i.test(url.pathname) ||
		(url.searchParams.get("sitemap") === "posts" && url.searchParams.get("sitemap-subtype") === "post");
}

export async function checkPostSitemaps(
	home: URL,
	signal: AbortSignal,
	{ getRobots, getSitemap }: SitemapReaders,
): Promise<PostUrlScan | undefined> {
	const advertised = new Set<string>();
	let incomplete = false;
	try {
		const robots = await getRobots(new URL("/robots.txt", home));
		for (const [, value] of robots.matchAll(/^[ \t]*Sitemap:[ \t]*(\S+)/gim)) {
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
	for (const path of ["/wp-sitemap.xml", "/sitemap_index.xml", "/sitemap.xml", "/?sitemap=index"]) {
		candidates.add(new URL(path, home).href);
	}

	const check = createPostUrlCheck(home, "post-sitemap");
	const visited = new Set<string>();
	let filesRead = 0;
	async function readSitemap(url: URL) {
		if (signal.aborted || visited.size >= MAX_SITEMAP_FILES || visited.has(url.href)) return;
		visited.add(url.href);
		try {
			const response = await getSitemap(url);
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
