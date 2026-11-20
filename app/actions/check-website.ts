"use server";

import { parseWebsiteUrl } from "@/lib/website-check/public-website";
import { detectWordPress } from "@/lib/website-check/wordpress";
import type { WebsiteCheckResult } from "@/lib/website-check/wordpress";

const RATE_LIMIT_WINDOW_MS = 60_000;
const SCANS_PER_WINDOW = 30;
const MAX_ACTIVE_SCANS = 4;
const scanStarts: number[] = [];
let activeScans = 0;

export async function checkWebsite(
	_previousResult: WebsiteCheckResult | null,
	formData: FormData,
): Promise<WebsiteCheckResult> {
	const value = formData instanceof FormData ? formData.get("website") : null;
	if (typeof value !== "string") return { status: "could-not-check", reason: "invalid-url" };

	const address = value.trim();
	const url = parseWebsiteUrl(/^https?:\/\//i.test(address) ? address : "http://" + address);
	if (!url) return { status: "could-not-check", reason: "invalid-url" };

	const now = performance.now();
	while (scanStarts.length && now - scanStarts[0] >= RATE_LIMIT_WINDOW_MS) {
		scanStarts.shift();
	}
	if (scanStarts.length >= SCANS_PER_WINDOW || activeScans >= MAX_ACTIVE_SCANS) {
		return { status: "could-not-check", reason: "rate-limited" };
	}

	scanStarts.push(now);
	activeScans++;
	try {
		return await detectWordPress(url);
	} finally {
		activeScans--;
	}
}
