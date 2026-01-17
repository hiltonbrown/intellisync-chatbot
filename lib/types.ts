import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getABNDetails } from "./ai/tools/get-abn-details";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { searchABNByName } from "./ai/tools/search-abn-by-name";
import type { updateDocument } from "./ai/tools/update-document";
import type { Chat, Suggestion } from "./db/schema";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
	createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type abnDetailsTool = InferUITool<typeof getABNDetails>;
type abnSearchTool = InferUITool<typeof searchABNByName>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
	ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
	getWeather: weatherTool;
	createDocument: createDocumentTool;
	updateDocument: updateDocumentTool;
	requestSuggestions: requestSuggestionsTool;
	getABNDetails?: abnDetailsTool;
	searchABNByName?: abnSearchTool;
};

export type CustomUIDataTypes = {
	textDelta: string;
	imageDelta: string;
	sheetDelta: string;
	codeDelta: string;
	suggestion: Suggestion;
	appendMessage: string;
	id: string;
	title: string;
	kind: ArtifactKind;
	chatId: string;
	clear: null;
	finish: null;
	"chat-title": string;
};

export type ChatMessage = UIMessage<
	MessageMetadata,
	CustomUIDataTypes,
	ChatTools
>;

export type Attachment = {
	name: string;
	url: string;
	contentType: string;
	documentId?: string; // For CSV/TSV files, includes the document ID to fetch full content
};

export type ChatHistoryItem = Chat & {
	hasDocument: boolean;
};
