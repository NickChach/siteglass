"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import type { WebsiteCheckResult } from "@/lib/website-check/post-urls";
import { scanWebsiteOnServer } from "@/lib/website-check/server-scan";
import { parseScanAddress } from "@/lib/website-check/url";

const RATE_LIMIT_WINDOW_MS = 60_000;
const SCANS_PER_WINDOW = 30;
const SCANS_PER_CALLER = 3;
const MAX_ACTIVE_SCANS = 4;
const scanStarts: { time: number; caller?: string }[] = [];
let activeScans = 0;

async function getCaller(): Promise<string | undefined> {
	// The trusted ingress must overwrite this header with one client IP.
	const header = process.env.SITEGLASS_CLIENT_IP_HEADER;
	if (!header) return;
	const value = (await headers()).get(header)?.trim();
	if (value && isIP(value)) return value;
	return "unknown";
}

export async function checkWebsite(formData: FormData): Promise<WebsiteCheckResult> {
	const url = parseScanAddress(formData instanceof FormData ? formData.get("website") : null);
	if (!url) return { status: "could-not-check", reason: "invalid-url" };

	const caller = await getCaller();
	const now = performance.now();
	while (scanStarts.length && now - scanStarts[0].time >= RATE_LIMIT_WINDOW_MS) {
		scanStarts.shift();
	}
	if (scanStarts.length >= SCANS_PER_WINDOW || activeScans >= MAX_ACTIVE_SCANS ||
		(caller && scanStarts.filter((scan) => scan.caller === caller).length >= SCANS_PER_CALLER)) {
		return { status: "could-not-check", reason: "rate-limited" };
	}

	scanStarts.push({ time: now, caller });
	activeScans++;
	try {
		return await scanWebsiteOnServer(url);
	} finally {
		activeScans--;
	}
}
