import { z } from 'zod';
import type { getWeather } from './ai/tools/get-weather';
import type { createDocument } from './ai/tools/create-document';
import type { updateDocument } from './ai/tools/update-document';
import type { requestSuggestions } from './ai/tools/request-suggestions';
import type { analyzeEmailFraud } from './ai/tools/analyze-email-fraud';
import type { InferUITool, LanguageModelUsage, UIMessage } from 'ai';
import type { UserType } from '@/lib/ai/entitlements';

import type { ArtifactKind } from '@/components/artifact';
import type { Suggestion } from './db/schema';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type analyzeEmailFraudTool = InferUITool<
  ReturnType<typeof analyzeEmailFraud>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  analyzeEmailFraud: analyzeEmailFraudTool;
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
  clear: null;
  finish: null;
  usage: LanguageModelUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

// Clerk session type for compatibility with components
export interface ClerkSession {
  userId: string;
  user?: {
    id: string;
    type?: UserType;
    creditLimit?: number;
    currentUsage?: number;
  };
  expires?: string;
}

export type UsageWithCost = LanguageModelUsage & {
  provider?: 'openrouter';
  cost?: number;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  currency?: string;
  creditLimit?: number;
  currentUsage?: number;
  remainingCredits?: number;
};
