import { Space_Grotesk } from "next/font/google";
import InspectionPanel from "@/components/inspection-panel/InspectionPanel";
import styles from "./hero.module.css";

const SpaceGrotesk = Space_Grotesk({
	weight: ["300", "400", "700"],
	subsets: ["latin"],
});

export default function Hero() {
	return (
		<article className={styles.hero} aria-labelledby="hero-title">
			<section className={styles.copy}>
				<h1 id="hero-title" className={SpaceGrotesk.className}>
					<span>Looks fine. </span>
					<span>Look closer.</span>
				</h1>
				<p className={styles.description}>
					A website can look normal and still be hacked. Give your WordPress site a closer look, starting with a single link.
				</p>
			</section>
			<InspectionPanel reportClassName={styles.report} />
		</article>
	);
}
