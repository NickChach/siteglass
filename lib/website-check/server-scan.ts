import "server-only";

import { getPublicPage } from "./public-website";
import type { WebsiteCheckResult } from "./post-urls";
import { checkPostSitemaps } from "./sitemap";
import { detectWordPress } from "./wordpress";
import { checkApiPostUrls, isReadableWordPressJsonStatus, WORDPRESS_TOTAL_PAGES_HEADER } from "./wordpress-api";
import type { GetJsonPage } from "./wordpress-api";

const SCAN_TIMEOUT_MS = 12_000;
const MAX_REQUESTS = 26;

export async function scanWebsiteOnServer(address: URL): Promise<WebsiteCheckResult> {
	const signal = AbortSignal.timeout(SCAN_TIMEOUT_MS);
	let requests = 0;
	const getPage: typeof getPublicPage = (url, scanSignal, options) => getPublicPage(url, scanSignal, {
		...options,
		takeRequest() {
			if (requests >= MAX_REQUESTS) throw new Error("Website scan exceeded its request budget");
			requests++;
		},
	});
	const getJson: GetJsonPage = async (url, scanSignal) => {
		const page = await getPage(url, scanSignal, {
			format: "json",
			allowedOrigin: url.origin,
			acceptBodyStatus: isReadableWordPressJsonStatus,
		});
		const totalPages = page.headers[WORDPRESS_TOTAL_PAGES_HEADER];
		return {
			url: page.url,
			status: page.status,
			mediaType: page.mediaType,
			body: page.body,
			totalPages: typeof totalPages === "string" ? totalPages : null,
		};
	};
	const site = await detectWordPress(
		address,
		signal,
		getJson,
		async (url, scanSignal) => {
			const page = await getPage(url, scanSignal, { format: "html" });
			const link = page.headers.link;
			return { url: page.url, body: page.body, link: Array.isArray(link) ? link.join(", ") : link };
		},
		async (url, scanSignal) => {
			const page = await getPage(url, scanSignal, {
				format: "html", allowedOrigin: url.origin, redirect: "manual", headersOnly: true,
			});
			return { status: page.status, location: page.headers.location };
		},
	);
	if (!site) return { status: "could-not-check", reason: "wordpress-unconfirmed" };
	const apiResult = site.api && await checkApiPostUrls(site.api, getJson, signal);
	if (apiResult) return apiResult;
	const allowedOrigin = site.home.origin;
	return await checkPostSitemaps(site.home, signal, {
		async getRobots(url) {
			const page = await getPage(url, signal, { format: "robots", allowedOrigin });
			return page.body;
		},
		getSitemap: (url) => getPage(url, signal, { format: "sitemap", allowedOrigin }),
	}) ?? {
		status: "could-not-check", reason: "post-urls-unavailable",
	};
}
