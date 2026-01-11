import "server-only";

import { generateText } from "ai";
import { fileTitlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";

export async function generateTitleFromDocument({
	filename,
	summary,
}: {
	filename: string;
	summary?: string | null;
}) {
	const promptParts = [`Filename: ${filename}`];

	if (summary) {
		promptParts.push(`Summary: ${summary}`);
	}

	const { text: title } = await generateText({
		model: getTitleModel(),
		system: fileTitlePrompt,
		prompt: promptParts.join("\n"),
	});

	return title.trim() || filename;
}
