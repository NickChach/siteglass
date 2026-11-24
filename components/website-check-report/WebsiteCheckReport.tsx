import { useEffect, useRef } from "react";
import type { PostUrlScan, WebsiteCheckOutcome } from "@/lib/website-check/post-urls";
import type { MatchedTerm } from "@/lib/website-check/post-path";
import styles from "./website-check-report.module.css";

type WebsiteCheckReportProps = {
	className: string;
	result: WebsiteCheckOutcome | null;
	pending: boolean;
};

const failureMessages = {
	"invalid-url": {
		title: "Check the website address",
		description: "Enter an address such as example.com and try again.",
	},
	"rate-limited": {
		title: "Too many checks right now",
		description: "Wait a moment before trying again.",
	},
	"wordpress-unconfirmed": {
		title: "We couldn’t confirm whether this site uses WordPress",
		description: "Check the address and try again with the site’s homepage.",
	},
	"post-urls-unavailable": {
		title: "We couldn’t access the post URLs",
		description: "We found signs of WordPress, but couldn’t access its public post URLs. Try again later.",
	},
	"scan-unavailable": {
		title: "The check couldn’t finish",
		description: "Try checking the website again in a moment.",
	},
} satisfies Record<Extract<WebsiteCheckOutcome, { status: "could-not-check" }>["reason"], {
	title: string;
	description: string;
}>;

const categoryLabels: Record<MatchedTerm["category"], string> = {
	adult: "Adult content",
	cryptocurrency: "Cryptocurrency",
	gambling: "Gambling",
	pharmaceuticals: "Pharmaceuticals",
	streaming: "Streaming",
};

const initialMatchCount = 3;
const formatCount = new Intl.NumberFormat("en");

function MatchList({ matches }: { matches: PostUrlScan["matches"] }) {
	return (
		<ul className={styles.matches} role="list">
			{matches.map(({ url, terms }) => {
				const { pathname, search } = new URL(url);

				return (
					<li key={url}>
						<bdi className={styles.path} dir="ltr">{pathname}{search}</bdi>
						<p className={styles.terms}>
							{terms.map(({ category, keyword }) => (
								<span className={styles.term} key={`${category}:${keyword}`}>
									{categoryLabels[category]} <mark>{keyword}</mark>
								</span>
							))}
						</p>
					</li>
				);
			})}
		</ul>
	);
}

function getScanTitle({ urlsChecked, matchedUrls }: PostUrlScan): string {
	if (urlsChecked === 0) return "No post URLs were checked";
	if (matchedUrls === 0) return "No matching terms found";
	return `${formatCount.format(matchedUrls)} ${matchedUrls === 1 ? "URL" : "URLs"} to review`;
}

function ScanSummary({ scan }: { scan: PostUrlScan }) {
	const { host, pathname } = new URL(scan.site);

	return (
		<>
			<h3 className={styles.title}>{getScanTitle(scan)}</h3>
			<p className={styles.site}><bdi dir="ltr">{host}{pathname === "/" ? "" : pathname}</bdi></p>
			{scan.urlsChecked > 0 && (
				<p className={styles.coverage}>
					{formatCount.format(scan.urlsChecked)} public post {scan.urlsChecked === 1 ? "URL" : "URLs"} checked
				</p>
			)}
			{scan.status === "partial" && (
				<p className={styles.partial}>Incomplete check. Some post URLs may have been missed.</p>
			)}
			{scan.urlsChecked === 0 && (
				<p className={styles.note}>If you expect this site to have public posts, try again later.</p>
			)}
		</>
	);
}

export default function WebsiteCheckReport({ className, result, pending }: WebsiteCheckReportProps) {
	const summaryRef = useRef<HTMLDivElement>(null);
	const failure = result?.status === "could-not-check" ? failureMessages[result.reason] : undefined;
	const scan = result?.status === "checked" || result?.status === "partial" ? result : undefined;

	useEffect(() => {
		if (result) summaryRef.current?.scrollIntoView({ block: "nearest" });
	}, [result]);

	return (
		<div className={result ? `${className} ${styles.report}` : styles.visuallyHidden}>
			<div role="status" ref={summaryRef}>
				{pending && "Checking your website…"}
				{failure && (
					<>
						<h3 className={styles.title}>{failure.title}</h3>
						<p className={styles.note} id="website-check-error">{failure.description}</p>
					</>
				)}
				{scan && <ScanSummary scan={scan} />}
			</div>
			{scan && scan.matches.length > 0 && (
				<>
					<MatchList matches={scan.matches.slice(0, initialMatchCount)} />
					{scan.matches.length > initialMatchCount && (
						<details className={styles.more}>
							<summary>
								<span className={styles.showMatches}>Show {scan.matches.length - initialMatchCount} more URLs</span>
								<span className={styles.hideMatches}>Hide additional URLs</span>
							</summary>
							<MatchList matches={scan.matches.slice(initialMatchCount)} />
						</details>
					)}
					{scan.matchedUrls > scan.matches.length && (
						<p className={styles.note}>Details are available for the first {scan.matches.length} matches.</p>
					)}
					<p className={styles.note}>
						These terms can appear in legitimate posts. Review the URLs in WordPress and ask your developer or hosting provider about any you don’t recognize.
					</p>
				</>
			)}
			{scan && scan.urlsChecked > 0 && (
				<p className={styles.scope}>
					Siteglass checks public post URL paths for selected terms related to adult content, cryptocurrency,
					gambling, pharmaceuticals, and streaming. This check alone can’t tell whether a site has been hacked.
				</p>
			)}
		</div>
	);
}
