import { Space_Grotesk } from "next/font/google";
import InspectionSymbol from "@/components/inspection-symbol/InspectionSymbol";
import styles from "./header.module.css";

const SpaceGrotesk = Space_Grotesk({
	weight: ["300", "400", "700"],
	subsets: ["latin"],
});

export default function Header() {
	return (
		<header className={styles.header}>
			<a href="/" aria-label="Siteglass home" className={styles.logo}>
				<InspectionSymbol className={styles.symbol} />
				<span className={`${SpaceGrotesk.className} ${styles.wordmark}`}>
					siteglass<span className={styles.period}>.</span>
				</span>
			</a>
			<nav aria-label="Main navigation">
				<a className={styles.howLink} href="#how-it-works">
					How it works
				</a>
			</nav>
		</header>
	);
}
