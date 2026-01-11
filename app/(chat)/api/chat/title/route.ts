import { auth } from "@clerk/nextjs/server";
import { generateTitleFromDocument } from "@/lib/ai/chat-title";
import { isPlaceholderChatTitle } from "@/lib/chat-title";
import {
	getChatById,
	getLatestDocumentByChatId,
	updateChatTitleById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request) {
	const { userId } = await auth();

	if (!userId) {
		return new ChatSDKError("unauthorized:chat").toResponse();
	}

	const { chatId } = (await request.json()) as { chatId?: string };

	if (!chatId) {
		return new ChatSDKError(
			"bad_request:api",
			"Parameter chatId is required.",
		).toResponse();
	}

	const chat = await getChatById({ id: chatId });

	if (!chat) {
		return new ChatSDKError("not_found:chat").toResponse();
	}

	if (chat.userId !== userId) {
		return new ChatSDKError("forbidden:chat").toResponse();
	}

	if (!isPlaceholderChatTitle(chat.title)) {
		return Response.json({ title: chat.title });
	}

	const document = await getLatestDocumentByChatId({ chatId });

	if (!document) {
		return new ChatSDKError("not_found:document").toResponse();
	}

	const title = await generateTitleFromDocument({
		filename: document.title,
		summary: document.summary,
	});

	await updateChatTitleById({ chatId, title });

	return Response.json({ title });
}
