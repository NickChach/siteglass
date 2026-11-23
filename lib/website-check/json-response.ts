export const JSON_MEDIA_TYPE = "application/json";

export function responseMediaType(contentType: string | null | undefined): string {
	return contentType?.split(";", 1)[0].trim().toLowerCase() ?? "";
}
