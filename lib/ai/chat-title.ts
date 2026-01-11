import "server-only";

import { generateText } from "ai";
import { fileTitlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";

export async function generateTitleFromDocument({
	filename,
	kind,
	summary,
	excerpt,
}: {
	filename: string;
	kind?: string | null;
	summary?: string | null;
	excerpt?: string | null;
}) {
	const promptParts = [`Filename: ${filename}`];

	if (kind) {
		promptParts.push(`Document kind: ${kind}`);
	}

	if (summary) {
		promptParts.push(`Summary: ${summary}`);
	}

	if (excerpt) {
		promptParts.push(`Excerpt: ${excerpt}`);
	}

	const { text: title } = await generateText({
		model: getTitleModel(),
		system: fileTitlePrompt,
		prompt: promptParts.join("\n"),
	});

	return title.trim() || filename;
}
