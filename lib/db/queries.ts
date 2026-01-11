import "server-only";

import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	inArray,
	lt,
	type SQL,
	sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import type { ChatHistoryItem } from "../types";
import { generateUUID, isValidClerkUserId } from "../utils";
import {
	type Chat,
	chat,
	type DBMessage,
	type Document,
	document,
	documentChunk,
	message,
	type Suggestion,
	stream,
	suggestion,
	type User,
	user,
	vote,
} from "./schema";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// PostgreSQL error code for unique constraint violations
const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function verifyUser({ id, email }: { id: string; email: string }) {
	// Validate Clerk user ID format
	if (!isValidClerkUserId(id)) {
		throw new ChatSDKError(
			"bad_request:auth",
			"Invalid user ID format. Expected Clerk user ID.",
		);
	}

	// Validate email is not empty
	if (!email || email.trim() === "") {
		throw new ChatSDKError(
			"bad_request:auth",
			"User email is required for verification.",
		);
	}

	try {
		await db.insert(user).values({ id, email }).onConflictDoNothing();
	} catch (error) {
		// PostgreSQL error code 23505 = unique_violation (user already exists)
		// This is expected and safe to ignore
		const isUniqueViolation =
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === POSTGRES_UNIQUE_VIOLATION;

		if (!isUniqueViolation) {
			console.error("Failed to verify user:", {
				userId: id,
				email,
				errorCode:
					error && typeof error === "object" && "code" in error
						? error.code
						: "unknown",
				errorMessage: error instanceof Error ? error.message : String(error),
			});
			throw new ChatSDKError(
				"bad_request:database",
				"User verification failed. Please ensure you are properly authenticated.",
			);
		}
	}
}

export async function saveChat({
	id,
	userId,
	title,
	visibility,
}: {
	id: string;
	userId: string;
	title: string;
	visibility: VisibilityType;
}) {
	try {
		return await db.insert(chat).values({
			id,
			createdAt: new Date(),
			userId,
			title,
			visibility,
		});
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to save chat");
	}
}

export async function deleteChatById({ id }: { id: string }) {
	try {
		await db.delete(vote).where(eq(vote.chatId, id));
		await db.delete(message).where(eq(message.chatId, id));
		await db.delete(stream).where(eq(stream.chatId, id));

		// Delete documents and related data
		const documents = await db
			.select({ id: document.id })
			.from(document)
			.where(eq(document.chatId, id));

		if (documents.length > 0) {
			const documentIds = documents.map((d) => d.id);
			await db
				.delete(suggestion)
				.where(inArray(suggestion.documentId, documentIds));
		}

		await db.delete(documentChunk).where(eq(documentChunk.chatId, id));
		await db.delete(document).where(eq(document.chatId, id));

		const [chatsDeleted] = await db
			.delete(chat)
			.where(eq(chat.id, id))
			.returning();
		return chatsDeleted;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete chat by id",
		);
	}
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
	try {
		const userChats = await db
			.select({ id: chat.id })
			.from(chat)
			.where(eq(chat.userId, userId));

		if (userChats.length === 0) {
			return { deletedCount: 0 };
		}

		const chatIds = userChats.map((c) => c.id);

		await db.delete(vote).where(inArray(vote.chatId, chatIds));
		await db.delete(message).where(inArray(message.chatId, chatIds));
		await db.delete(stream).where(inArray(stream.chatId, chatIds));

		// Delete all user documents and related data
		// Since we are deleting ALL chats for the user, we can safely delete all their documents/chunks/suggestions
		await db.delete(suggestion).where(eq(suggestion.userId, userId));
		await db.delete(documentChunk).where(eq(documentChunk.userId, userId));
		await db.delete(document).where(eq(document.userId, userId));

		const deletedChats = await db
			.delete(chat)
			.where(eq(chat.userId, userId))
			.returning();

		return { deletedCount: deletedChats.length };
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete all chats by user id",
		);
	}
}

export async function getChatsByUserId({
	id,
	limit,
	startingAfter,
	endingBefore,
}: {
	id: string;
	limit: number;
	startingAfter: string | null;
	endingBefore: string | null;
}) {
	try {
		const extendedLimit = limit + 1;
		const chatColumns = {
			id: chat.id,
			createdAt: chat.createdAt,
			title: chat.title,
			userId: chat.userId,
			visibility: chat.visibility,
		};

		const query = (whereCondition?: SQL<any>) =>
			db
				.select({
					...chatColumns,
					hasDocument: sql<boolean>`exists (select 1 from ${document} where ${document.chatId} = ${chat.id})`,
				})
				.from(chat)
				.where(
					whereCondition
						? and(whereCondition, eq(chat.userId, id))
						: eq(chat.userId, id),
				)
				.orderBy(desc(chat.createdAt))
				.limit(extendedLimit);

		let filteredChats: ChatHistoryItem[] = [];

		if (startingAfter) {
			const [selectedChat] = await db
				.select()
				.from(chat)
				.where(eq(chat.id, startingAfter))
				.limit(1);

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${startingAfter} not found`,
				);
			}

			filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
		} else if (endingBefore) {
			const [selectedChat] = await db
				.select()
				.from(chat)
				.where(eq(chat.id, endingBefore))
				.limit(1);

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${endingBefore} not found`,
				);
			}

			filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
		} else {
			filteredChats = await query();
		}

		const hasMore = filteredChats.length > limit;

		return {
			chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
			hasMore,
		};
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get chats by user id",
		);
	}
}

export async function getLatestDocumentByChatId({
	chatId,
}: {
	chatId: string;
}) {
	try {
		const [selectedDocument] = await db
			.select()
			.from(document)
			.where(eq(document.chatId, chatId))
			.orderBy(desc(document.createdAt))
			.limit(1);

		return selectedDocument ?? null;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get document by chat id",
		);
	}
}

export async function getChatById({ id }: { id: string }) {
	try {
		const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
		if (!selectedChat) {
			return null;
		}

		return selectedChat;
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
	}
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
	try {
		return await db.insert(message).values(messages);
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to save messages");
	}
}

export async function updateMessage({
	id,
	parts,
}: {
	id: string;
	parts: DBMessage["parts"];
}) {
	try {
		return await db.update(message).set({ parts }).where(eq(message.id, id));
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to update message");
	}
}

export async function getMessagesByChatId({ id }: { id: string }) {
	try {
		return await db
			.select()
			.from(message)
			.where(eq(message.chatId, id))
			.orderBy(asc(message.createdAt));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get messages by chat id",
		);
	}
}

export async function voteMessage({
	chatId,
	messageId,
	type,
}: {
	chatId: string;
	messageId: string;
	type: "up" | "down";
}) {
	try {
		const [existingVote] = await db
			.select()
			.from(vote)
			.where(and(eq(vote.messageId, messageId)));

		if (existingVote) {
			return await db
				.update(vote)
				.set({ isUpvoted: type === "up" })
				.where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
		}
		return await db.insert(vote).values({
			chatId,
			messageId,
			isUpvoted: type === "up",
		});
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to vote message");
	}
}

export async function getVotesByChatId({ id }: { id: string }) {
	try {
		return await db.select().from(vote).where(eq(vote.chatId, id));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get votes by chat id",
		);
	}
}

export async function saveDocument({
	id,
	title,
	kind,
	content,
	textContent,
	summary,
	blobUrl,
	userId,
	chatId,
}: {
	id: string;
	title: string;
	kind: Document["kind"];
	content: string;
	textContent?: string | null;
	summary?: string | null;
	blobUrl?: string | null;
	userId: string;
	chatId: string;
}) {
	try {
		const resolvedTextContent = textContent ?? content ?? null;

		return await db
			.insert(document)
			.values({
				id,
				title,
				kind,
				content,
				textContent: resolvedTextContent,
				summary,
				blobUrl,
				userId,
				chatId,
				createdAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [document.id, document.createdAt],
				set: {
					title,
					content,
					kind,
					chatId,
					textContent: resolvedTextContent,
					summary,
					blobUrl,
				},
			})
			.returning();
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to save document");
	}
}

export async function saveDocumentChunks({
	chunks,
}: {
	chunks: Array<typeof documentChunk.$inferInsert>;
}) {
	try {
		return await db.insert(documentChunk).values(chunks).returning();
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to save document chunks",
		);
	}
}

export async function getDocumentChunksByUserId({
	userId,
	chatId,
}: {
	userId: string;
	chatId?: string;
}) {
	try {
		if (chatId) {
			return await db
				.select()
				.from(documentChunk)
				.where(
					and(
						eq(documentChunk.userId, userId),
						eq(documentChunk.chatId, chatId),
					),
				);
		}

		return await db
			.select()
			.from(documentChunk)
			.where(eq(documentChunk.userId, userId));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get document chunks by user id",
		);
	}
}

export async function deleteDocumentChunksByArtifactId({
	artifactId,
	userId,
	chatId,
}: {
	artifactId: string;
	userId: string;
	chatId: string;
}) {
	try {
		return await db
			.delete(documentChunk)
			.where(
				and(
					eq(documentChunk.artifactId, artifactId),
					eq(documentChunk.userId, userId),
					eq(documentChunk.chatId, chatId),
				),
			)
			.returning();
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete document chunks by artifact id",
		);
	}
}

export async function getDocumentsById({ id }: { id: string }) {
	try {
		const documents = await db
			.select()
			.from(document)
			.where(eq(document.id, id))
			.orderBy(asc(document.createdAt));

		return documents;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get documents by id",
		);
	}
}

export async function getDocumentById({ id }: { id: string }) {
	try {
		const [selectedDocument] = await db
			.select()
			.from(document)
			.where(eq(document.id, id))
			.orderBy(desc(document.createdAt));

		return selectedDocument;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get document by id",
		);
	}
}

export async function deleteDocumentsByIdAfterTimestamp({
	id,
	timestamp,
}: {
	id: string;
	timestamp: Date;
}) {
	try {
		await db
			.delete(suggestion)
			.where(
				and(
					eq(suggestion.documentId, id),
					gt(suggestion.documentCreatedAt, timestamp),
				),
			);

		return await db
			.delete(document)
			.where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
			.returning();
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete documents by id after timestamp",
		);
	}
}

export async function saveSuggestions({
	suggestions,
}: {
	suggestions: Suggestion[];
}) {
	try {
		return await db.insert(suggestion).values(suggestions);
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to save suggestions",
		);
	}
}

export async function getSuggestionsByDocumentId({
	documentId,
}: {
	documentId: string;
}) {
	try {
		return await db
			.select()
			.from(suggestion)
			.where(eq(suggestion.documentId, documentId));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get suggestions by document id",
		);
	}
}

export async function getMessageById({ id }: { id: string }) {
	try {
		return await db.select().from(message).where(eq(message.id, id));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get message by id",
		);
	}
}

export async function deleteMessagesByChatIdAfterTimestamp({
	chatId,
	timestamp,
}: {
	chatId: string;
	timestamp: Date;
}) {
	try {
		const messagesToDelete = await db
			.select({ id: message.id })
			.from(message)
			.where(
				and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
			);

		const messageIds = messagesToDelete.map(
			(currentMessage) => currentMessage.id,
		);

		if (messageIds.length > 0) {
			await db
				.delete(vote)
				.where(
					and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
				);

			return await db
				.delete(message)
				.where(
					and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
				);
		}
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete messages by chat id after timestamp",
		);
	}
}

export async function updateChatVisibilityById({
	chatId,
	visibility,
}: {
	chatId: string;
	visibility: "private" | "public";
}) {
	try {
		return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to update chat visibility by id",
		);
	}
}

export async function updateChatTitleById({
	chatId,
	title,
}: {
	chatId: string;
	title: string;
}) {
	try {
		return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
	} catch (error) {
		console.warn("Failed to update title for chat", chatId, error);
		return;
	}
}

export async function getMessageCountByUserId({
	id,
	differenceInHours,
}: {
	id: string;
	differenceInHours: number;
}) {
	try {
		const twentyFourHoursAgo = new Date(
			Date.now() - differenceInHours * 60 * 60 * 1000,
		);

		const [stats] = await db
			.select({ count: count(message.id) })
			.from(message)
			.innerJoin(chat, eq(message.chatId, chat.id))
			.where(
				and(
					eq(chat.userId, id),
					gte(message.createdAt, twentyFourHoursAgo),
					eq(message.role, "user"),
				),
			)
			.execute();

		return stats?.count ?? 0;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get message count by user id",
		);
	}
}

export async function createStreamId({
	streamId,
	chatId,
}: {
	streamId: string;
	chatId: string;
}) {
	try {
		await db
			.insert(stream)
			.values({ id: streamId, chatId, createdAt: new Date() });
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to create stream id",
		);
	}
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
	try {
		const streamIds = await db
			.select({ id: stream.id })
			.from(stream)
			.where(eq(stream.chatId, chatId))
			.orderBy(asc(stream.createdAt))
			.execute();

		return streamIds.map(({ id }) => id);
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get stream ids by chat id",
		);
	}
}

export async function getUserById({ id }: { id: string }) {
	try {
		const [selectedUser] = await db.select().from(user).where(eq(user.id, id));
		return selectedUser || null;
	} catch (error) {
		console.error("Error getting user by id:", error);
		throw new ChatSDKError("bad_request:database", "Failed to get user by id");
	}
}

export async function updateUserSystemPrompt({
	id,
	systemPrompt,
}: {
	id: string;
	systemPrompt: string | null;
}) {
	try {
		return await db.update(user).set({ systemPrompt }).where(eq(user.id, id));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to update user system prompt",
		);
	}
}

export async function getSystemPromptByUserId({ id }: { id: string }) {
	try {
		const [selectedUser] = await db
			.select({ systemPrompt: user.systemPrompt })
			.from(user)
			.where(eq(user.id, id));
		return selectedUser?.systemPrompt || null;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get system prompt by user id",
		);
	}
}
