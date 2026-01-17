import { generateText } from "ai";
import type { Document } from "@/lib/db/schema";
import { fileTitlePrompt } from "./prompts";
import { getTitleModel } from "./providers";

const MAX_EXCERPT_LENGTH = 800;

type FileTitleInput = {
	filename: string;
	kind: Document["kind"];
	contentType: string;
	summary: string | null;
	textContent: string;
};

const normalizeWhitespace = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const resolveFallbackTitle = ({
	filename,
	kind,
	contentType,
}: {
	filename: string;
	kind: Document["kind"];
	contentType: string;
}): string => {
	const trimmedFilename = filename.trim() || "Untitled";

	if (contentType.startsWith("image/") || kind === "image") {
		return `Image: ${trimmedFilename}`;
	}

	if (kind === "pdf") {
		return `PDF: ${trimmedFilename}`;
	}

	if (kind === "sheet") {
		return `Spreadsheet: ${trimmedFilename}`;
	}

	if (kind === "docx") {
		return `Document: ${trimmedFilename}`;
	}

	return trimmedFilename;
};

export async function generateTitleFromFileMetadata({
	filename,
	kind,
	contentType,
	summary,
	textContent,
}: FileTitleInput): Promise<string> {
	const trimmedFilename = filename.trim() || "Untitled";
	const normalizedSummary = summary ? normalizeWhitespace(summary) : "";
	const normalizedText = normalizeWhitespace(textContent);
	const excerpt = normalizedText.slice(0, MAX_EXCERPT_LENGTH);

	if (!normalizedSummary && !excerpt) {
		return resolveFallbackTitle({
			filename: trimmedFilename,
			kind,
			contentType,
		});
	}

	const prompt = [
		`Filename: ${trimmedFilename}`,
		`Document kind: ${kind}`,
		`Summary: ${normalizedSummary || "None"}`,
		`Excerpt: ${excerpt || "None"}`,
	].join("\n");

	const { text } = await generateText({
		model: getTitleModel(),
		system: fileTitlePrompt,
		prompt,
	});

	const cleanedTitle = text.replace(/["']/g, "").trim();

	if (!cleanedTitle) {
		return resolveFallbackTitle({
			filename: trimmedFilename,
			kind,
			contentType,
		});
	}

	return cleanedTitle;
}
