import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const IbmPlexSans = IBM_Plex_Sans({
	weight: ["300", "400", "700"],
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Siteglass | Take a closer look at your WordPress site",
	description:
		"Take a closer look at your website. Siteglass checks WordPress websites for signs they may have been hacked. Start with a single link.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" data-scroll-behavior="smooth" className={IbmPlexSans.className}>
			<body>{children}</body>
		</html>
	);
}
