import assert from "node:assert/strict";
import { test } from "node:test";
import { detectWordPress } from "../lib/website-check/wordpress";
import type { WordPressHtmlPage } from "../lib/website-check/wordpress";
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

test("recognizes an admin redirect for a WordPress installation in a subdirectory", async () => {
	const address = new URL("https://example.com/blog/a-post/");
	const requests: string[] = [];
	const result = await detectWordPress(address, new AbortController().signal, unavailableApi,
		async (url) => htmlPage(url, '<link rel="stylesheet" href="/blog/wp-content/themes/example/style.css">'),
		async (url) => {
			requests.push(url.pathname);
			return url.pathname === "/blog/wp-admin/"
				? { status: 302, location: "/blog/wp-login.php?redirect_to=%2Fblog%2Fwp-admin%2F" }
				: { status: 302, location: "/wp-login.php" };
		},
	);

	assert.equal(result?.home.href, "https://example.com/blog/");
	assert.deepEqual(requests, ["/blog/wp-admin/"]);
});

test("falls back to the root admin page when a post path is not a subdirectory installation", async () => {
	const address = new URL("https://example.com/2026/a-post/");
	const requests: string[] = [];
	const result = await detectWordPress(address, new AbortController().signal, unavailableApi,
		async (url) => htmlPage(url, wordpressComPage),
		async (url) => {
			requests.push(url.pathname);
			return url.pathname === "/wp-admin/"
				? { status: 302, location: "/wp-login.php" }
				: { status: 404 };
		},
	);

	assert.equal(result?.home.href, site.href);
	assert.deepEqual(requests, ["/2026/wp-admin/", "/wp-admin/"]);
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
