import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const DEFAULT_CHAT_MODEL: string = 'openai/gpt-4o-mini';

// Debug logging for OpenRouter configuration
console.log('OpenRouter: API key present:', !!process.env.OPENROUTER_API_KEY);
console.log('OpenRouter: Base URL env:', process.env.OPENROUTER_BASE_URL);
console.log('OpenRouter: App URL env:', process.env.NEXT_PUBLIC_APP_URL);

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  headers: {
    'HTTP-Referer':
      process.env.NEXT_PUBLIC_APP_URL || 'https://app.intellisync.com.au',
    'X-Title': 'IntelliSync Chatbot',
  },
});

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

const FALLBACK_CHAT_MODELS: ChatModel[] = [
  {
    id: DEFAULT_CHAT_MODEL,
    name: 'GPT-4o Mini',
    description: 'Default fallback model (OpenRouter)',
  },
];

let cachedModels: ChatModel[] | null = null;
let lastFetchTime: number | null = null;

function getModelsEndpoint(): string {
  const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  return `${baseURL.replace(/\/$/, '')}/models`;
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'HTTP-Referer':
      process.env.NEXT_PUBLIC_APP_URL || 'https://app.intellisync.com.au',
    'X-Title': 'IntelliSync Chatbot',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

const SKIP_MODEL_PATTERNS = ['embed', 'embedding', 'rerank', 'moderation'];

async function requestModelsFromOpenRouter(): Promise<ChatModel[]> {
  if (typeof window !== 'undefined') {
    return FALLBACK_CHAT_MODELS;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('OpenRouter API key is not configured. Using fallback models.');
    return [];
  }

  try {
    const response = await fetch(getModelsEndpoint(), {
      headers: buildHeaders(apiKey),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from OpenRouter API (${response.status})`);
    }

    const payload = (await response.json()) as { data?: unknown };

    if (!payload || !Array.isArray(payload.data)) {
      console.warn('Unexpected OpenRouter models payload:', payload);
      return [];
    }

    return (
      payload.data
        .map((raw) => {
          if (!raw || typeof raw !== 'object') {
            return null;
          }

          const {
            id,
            name,
            description,
          } = raw as {
            id?: unknown;
            name?: unknown;
            description?: unknown;
          };

          if (typeof id !== 'string') {
            return null;
          }

          const lowerId = id.toLowerCase();

          if (SKIP_MODEL_PATTERNS.some((pattern) => lowerId.includes(pattern))) {
            return null;
          }

          const resolvedName =
            typeof name === 'string' && name.trim().length > 0
              ? name.trim()
              : id;

          const resolvedDescription =
            typeof description === 'string' && description.trim().length > 0
              ? description.trim()
              : 'OpenRouter model';

          return {
            id,
            name: resolvedName,
            description: resolvedDescription,
          } satisfies ChatModel;
        })
        .filter((model): model is ChatModel => model !== null)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        )
    );
  } catch (error) {
    console.error('Error fetching models from OpenRouter:', error);
    return [];
  }
}

// Fetch and cache models from OpenRouter API
async function fetchAndCacheModels(): Promise<ChatModel[]> {
  if (typeof window !== 'undefined') {
    return FALLBACK_CHAT_MODELS;
  }

  const now = Date.now();

  if (cachedModels && lastFetchTime && now - lastFetchTime < CACHE_DURATION_MS) {
    return cachedModels;
  }

  const models = await requestModelsFromOpenRouter();

  if (models.length > 0) {
    cachedModels = models;
    lastFetchTime = now;
    return models;
  }

  if (cachedModels) {
    return cachedModels;
  }

  cachedModels = FALLBACK_CHAT_MODELS;
  lastFetchTime = now;
  return FALLBACK_CHAT_MODELS;
}

export const getStaticModels = async (): Promise<ChatModel[]> => {
  return await fetchAndCacheModels();
};
