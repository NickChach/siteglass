export const JSON_MEDIA_TYPE = "application/json";

export function responseMediaType(contentType: string | null | undefined): string {
	return contentType?.split(";", 1)[0].trim().toLowerCase() ?? "";
}

export function isReadableJsonResponse(mediaType: string, status: number): boolean {
	// WordPress can report the end of pagination in a JSON error body.
	return mediaType === JSON_MEDIA_TYPE && ((status >= 200 && status < 300) || status === 400);
}
