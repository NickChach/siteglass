import { keywords } from "./dictionary";

type Category = keyof typeof keywords;
export type MatchedTerm = { category: Category; keyword: string };
const categories = Object.keys(keywords) as Category[];

export function matchPostPath(decodedPath: string): MatchedTerm[] {
	const words =
		" " +
		decodedPath
			.normalize("NFKC")
			.toLowerCase()
			.replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
			.trim() +
		" ";
	return categories.flatMap((category) =>
		keywords[category].filter((keyword) => words.includes(" " + keyword + " ")).map((keyword) => ({ category, keyword })),
	);
}
