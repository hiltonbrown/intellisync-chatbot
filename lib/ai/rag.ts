import { embed, embedMany } from "ai";
import { isTestEnvironment } from "@/lib/constants";
import { getDocumentChunksByUserId } from "@/lib/db/queries";
import { getEmbeddingModel } from "./providers";

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 100;
// Default number of chunks to retrieve per query.
// 4 was chosen empirically as a balance between:
// - enough context to answer most questions, and
// - not overloading the model with too many chunks or diluting relevance.
// Increase for broader recall (more context, more noise), decrease for stricter, more focused answers.
const DEFAULT_TOP_K = 4;
// Minimum cosine similarity score required for a chunk to be considered relevant.
// 0.15 is a conservative lower bound that filters out clearly unrelated chunks
// while still favoring recall over strict precision. Raise this to require
// higher relevance (fewer but more on-topic chunks), or lower it to be more
// permissive in low-signal or sparse-data scenarios.
const DEFAULT_MIN_SCORE = 0.15;

const normalizeWhitespace = (value: string) =>
	value.replace(/\s+/g, " ").trim();

const toWordChunks = (text: string, chunkSize: number, overlap: number) => {
	const words = normalizeWhitespace(text).split(" ").filter(Boolean);
	if (words.length === 0) {
		return [];
	}

	const chunks: string[] = [];
	const stride = Math.max(chunkSize - overlap, 1);

	for (let start = 0; start < words.length; start += stride) {
		const slice = words.slice(start, start + chunkSize);
		if (slice.length === 0) {
			break;
		}
		chunks.push(slice.join(" "));
	}

	return chunks;
};

const createTestEmbedding = (value: string, dimensions = 64) => {
	if (!value.length) {
		return Array.from({ length: dimensions }, () => 0);
	}

	const embedding = Array.from({ length: dimensions }, () => 0);
	for (let index = 0; index < value.length; index += 1) {
		const bucket = index % dimensions;
		embedding[bucket] += value.charCodeAt(index) % 97;
	}
	return embedding.map((entry) => entry / value.length);
};

const isEmbeddingArray = (embedding: unknown): embedding is number[] =>
	Array.isArray(embedding) &&
	embedding.every((value) => typeof value === "number");

const cosineSimilarity = (a: number[], b: number[]) => {
	if (a.length !== b.length || a.length === 0) {
		return 0;
	}

	let dot = 0;
	let normA = 0;
	let normB = 0;

	for (let index = 0; index < a.length; index += 1) {
		const valueA = a[index];
		const valueB = b[index];
		dot += valueA * valueB;
		normA += valueA * valueA;
		normB += valueB * valueB;
	}

	if (!normA || !normB) {
		return 0;
	}

	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const chunkText = (
	text: string,
	options?: { chunkSize?: number; overlap?: number },
) =>
	toWordChunks(
		text,
		options?.chunkSize ?? DEFAULT_CHUNK_SIZE,
		options?.overlap ?? DEFAULT_CHUNK_OVERLAP,
	);

export const createEmbeddings = async (values: string[]) => {
	if (values.length === 0) {
		return [];
	}

	if (isTestEnvironment) {
		return values.map((value) => createTestEmbedding(value));
	}

	const { embeddings } = await embedMany({
		model: getEmbeddingModel(),
		values,
	});

	return embeddings;
};

export const createEmbedding = async (value: string) => {
	if (isTestEnvironment) {
		return createTestEmbedding(value);
	}

	const { embedding } = await embed({
		model: getEmbeddingModel(),
		value,
	});

	return embedding;
};

export const buildRagContext = async ({
	userId,
	chatId,
	query,
	topK = DEFAULT_TOP_K,
	minScore = DEFAULT_MIN_SCORE,
}: {
	userId: string;
	chatId?: string;
	query: string;
	topK?: number;
	minScore?: number;
}) => {
	const trimmedQuery = normalizeWhitespace(query);
	if (!trimmedQuery) {
		return {
			context: "",
			chunks: [] as Array<{ content: string; score: number }>,
		};
	}

	const chunks = await getDocumentChunksByUserId({ userId, chatId });
	if (chunks.length === 0) {
		return {
			context: "",
			chunks: [] as Array<{ content: string; score: number }>,
		};
	}

	const queryEmbedding = await createEmbedding(trimmedQuery);

	const scoredChunks = chunks
		.map((chunk) => {
			const embedding = isEmbeddingArray(chunk.embedding)
				? chunk.embedding
				: [];
			return {
				content: chunk.content,
				score: cosineSimilarity(queryEmbedding, embedding),
			};
		})
		.filter((chunk) => chunk.score >= minScore)
		.sort((a, b) => b.score - a.score)
		.slice(0, topK);

	const context = scoredChunks
		.map((chunk, index) => `Source ${index + 1}:\n${chunk.content}`)
		.join("\n\n");

	return { context, chunks: scoredChunks };
};
