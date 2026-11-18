import Link from "next/link";
import InspectionSymbol from "@/components/inspection-symbol/InspectionSymbol";
import styles from "./header.module.css";

export default function Header() {
	return (
		<header className={styles.header}>
			<Link href="/" aria-label="Siteglass home" className={styles.logo}>
				<InspectionSymbol className={styles.symbol} />
				<span className={styles.wordmark}>
					siteglass<span className={styles.period}>.</span>
				</span>
			</Link>
			<nav aria-label="Main navigation">
				<a className={styles.howLink} href="#how-it-works">How it works</a>
			</nav>
		</header>
	);
}
