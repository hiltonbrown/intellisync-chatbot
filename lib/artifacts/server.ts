import type { UIMessageStreamWriter } from "ai";
import { codeDocumentHandler } from "@/artifacts/code/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { ArtifactKind } from "@/components/artifact";
import { saveDocument } from "../db/queries";
import type { Document } from "../db/schema";
import type { ChatMessage } from "../types";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  textContent?: string | null;
  summary?: string | null;
  blobUrl?: string | null;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  description?: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  userId: string;
  chatId: string;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  userId: string;
  chatId: string;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<string>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        description: args.description,
        dataStream: args.dataStream,
        userId: args.userId,
        chatId: args.chatId,
      });

      if (args.userId) {
        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          textContent: draftContent,
          userId: args.userId,
          chatId: args.chatId,
        });
      }

      return draftContent;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        userId: args.userId,
        chatId: args.chatId,
      });

      if (args.userId) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          textContent: draftContent,
          userId: args.userId,
          chatId: args.chatId,
        });
      }

      return draftContent;
    },
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
