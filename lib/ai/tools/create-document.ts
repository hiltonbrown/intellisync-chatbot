import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  userId: string;
  chatId: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const createDocument = ({
  userId,
  chatId,
  dataStream,
}: CreateDocumentProps) =>
  tool({
    description:
      "Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
      description: z
        .string()
        .optional()
        .describe("A detailed description of what should be in the document"),
    }),
    execute: async ({ title, kind, description }) => {
      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-chatId",
        data: chatId,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      const content = await documentHandler.onCreateDocument({
        id,
        title,
        description,
        dataStream,
        userId,
        chatId,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind,
        content,
      };
    },
  });
