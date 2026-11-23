import { matchPostPath, type MatchedTerm } from "./post-path";
import { isWithinSite, parseWebsiteUrl, sitePath } from "./url";

const MAX_REPORTED_MATCHES = 50;
export const MAX_POST_URLS = 1_000;

type PostUrlMatch = {
	url: string;
	terms: MatchedTerm[];
};

export type PostUrlScan = {
	status: "checked" | "partial";
	source: "wordpress-api" | "post-sitemap";
	site: string;
	urlsChecked: number;
	matchedUrls: number;
	matches: PostUrlMatch[];
};

export type WebsiteCheckResult = PostUrlScan | {
	status: "could-not-check";
	reason: "invalid-url" | "rate-limited" | "wordpress-unconfirmed" | "post-urls-unavailable";
};

export type WebsiteCheckOutcome = WebsiteCheckResult | {
	status: "could-not-check";
	reason: "scan-unavailable";
};

export function createPostUrlCheck(home: URL, source: PostUrlScan["source"]) {
	const checked = new Set<string>();
	const matches: PostUrlMatch[] = [];
	let matchedUrls = 0;
	let partial = false;

	return {
		add(value: unknown) {
			const url = typeof value === "string" ? parseWebsiteUrl(value) : undefined;
			if (!url || !isWithinSite(url, home)) {
				partial = true;
				return;
			}
			if (checked.has(url.href)) return;
			if (checked.size >= MAX_POST_URLS) {
				partial = true;
				return;
			}

			let path: string;
			try {
				path = decodeURIComponent(url.pathname.slice(sitePath(home).length));
			} catch {
				partial = true;
				return;
			}
			checked.add(url.href);
			const terms = matchPostPath(path);
			if (!terms.length) return;

			matchedUrls++;
			if (matches.length < MAX_REPORTED_MATCHES) matches.push({ url: url.href, terms });
		},
		result(incomplete: boolean): PostUrlScan {
			return {
				status: partial || incomplete ? "partial" : "checked",
				source,
				site: home.href,
				urlsChecked: checked.size,
				matchedUrls,
				matches,
			};
		},
	};
}
