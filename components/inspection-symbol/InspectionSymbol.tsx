type InspectionSymbolProps = {
	className?: string;
};

export default function InspectionSymbol({ className }: InspectionSymbolProps) {
	return (
		<svg className={className} viewBox="0 0 40 40" aria-hidden="true">
			<path d="M10 7H5v26h5m20-26h5v26h-5" />
			<circle cx="20" cy="20" r="8" />
		</svg>
	);
}
