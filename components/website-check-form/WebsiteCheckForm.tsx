"use client";

import { useActionState, useState } from "react";
import { checkWebsite } from "@/app/actions/check-website";
import { scanWebsiteInBrowser } from "@/lib/website-check/browser-scan";
import type { WebsiteCheckOutcome } from "@/lib/website-check/post-urls";
import { parseScanAddress } from "@/lib/website-check/url";
import WebsiteCheckReport from "@/components/website-check-report/WebsiteCheckReport";
import styles from "./website-check-form.module.css";

async function scanWebsite(_previousResult: WebsiteCheckOutcome | null, formData: FormData): Promise<WebsiteCheckOutcome> {
	const url = parseScanAddress(formData.get("website"));
	if (!url) return { status: "could-not-check", reason: "invalid-url" };
	try {
		const browserResult = await scanWebsiteInBrowser(url).catch(() => undefined);
		return browserResult ?? await checkWebsite(formData);
	} catch {
		return { status: "could-not-check", reason: "scan-unavailable" };
	}
}

export default function WebsiteCheckForm() {
	const [website, setWebsite] = useState("");
	const [result, submitWebsite, pending] = useActionState(scanWebsite, null);
	const visibleResult = pending ? null : result;
	const invalidAddress = visibleResult?.status === "could-not-check" && visibleResult.reason === "invalid-url";

	return (
		<>
			<form id="website-check" className={styles.form} action={submitWebsite} aria-busy={pending}>
				<label htmlFor="website-url">Website address</label>
				<div className={styles.urlField}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<circle cx="12" cy="12" r="9" />
						<ellipse cx="12" cy="12" rx="4" ry="9" />
						<path d="M3 12h18" />
					</svg>
					<input
						id="website-url"
						name="website"
						value={website}
						type="text"
						inputMode="url"
						placeholder="yourwebsite.com"
						autoComplete="url"
						autoCapitalize="none"
						spellCheck={false}
						aria-invalid={invalidAddress || undefined}
						aria-describedby={invalidAddress ? "website-check-error" : "url-hint"}
						onChange={(event) => setWebsite(event.currentTarget.value)}
						readOnly={pending}
						required
					/>
				</div>
				<button className={styles.button} type="submit" disabled={pending}>
					{pending ? "Checking your website…" : "Check my website"}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<circle cx="10.5" cy="10.5" r="6.5" />
						<path d="m15.5 15.5 5 5" />
					</svg>
				</button>
				<p className={styles.hint} id="url-hint">
					One link. No account needed.
				</p>
			</form>
			<WebsiteCheckReport result={visibleResult} pending={pending} />
		</>
	);
}
