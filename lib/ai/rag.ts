import { createHash } from "node:crypto";

export type ChunkTextOptions = {
  maxChunkLength?: number;
  overlap?: number;
};

const DEFAULT_MAX_CHUNK_LENGTH = 1200;
const DEFAULT_OVERLAP = 0;

export function chunkText(
  text: string,
  options: ChunkTextOptions = {}
): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const maxChunkLength = options.maxChunkLength ?? DEFAULT_MAX_CHUNK_LENGTH;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const words = trimmed.split(/\s+/);
  const chunks: string[] = [];
  let currentWords: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    const nextLength = currentLength + word.length + 1;
    if (currentLength > 0 && nextLength > maxChunkLength) {
      const chunk = currentWords.join(" ").trim();
      if (chunk) {
        chunks.push(chunk);
      }

      if (overlap > 0) {
        const overlapWordCount = Math.max(1, Math.floor(overlap / 4));
        const overlapWords = currentWords.slice(-overlapWordCount);
        currentWords = [...overlapWords];
        let newLength = 0;
        for (const w of currentWords) {
          newLength += w.length + 1;
        }
        currentLength = newLength;
      } else {
        currentWords = [];
        currentLength = 0;
      }
    }

    currentWords.push(word);
    currentLength += word.length + 1;
  }

  const lastChunk = currentWords.join(" ").trim();
  if (lastChunk) {
    chunks.push(lastChunk);
  }

  return chunks;
}

export async function createEmbeddings(chunks: string[]): Promise<number[][]> {
  return chunks.map((chunk) => {
    const digest = createHash("sha256").update(chunk).digest();
    return Array.from(digest, (byte) => byte / 255);
  });
}
