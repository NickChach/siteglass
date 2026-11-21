const keywords = {
	adult: ["porn", "pornography", "adult video", "adult videos"],
	cryptocurrency: ["crypto", "cryptocurrency", "cryptocurrencies", "bitcoin"],
	gambling: ["casino", "casinos", "online casino", "sports betting", "slot machine", "slot machines"],
} as const;

type Category = keyof typeof keywords;
export type MatchedTerm = { category: Category; keyword: string };
const categories = Object.keys(keywords) as Category[];

export function matchPostPath(decodedPath: string): MatchedTerm[] {
	const words = " " + decodedPath.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim() + " ";
	return categories.flatMap((category) => keywords[category]
		.filter((keyword) => words.includes(" " + keyword + " "))
		.map((keyword) => ({ category, keyword })));
}
