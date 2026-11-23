import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScanAddress } from "../lib/website-check/url";
import { detectWordPress } from "../lib/website-check/wordpress";
import type { WordPressHtmlPage } from "../lib/website-check/wordpress";
import { findWordPressApi } from "../lib/website-check/wordpress-api";
import type { GetJsonPage } from "../lib/website-check/wordpress-api";

const site = new URL("https://example.com/");
const theme = '<link rel="stylesheet" href="/wp-content/themes/example/style.css">';
const wordpressComPage = `<html><head><meta name="generator" content="WordPress.com">${theme}</head></html>`;

const unavailableApi: GetJsonPage = async (url) => ({
	url, status: 404, mediaType: "text/html", body: "", totalPages: null,
});

function htmlPage(url: URL, body: string): WordPressHtmlPage {
	return { url, body };
}

test("a WordPress login redirect corroborates a theme on a WordPress.com page", async () => {
	const requests: string[] = [];
	const result = await detectWordPress(site, new AbortController().signal, unavailableApi,
		async (url) => htmlPage(url, wordpressComPage),
		async (url) => {
			requests.push(url.href);
			return { status: 302, location: "/wp-login.php?redirect_to=%2Fwp-admin%2F" };
		},
	);

	assert.equal(result?.home.href, site.href);
	assert.deepEqual(requests, ["https://example.com/wp-admin/"]);
});

test("an admin redirect alone does not confirm WordPress", async () => {
	const result = await detectWordPress(site, new AbortController().signal, unavailableApi,
		async (url) => htmlPage(url, "<html><head></head></html>"),
		async () => ({ status: 302, location: "/wp-login.php" }),
	);

	assert.equal(result, undefined);
});

test("ordinary admin responses and unrelated redirects do not confirm WordPress", async () => {
	const responses = [
		{ status: 200, location: "/wp-login.php" },
		{ status: 403 },
		{ status: 404 },
		{ status: 302, location: "https://other.example/wp-login.php" },
		{ status: 302, location: "http://example.com/wp-login.php" },
		{ status: 302, location: "/wp-login.php/other" },
		{ status: 302, location: "/login?next=/wp-login.php" },
	];
	for (const response of responses) {
		const result = await detectWordPress(site, new AbortController().signal, unavailableApi,
			async (url) => htmlPage(url, wordpressComPage), async () => response,
		);
		assert.equal(result, undefined, JSON.stringify(response));
	}
});

test("an inaccessible admin page does not confirm WordPress", async () => {
	const result = await detectWordPress(site, new AbortController().signal, unavailableApi,
		async (url) => htmlPage(url, wordpressComPage),
		async () => { throw new Error("admin unavailable"); },
	);

	assert.equal(result, undefined);
});

test("submitted addresses select the domain root before browser or server discovery", () => {
	for (const [input, expected] of [
		["example.com/random-route", "https://example.com/"],
		["http://www.example.com/random-route", "http://example.com/"],
		["https://WWW.example.co.uk/blog/?page=2#post", "https://example.co.uk/"],
		["news.example.com/blog", "https://news.example.com/"],
	]) {
		assert.equal(parseScanAddress(input)?.href, expected);
	}
	assert.equal(parseScanAddress("https://user:password@www.example.com/post"), undefined);
	assert.equal(parseScanAddress("https://www.example.com:8443/post"), undefined);
});

test("a homepage redirect into a directory keeps API and admin discovery at the root", async () => {
	const landing = new URL("/en/", site);
	const requests: string[] = [];
	const result = await detectWordPress(site, new AbortController().signal,
		async (url, signal) => {
			requests.push(url.href);
			return unavailableApi(url, signal);
		},
		async (url) => {
			requests.push(url.href);
			return htmlPage(landing, wordpressComPage);
		},
		async (url) => {
			requests.push(url.href);
			return { status: 302, location: "/wp-login.php" };
		},
	);

	assert.equal(result?.home.href, site.href);
	assert.deepEqual(requests, ["/wp-json/", "/?rest_route=/", "/", "/wp-admin/"].map((path) => new URL(path, site).href));
});

test("an advertised API in a directory must identify the root as its site home", async () => {
	const page = new URL("/blog/", site);
	const endpoint = new URL("wp-json/", page);
	for (const home of [page, site]) {
		const api = await findWordPressApi(page, async (url, signal) => {
			if (url.href !== endpoint.href) return unavailableApi(url, signal);
			return {
				url, status: 200, mediaType: "application/json", totalPages: null,
				body: JSON.stringify({ home: home.href, namespaces: ["wp/v2"], routes: { "/wp/v2/posts": {} } }),
			};
		}, new AbortController().signal, endpoint);
		assert.equal(api?.home.href, home === site ? site.href : undefined);
	}
});

test("does not request the admin page when existing evidence confirms WordPress", async () => {
	let requested = false;
	const result = await detectWordPress(site, new AbortController().signal, unavailableApi,
		async (url) => htmlPage(url, `<html><head><meta name="generator" content="WordPress 6.8">${theme}</head></html>`),
		async () => {
			requested = true;
			return { status: 404 };
		},
	);

	assert.equal(result?.home.href, site.href);
	assert.equal(requested, false);
});
