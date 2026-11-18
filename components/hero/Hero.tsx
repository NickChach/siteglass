import InspectionPanel from "@/components/inspection-panel/InspectionPanel";
import styles from "./hero.module.css";

export default function Hero() {
	return (
		<section className={styles.hero} aria-labelledby="hero-title">
			<div className={styles.copy}>
				<h1 id="hero-title">
					Looks fine.
					<br />
					Look closer.
				</h1>
				<p className={styles.description}>
					A website can look normal and still be hacked. Give your WordPress site a closer look, starting with a single link.
				</p>
				<div className={styles.caption}>
					<svg viewBox="0 0 28 28" aria-hidden="true">
						<path d="M2 14s4.5-8 12-8 12 8 12 8-4.5 8-12 8S2 14 2 14Z" />
						<circle cx="14" cy="14" r="3.5" />
					</svg>
					<p>A little clarity for your corner of the internet.</p>
				</div>
			</div>
			<InspectionPanel />
		</section>
	);
}
