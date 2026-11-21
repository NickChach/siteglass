const RATE_LIMIT_WINDOW_MS = 60_000;
const SCANS_PER_WINDOW = 30;
const SCANS_PER_CALLER = 3;
const MAX_ACTIVE_SCANS = 4;

export function createScanLimiter(clock = () => performance.now()) {
	const scanStarts: { time: number; caller?: string }[] = [];
	let activeScans = 0;

	return async function runScan<T>(caller: string | undefined, scan: () => Promise<T>): Promise<T | undefined> {
		const now = clock();
		while (scanStarts.length && now - scanStarts[0].time >= RATE_LIMIT_WINDOW_MS) {
			scanStarts.shift();
		}
		if (scanStarts.length >= SCANS_PER_WINDOW || activeScans >= MAX_ACTIVE_SCANS ||
			(caller && scanStarts.filter((start) => start.caller === caller).length >= SCANS_PER_CALLER)) return;

		scanStarts.push({ time: now, caller });
		activeScans++;
		try {
			return await scan();
		} finally {
			activeScans--;
		}
	};
}
