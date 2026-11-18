import styles from "./inspection-symbol.module.css";

export default function InspectionSymbol() {
	return (
		<svg className={styles.symbol} viewBox="0 0 40 40" aria-hidden="true">
			<path d="M10 7H5v26h5m20-26h5v26h-5" />
			<circle cx="20" cy="20" r="8" />
		</svg>
	);
}
