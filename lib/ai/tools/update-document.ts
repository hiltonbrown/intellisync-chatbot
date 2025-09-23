import { tool } from 'ai';
import { getDocumentById } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import type { ToolContext } from './types';
import { updateDocumentInputSchema } from './schemas';

export const updateDocument = ({ session, dataStream }: ToolContext) =>
  tool({
    description: 'Update a document with the given description.',
    inputSchema: updateDocumentInputSchema,
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
      });

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
