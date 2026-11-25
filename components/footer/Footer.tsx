import { Space_Grotesk } from "next/font/google";
import InspectionSymbol from "../inspection-symbol/InspectionSymbol";
import styles from "./footer.module.css";

const SpaceGrotesk = Space_Grotesk({
	weight: ["300", "400", "700"],
	subsets: ["latin"],
});

export default function Footer() {
	return (
		<footer className={styles.footer}>
			<p className={styles.logo}>
				{" "}
				<InspectionSymbol className={styles.symbol} />{" "}
				<span className={`${SpaceGrotesk.className} ${styles.wordmark}`}>siteglass.</span>
			</p>
			<p>
				Built by <a href="https://www.nickchachlioutis.gr/">Nova Consant</a> for the people behind the websites.
			</p>
		</footer>
	);
}
