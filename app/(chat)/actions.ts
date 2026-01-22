"use server";

import { auth } from "@clerk/nextjs/server";
import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import { fileTitlePrompt, titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import {
	deleteMessagesByChatIdAfterTimestamp,
	getChatById,
	getMessageById,
	updateChatVisibilityById,
} from "@/lib/db/queries";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
	const { userId } = await auth();

	if (!userId) {
		throw new Error("Unauthorized");
	}

	const cookieStore = await cookies();
	cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
	message,
}: {
	message: UIMessage;
}) {
	const { userId } = await auth();

	if (!userId) {
		throw new Error("Unauthorized");
	}

	const { text: title } = await generateText({
		model: getTitleModel(),
		system: titlePrompt,
		prompt: getTextFromMessage(message),
	});

	return title;
}

export async function generateTitleFromDocument({
	filename,
	kind,
	excerpt,
}: {
	filename: string;
	kind: "text" | "sheet" | "pdf" | "image";
	excerpt?: string | null;
}) {
	const { userId } = await auth();

	if (!userId) {
		throw new Error("Unauthorized");
	}

	const promptLines = [
		`Filename: ${filename}`,
		`Kind: ${kind}`,
		excerpt ? `Excerpt: ${excerpt}` : null,
	].filter(Boolean);

	const { text: title } = await generateText({
		model: getTitleModel(),
		system: fileTitlePrompt,
		prompt: promptLines.join("\n"),
	});

	return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
	const { userId } = await auth();

	if (!userId) {
		throw new Error("Unauthorized");
	}

	const [message] = await getMessageById({ id });

	const chat = message ? await getChatById({ id: message.chatId }) : null;

	if (!chat || chat.userId !== userId) {
		throw new Error("Forbidden");
	}

	await deleteMessagesByChatIdAfterTimestamp({
		chatId: message.chatId,
		timestamp: message.createdAt,
	});
}

export async function updateChatVisibility({
	chatId,
	visibility,
}: {
	chatId: string;
	visibility: VisibilityType;
}) {
	const { userId } = await auth();

	if (!userId) {
		throw new Error("Unauthorized");
	}

	const chat = await getChatById({ id: chatId });

	if (!chat || chat.userId !== userId) {
		throw new Error("Forbidden");
	}

	await updateChatVisibilityById({ chatId, visibility });
}
