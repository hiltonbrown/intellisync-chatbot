import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const DEFAULT_CHAT_MODEL: string = 'google/gemini-2.5-flash';

// Debug logging for OpenRouter configuration
console.log('OpenRouter: API key present:', !!process.env.OPENROUTER_API_KEY);
console.log('OpenRouter: Base URL env:', process.env.OPENROUTER_BASE_URL);
console.log('OpenRouter: App URL env:', process.env.NEXT_PUBLIC_APP_URL);

export const openrouter = createOpenRouter({
 apiKey: process.env.OPENROUTER_API_KEY,
 baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
 headers: {
 'HTTP-Referer':
 process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerbot.co',
 'X-Title': 'IntelliSync Chatbot',
 },
});

export interface ChatModel {
 id: string;
 name: string;
 description: string;
}

let cachedModels: ChatModel[] | null = null;
let lastFetchTime: number | null = null;

// Fetch and cache models from OpenRouter API
async function fetchAndCacheModels(): Promise<ChatModel[]> {
 const now = Date.now();
 // Cache for 1 hour
 if (cachedModels && lastFetchTime && now - lastFetchTime < 3600000) {
 return cachedModels;
 }

 try {
 const response = await fetch('https://openrouter.ai/api/v1/models');
 if (!response.ok) {
 throw new Error('Failed to fetch models from OpenRouter API');
 }
 const { data } = await response.json();
 cachedModels = data.map((model: any) => ({
 id: model.id,
 name: model.name,
 description: model.description,
 }));
 lastFetchTime = now;
 return cachedModels || [];
 } catch (error) {
 console.error('Error fetching or caching models:', error);
 // Return a default list if fetch fails
 return [
 {
 id: 'google/gemini-2.5-flash',
 name: 'Gemini 2.5 Flash',
 description: 'Default fallback model',
 },
 {
 id: 'openai/gpt-4o-mini',
 name: 'GPT-4o Mini',
 description: 'OpenAI fallback model',
 },
 ];
 }
}

export const getStaticModels = async (): Promise<ChatModel[]> => {
 return await fetchAndCacheModels();
};