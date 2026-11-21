import "server-only";

import { getPublicPage } from "./public-website";
import type { WebsiteCheckResult } from "./post-urls";
import { checkPostSitemaps } from "./sitemap";
import { detectWordPress } from "./wordpress";
import { checkApiPostUrls } from "./wordpress-api";
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
	const getJson: GetJsonPage = (url, scanSignal) => getPage(url, scanSignal, { format: "json", allowedOrigin: url.origin });
	const site = await detectWordPress(address, signal, getJson, (url, scanSignal) => getPage(url, scanSignal, { format: "html" }));
	if (!site) return { status: "could-not-check", reason: "wordpress-unconfirmed" };
	const apiResult = site.api && await checkApiPostUrls(site.api, getJson, signal);
	if (apiResult) return apiResult;
	const allowedOrigin = site.home.origin;
	return await checkPostSitemaps(site.home, site.page, signal, {
		async getRobots(url) {
			const page = await getPage(url, signal, { format: "robots", allowedOrigin });
			return page.body;
		},
		getSitemap: (url) => getPage(url, signal, { format: "sitemap", allowedOrigin }),
	}) ?? {
		status: "could-not-check", reason: "post-urls-unavailable",
	};
}
