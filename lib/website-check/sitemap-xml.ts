import { MAX_URL_LENGTH } from "./url";

const MAX_XML_DEPTH = 32;
const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const entityValues = new Map([
	["&amp;", "&"], ["&lt;", "<"], ["&gt;", ">"], ["&quot;", '"'], ["&apos;", "'"],
]);

function decodeXmlText(text: string): string | undefined {
	let valid = true;
	const decoded = text.replace(/&(?:[a-z]+;|#\d+;|#x[\da-fA-F]+;)?/g, (reference) => {
		const value = entityValues.get(reference);
		if (value !== undefined) return value;
		const code = reference.startsWith("&#x") ? Number.parseInt(reference.slice(3, -1), 16)
			: reference.startsWith("&#") ? Number(reference.slice(2, -1)) : NaN;
		if (code === 9 || code === 10 || code === 13 ||
			(code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) ||
			(code >= 0x10000 && code <= 0x10ffff)) return String.fromCodePoint(code);
		valid = false;
		return "";
	});
	return valid ? decoded : undefined;
}

type Element = {
	name: string;
	local: string;
	namespace: string;
	declarations: Map<string, string>;
};

type Sitemap = { type: "index" | "urls"; locations: string[] };

// Read the sitemap vocabulary and ignore extension elements. Markup is never rendered or resolved.
export function parseSitemap(xml: string): Sitemap | undefined {
	const tagName = /<(\/?)([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)/y;
	const tagEnd = /[\t\n\r ]*(\/?)>/y;
	const attribute = /[\t\n\r ]+([A-Za-z_][\w.:-]*)[\t\n\r ]*=[\t\n\r ]*(?:"([^"<]*)"|'([^'<]*)')/y;
	const special = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>/y;
	const elements: Element[] = [];
	let sitemap: Sitemap | undefined;
	let location: string | undefined;
	let offset = 0;

	function appendLocation(text: string) {
		if (location === undefined || location.length > MAX_URL_LENGTH) return;
		location = (location + text).slice(0, MAX_URL_LENGTH + 1);
	}

	while (offset < xml.length) {
		if (xml[offset] !== "<") {
			const nextTag = xml.indexOf("<", offset);
			const end = nextTag === -1 ? xml.length : nextTag;
			const text = decodeXmlText(xml.slice(offset, end));
			if (text === undefined || (!elements.length && text.trim())) return;
			appendLocation(text);
			offset = end;
			continue;
		}

		special.lastIndex = offset;
		const specialTag = special.exec(xml);
		if (specialTag) {
			const cdata = specialTag[1];
			if (cdata !== undefined) {
				if (!elements.length) return;
				appendLocation(cdata);
			}
			offset = special.lastIndex;
			continue;
		}

		tagName.lastIndex = offset;
		const tag = tagName.exec(xml);
		if (!tag) return; // Other markup declarations, including DOCTYPE, are unsupported.
		const [, closing, name] = tag;
		offset = tagName.lastIndex;
		const declarations = new Map<string, string>();
		const attributes = new Set<string>();
		let selfClosing = false;
		while (true) {
			tagEnd.lastIndex = offset;
			const end = tagEnd.exec(xml);
			if (end) {
				selfClosing = end[1] === "/";
				offset = tagEnd.lastIndex;
				break;
			}
			if (closing) return;
			attribute.lastIndex = offset;
			const attr = attribute.exec(xml);
			if (!attr || attributes.has(attr[1])) return;
			const [, key, doubleQuoted, singleQuoted] = attr;
			attributes.add(key);
			if (key === "xmlns" || key.startsWith("xmlns:")) {
				const namespace = decodeXmlText(doubleQuoted ?? singleQuoted);
				if (namespace === undefined) return;
				declarations.set(key === "xmlns" ? "" : key.slice(6), namespace);
			}
			offset = attribute.lastIndex;
		}

		if (closing) {
			if (selfClosing || elements.pop()?.name !== name) return;
			if (location !== undefined) {
				sitemap?.locations.push(location.length <= MAX_URL_LENGTH ? location.trim() : "");
				location = undefined;
			}
			continue;
		}

		if (location !== undefined || elements.length >= MAX_XML_DEPTH) return;
		const colon = name.indexOf(":");
		const prefix = colon === -1 ? "" : name.slice(0, colon);
		const local = name.slice(colon + 1);
		let namespace = declarations.get(prefix);
		for (let i = elements.length - 1; namespace === undefined && i >= 0; i--) {
			namespace = elements[i].declarations.get(prefix);
		}
		if (prefix && !namespace) return;
		namespace ??= "";

		if (!elements.length) {
			if (sitemap || (namespace && namespace !== SITEMAP_NAMESPACE)) return;
			if (local !== "sitemapindex" && local !== "urlset") return;
			sitemap = { type: local === "sitemapindex" ? "index" : "urls", locations: [] };
		} else if (elements.length === 2 && sitemap && local === "loc") {
			const [root, entry] = elements;
			const entryName = sitemap.type === "index" ? "sitemap" : "url";
			if (entry.local === entryName && entry.namespace === root.namespace && namespace === root.namespace) {
				if (selfClosing) sitemap.locations.push("");
				else location = "";
			}
		}
		if (!selfClosing) elements.push({ name, local, namespace, declarations });
	}

	if (!elements.length) return sitemap;
}
