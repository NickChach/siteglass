import { checkApiPostUrls, findWordPressApi, MAX_RESPONSE_BYTES } from "./wordpress-api";
import type { PostUrlScan } from "./post-urls";

const BROWSER_SCAN_TIMEOUT_MS = 8_000;
const REQUEST_TIMEOUT_MS = 1_500;

type DocumentWithPolicy = Document & {
	featurePolicy?: {
		features(): string[];
		allowsFeature(feature: string): boolean;
	};
};

function blocksLocalRequests(): boolean {
	const policy = (document as DocumentWithPolicy).featurePolicy;
	if (!window.isSecureContext || window.location.protocol !== "https:" || !policy) return false;
	const features = policy.features();
	if (features.includes("local-network") && features.includes("loopback-network")) {
		return !policy.allowsFeature("local-network") && !policy.allowsFeature("loopback-network");
	}
	return features.includes("local-network-access") && !policy.allowsFeature("local-network-access");
}

async function readJsonBody(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let body = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return body + decoder.decode();
			bytes += value.byteLength;
			if (bytes > MAX_RESPONSE_BYTES) throw new Error("WordPress response exceeded the size limit");
			body += decoder.decode(value, { stream: true });
		}
	} catch (error) {
		await reader.cancel().catch(() => {});
		throw error;
	} finally {
		reader.releaseLock();
	}
}

export async function scanWebsiteInBrowser(address: URL): Promise<PostUrlScan | undefined> {
	const hostname = address.hostname.replace(/\.$/, "");
	if (address.protocol !== "https:" || !hostname.includes(".") ||
		/^(?:\d+\.){3}\d+$|\.(?:localhost|local)$/.test(hostname) || !blocksLocalRequests()) return;

	async function getJson(url: URL, scanSignal: AbortSignal) {
		if (url.origin !== address.origin) throw new Error("WordPress API must stay on the submitted origin");
		const response = await fetch(url, {
			mode: "cors",
			credentials: "omit",
			redirect: "error",
			referrerPolicy: "no-referrer",
			signal: AbortSignal.any([scanSignal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
		});
		const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
		const readable = mediaType === "application/json" && (response.ok || response.status === 400);
		if (!readable) await response.body?.cancel();
		return {
			url,
			status: response.status,
			mediaType,
			totalPages: response.headers.get("x-wp-totalpages"),
			body: readable && response.body ? await readJsonBody(response.body) : "",
		};
	}

	const signal = AbortSignal.timeout(BROWSER_SCAN_TIMEOUT_MS);
	const api = await findWordPressApi(address, getJson, signal);
	if (api) return checkApiPostUrls(api, getJson, signal);
}
