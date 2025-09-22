import { customProvider } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { openrouter } from './models';
import { isTestEnvironment } from '../constants';

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require('./models.mock');
      return customProvider({
        languageModels: {
          'meta-llama/llama-3.2-3b-instruct': chatModel,
          'meta-llama/llama-3.3-8b-instruct:free': chatModel,
          'mistralai/mistral-small-3.1-24b-instruct:free': reasoningModel,
          'deepseek/deepseek-chat-v3.1:free': chatModel,
          'deepseek/deepseek-r1-distill-llama-70b:free': reasoningModel,
          'openai/gpt-4o-mini': chatModel,
          'google/gemini-2.5-flash': chatModel,
          'qwen/qwen3-next-80b-a3b-instruct': reasoningModel,
          'openai/gpt-oss-120b:free': chatModel, // Backward compatibility for stored preferences
          'google/gemini-flash-1.5': chatModel, // Legacy support
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : openrouter;

export const createUserProvider = (apiKey: string) => {
  if (isTestEnvironment) {
    return myProvider;
  }

  return createOpenRouter({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerbot.co',
      'X-Title': 'IntelliSync Chatbot',
    },
  });
};
