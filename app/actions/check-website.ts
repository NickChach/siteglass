"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import type { WebsiteCheckResult } from "@/lib/website-check/post-urls";
import { createScanLimiter } from "@/lib/website-check/scan-limiter";
import { scanWebsiteOnServer } from "@/lib/website-check/server-scan";
import { parseScanAddress } from "@/lib/website-check/url";

const runLimitedScan = createScanLimiter();

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
	return await runLimitedScan(caller, () => scanWebsiteOnServer(url)) ?? {
		status: "could-not-check", reason: "rate-limited",
	};
}
