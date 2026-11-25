import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import structuredData from "./structuredData.json";
import "./globals.css";

const IbmPlexSans = IBM_Plex_Sans({
	weight: ["300", "400", "700"],
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Siteglass | WordPress SEO Spam Scanner",
	description:
		"Take a closer look at your WordPress website. Siteglass checks for signs of SEO poisoning hacks. Start with a single link.",
	authors: [{ name: "NovaConstant — NickChachlioutis" }],
	keywords: [
		"SEO poisoning",
		"WordPress",
		"cybersecurity",
		"WordPress SEO spam",
		"WordPress SEO poisoning",
		"WordPress spam checker",
		"WordPress spam post detection",
		"WordPress hacked site checker",
		"WordPress spam URL checker",
		"SEO spam detection",
		"suspicious WordPress posts",
		"check WordPress for spam",
		"SEO poisoning checker",
	],
	robots: {
		index: true,
		follow: true,
		nocache: false,
		googleBot: {
			index: true,
			follow: true,
			"max-snippet": -1,
			"max-image-preview": "large",
			"max-video-preview": -1,
		},
	},
	openGraph: {
		title: "Siteglass | WordPress SEO Spam Scanner",
		description:
			"Take a closer look at your WordPress website. Siteglass checks for signs of SEO poisoning hacks. Start with a single link.",
		url: "https://siteglass-psi.vercel.app",
		siteName: "Siteglass | WordPress SEO Spam Scanner",
		images: [
			{
				url: "/images/siteglass.png",
				width: 1200,
				height: 630,
			},
		],
		locale: "en",
		type: "website",
	},
	alternates: {
		canonical: "https://siteglass-psi.vercel.app",
	},
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" data-scroll-behavior="smooth" className={IbmPlexSans.className}>
			<head>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}></script>
			</head>
			<body>{children}</body>
			<Analytics />
			<SpeedInsights />
		</html>
	);
}
