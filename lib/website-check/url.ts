export const MAX_URL_LENGTH = 2_048;

export function parseWebsiteUrl(value: string, base?: URL): URL | undefined {
	if (value.length > MAX_URL_LENGTH) return;

	let url: URL;
	try {
		url = new URL(value, base);
	} catch {
		return;
	}

	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username || url.password || url.port || url.href.length > MAX_URL_LENGTH
	) return;

	url.hash = "";
	return url;
}

export function parseScanAddress(value: unknown): URL | undefined {
	if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return;
	const address = value.trim();
	if (!address) return;
	const url = parseWebsiteUrl(/^https?:\/\//i.test(address) ? address : "https://" + address);
	if (!url) return;
	url.hostname = url.hostname.replace(/^www\.(?=.)/, "");
	return new URL(url.origin);
}

export function sitePath(url: URL): string {
	return url.pathname.replace(/\/$/, "");
}

export function isWithinSite(url: URL, home: URL): boolean {
	const basePath = sitePath(home);
	return url.origin === home.origin &&
		(url.pathname === basePath || url.pathname.startsWith(basePath + "/"));
}
