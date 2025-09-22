import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { DEFAULT_CHAT_MODEL, type ChatModel } from './types';

// Debug logging for OpenRouter configuration
console.log('OpenRouter: API key present:', !!process.env.OPENROUTER_API_KEY);
console.log('OpenRouter: Base URL env:', process.env.OPENROUTER_BASE_URL);
console.log('OpenRouter: App URL env:', process.env.NEXT_PUBLIC_APP_URL);

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerbot.co',
    'X-Title': 'IntelliSync Chatbot',
  },
});

export { DEFAULT_CHAT_MODEL, type ChatModel };
