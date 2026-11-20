import "server-only";

import { Resolver } from "node:dns/promises";
import { get as httpGet } from "node:http";
import type { IncomingMessage } from "node:http";
import { get as httpsGet } from "node:https";
import { BlockList, isIP } from "node:net";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const MAX_URL_LENGTH = 2_048;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 3_000;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

// IANA special-purpose ranges that are unsuitable destinations, plus multicast.
const blockedAddresses = new BlockList();
const reservedIpv4 = [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.88.99.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
] as const;

for (const [network, prefix] of reservedIpv4) {
	blockedAddresses.addSubnet(network, prefix, "ipv4");
}

// Permit current IPv6 global unicast space and exclude protocol assignments,
// transition mechanisms, and documentation ranges within it.
const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");
blockedAddresses.addSubnet("2001::", 23, "ipv6");
blockedAddresses.addSubnet("2001:db8::", 32, "ipv6");
blockedAddresses.addSubnet("2002::", 16, "ipv6");
blockedAddresses.addSubnet("3fff::", 20, "ipv6");

type Address = {
	address: string;
	family: 4 | 6;
};

export type PublicPage = {
	url: URL;
	status: number;
	mediaType: string;
	link: string | undefined;
	body: string;
};

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
		url.username ||
		url.password ||
		url.port ||
		url.href.length > MAX_URL_LENGTH
	) {
		return;
	}

	url.hash = "";
	return url;
}

function isPublicAddress({ address, family }: Address): boolean {
	if (isIP(address) !== family || address.includes("%")) return false;

	if (family === 4) return !blockedAddresses.check(address, "ipv4");

	return globalIpv6.check(address, "ipv6") && !blockedAddresses.check(address, "ipv6");
}

async function resolvePublicAddress(url: URL, signal: AbortSignal): Promise<Address> {
	signal.throwIfAborted();

	const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
	const family = isIP(hostname);
	let addresses: Address[];

	if (family === 4 || family === 6) {
		addresses = [{ address: hostname, family }];
	} else {
		const domain = hostname.replace(/\.$/, "");
		if (!domain.includes(".") || domain.endsWith(".localhost")) {
			throw new Error("A public website hostname is required");
		}

		const resolver = new Resolver({ timeout: 750, tries: 2 });
		const cancel = () => resolver.cancel();
		signal.addEventListener("abort", cancel, { once: true });

		try {
			const [ipv4, ipv6] = await Promise.allSettled([
				resolver.resolve4(domain + "."),
				resolver.resolve6(domain + "."),
			]);
			addresses = [
				...(ipv4.status === "fulfilled"
					? ipv4.value.map((address): Address => ({ address, family: 4 }))
					: []),
				...(ipv6.status === "fulfilled"
					? ipv6.value.map((address): Address => ({ address, family: 6 }))
					: []),
			];
		} finally {
			signal.removeEventListener("abort", cancel);
		}
	}

	signal.throwIfAborted();
	if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
		throw new Error("The website hostname must resolve to public addresses");
	}

	return addresses[0];
}

function requestPage(url: URL, destination: Address, signal: AbortSignal): Promise<IncomingMessage> {
	const get = url.protocol === "https:" ? httpsGet : httpGet;

	return new Promise((resolve, reject) => {
		const request = get(url, {
			agent: false,
			family: destination.family,
			signal,
			rejectUnauthorized: true,
			// Preserve the URL hostname for Host and TLS and skip any further DNS lookup.
			lookup: (_hostname, options, callback) => {
				if (options.all) {
					callback(null, [destination]);
					return;
				}
				callback(null, destination.address, destination.family);
			},
			headers: {
				accept: "text/html, application/xhtml+xml, application/json",
				"accept-encoding": "gzip, deflate, br",
				"user-agent": "Siteglass/0.1",
			},
		}, resolve);

		request.once("error", reject);
		request.once("close", () => reject(new Error("Website connection closed before a response")));
	});
}

async function* limitBody(source: AsyncIterable<Buffer>) {
	let bytes = 0;
	for await (const chunk of source) {
		bytes += chunk.length;
		if (bytes > MAX_BODY_BYTES) throw new Error("Website response exceeded the size limit");
		yield chunk;
	}
}

async function collectBody(source: AsyncIterable<Buffer>): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of limitBody(source)) chunks.push(chunk);
	return Buffer.concat(chunks).toString("utf8");
}

async function readBody(response: IncomingMessage, signal: AbortSignal): Promise<string> {
	const encoding = response.headers["content-encoding"]?.trim().toLowerCase();
	switch (encoding) {
		case undefined:
		case "identity":
			return pipeline(response, collectBody, { signal });
		case "gzip":
			return pipeline(response, limitBody, createGunzip(), collectBody, { signal });
		case "deflate":
			return pipeline(response, limitBody, createInflate(), collectBody, { signal });
		case "br":
			return pipeline(response, limitBody, createBrotliDecompress(), collectBody, { signal });
		default:
			throw new Error("Unsupported website response encoding");
	}
}

export async function getPublicPage(
	address: URL,
	scanSignal: AbortSignal,
	allowedOrigin?: string,
): Promise<PublicPage> {
	const signal = AbortSignal.any([scanSignal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]);
	let url = parseWebsiteUrl(address.href);

	for (let redirects = 0; url && redirects <= MAX_REDIRECTS; redirects++) {
		if (allowedOrigin && url.origin !== allowedOrigin) break;

		const destination = await resolvePublicAddress(url, signal);
		const response = await requestPage(url, destination, signal);

		try {
			const status = response.statusCode ?? 0;
			if (redirectStatuses.has(status) && response.headers.location) {
				url = parseWebsiteUrl(response.headers.location, url);
				continue;
			}

			const mediaType = response.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase() ?? "";
			const link = response.headers.link;
			const isReadable = status >= 200 && status < 300 &&
				["text/html", "application/xhtml+xml", "application/json"].includes(mediaType);

			return {
				url,
				status,
				mediaType,
				link: Array.isArray(link) ? link.join(", ") : link,
				body: isReadable ? await readBody(response, signal) : "",
			};
		} finally {
			response.destroy();
		}
	}

	throw new Error("Website redirect is blocked or exceeds the redirect limit");
}
