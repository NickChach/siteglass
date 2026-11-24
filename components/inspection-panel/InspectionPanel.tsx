"use client";

import { useActionState } from "react";
import { checkWebsite } from "@/app/actions/check-website";
import InspectionSymbol from "@/components/inspection-symbol/InspectionSymbol";
import WebsiteCheckForm from "@/components/website-check-form/WebsiteCheckForm";
import WebsiteCheckReport from "@/components/website-check-report/WebsiteCheckReport";
import { scanWebsiteInBrowser } from "@/lib/website-check/browser-scan";
import type { WebsiteCheckOutcome } from "@/lib/website-check/post-urls";
import { parseScanAddress } from "@/lib/website-check/url";
import styles from "./inspection-panel.module.css";

type InspectionPanelProps = {
	reportClassName: string;
};

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

export default function InspectionPanel({ reportClassName }: InspectionPanelProps) {
	const [result, submitWebsite, pending] = useActionState(scanWebsite, null);
	const visibleResult = pending ? null : result;
	const invalidAddress = visibleResult?.status === "could-not-check" && visibleResult.reason === "invalid-url";

	return (
		<>
			<section className={styles.stage}>
				<div className={styles.orbit} aria-hidden="true" />
				<div className={styles.frame}>
					<span className={styles.topLeft} aria-hidden="true" />
					<span className={styles.topRight} aria-hidden="true" />
					<span className={styles.bottomLeft} aria-hidden="true" />
					<span className={styles.bottomRight} aria-hidden="true" />
					<div className={styles.browser}>
						<div className={styles.browserBar}>
							<span className={styles.dots} aria-hidden="true">
								<i />
								<i />
								<i />
							</span>
							<span>Website inspection</span>
							<InspectionSymbol className={styles.symbol} />
						</div>
						<div className={styles.checkPanel}>
							<h2>
								<span>Let’s check </span>
								<span>your website.</span>
							</h2>
							<p className={styles.intro}>Your homepage is a good place to start.</p>
							<WebsiteCheckForm submitWebsite={submitWebsite} pending={pending} invalidAddress={invalidAddress} />
						</div>
						<div className={styles.browserBottom}>
							<span className={styles.wordpressMark} aria-hidden="true">
								W
							</span>
							<span>Made for WordPress websites</span>
						</div>
					</div>
				</div>
				<p className={styles.caption}>
					<span aria-hidden="true">+</span> A fresh pair of eyes for your site.
				</p>
			</section>
			<WebsiteCheckReport className={reportClassName} result={visibleResult} pending={pending} />
		</>
	);
}
