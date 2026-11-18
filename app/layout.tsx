import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const ibmPlexSans = localFont({
	src: "./fonts/ibm-plex-sans.ttf",
	variable: "--body-font",
	weight: "400",
	display: "swap",
});

const spaceGrotesk = localFont({
	src: "./fonts/space-grotesk.ttf",
	variable: "--display-font",
	weight: "400",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Siteglass | Take a closer look at your WordPress site",
	description:
		"Take a closer look at your website. Siteglass identifies WordPress websites, then checks for signs they may have been hacked. Start with a single link.",
};

export const viewport: Viewport = {
	themeColor: "#f7eef2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" data-scroll-behavior="smooth" className={`${ibmPlexSans.variable} ${spaceGrotesk.variable}`}>
			<body>{children}</body>
		</html>
	);
}
