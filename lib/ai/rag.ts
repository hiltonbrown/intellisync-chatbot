export type RagChunk = {
  id: string;
  content: string;
  documentId: string;
  userId: string;
  chatId?: string | null;
};

export type RagDocument = {
  id: string;
  summary?: string | null;
  userId: string;
  chatId?: string | null;
};

type BuildRagContextParams = {
  chunks: RagChunk[];
  documents: RagDocument[];
  userId: string;
  chatId?: string | null;
};

export function buildRagContext({
  chunks,
  documents,
  userId,
  chatId,
}: BuildRagContextParams): string {
  const scopedChunks = chunks.filter((chunk) => {
    if (chunk.userId !== userId) {
      return false;
    }

    if (chatId) {
      return chunk.chatId === chatId;
    }

    return true;
  });

  const scopedDocuments = documents.filter((document) => {
    if (document.userId !== userId) {
      return false;
    }

    if (chatId) {
      return document.chatId === chatId;
    }

    return true;
  });

  const documentsById = new Map(
    scopedDocuments.map((document) => [document.id, document])
  );

  const contextParts: string[] = ["DOCUMENT CONTEXT"];
  const documentsWithSummary = new Set<string>();

  for (const chunk of scopedChunks) {
    const document = documentsById.get(chunk.documentId);
    const summary = document?.summary?.trim();

    if (summary && !documentsWithSummary.has(chunk.documentId)) {
      contextParts.push(`Summary (${chunk.documentId}): ${summary}`);
      documentsWithSummary.add(chunk.documentId);
    }

    const trimmedContent = chunk.content.trim();
    if (trimmedContent) {
      contextParts.push(trimmedContent);
    }
  }

  return contextParts.join("\n\n");
}
