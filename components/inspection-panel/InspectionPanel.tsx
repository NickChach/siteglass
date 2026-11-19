import InspectionSymbol from "@/components/inspection-symbol/InspectionSymbol";
import WebsiteCheckForm from "@/components/website-check-form/WebsiteCheckForm";
import styles from "./inspection-panel.module.css";

export default function InspectionPanel() {
	return (
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
						<WebsiteCheckForm />
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
	);
}
