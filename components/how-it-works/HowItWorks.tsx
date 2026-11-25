import styles from "./how-it-works.module.css";

type InspectionStep = {
	id: string;
	title: string;
	description: string;
};

const steps: InspectionStep[] = [
	{
		id: "wordpress",
		title: "First, is it WordPress?",
		description: "We check whether your website runs on WordPress before taking a closer look.",
	},
	{
		id: "hack-signs",
		title: "Then, any signs of a hack?",
		description: "If it’s a WordPress site, we look for signs that someone may have tampered with it.",
	},
];

export default function HowItWorks() {
	return (
		<article className={styles.section} id="how-it-works" aria-labelledby="how-title">
			<h2 id="how-title">
				<span>One address. </span>
				<span>Two useful checks.</span>
			</h2>
			<div className={styles.details}>
				<ol className={styles.steps} role="list">
					{steps.map((step, index) => (
						<li key={step.id}>
							<span className={styles.number} aria-hidden="true">
								{index + 1}
							</span>
							<div>
								<h3>{step.title}</h3>
								<p>{step.description}</p>
							</div>
						</li>
					))}
				</ol>
				<p className={styles.explanation}>
					Siteglass checks your public WordPress post URLs for terms related to gambling, cryptocurrency or adult content. If
					those topics are unrelated to your site, they can be a sign of SEO poisoning, where someone publishes spam on your site
					in order to manipulate search engine rankings for his own, often malicious, site.
				</p>
			</div>
		</article>
	);
}
