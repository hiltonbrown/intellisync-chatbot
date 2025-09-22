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
          'google/gemini-2.5-flash': chatModel,
          'anthropic/claude-sonnet-4': chatModel,
          'openai/gpt-5-mini': chatModel,
          'openai/gpt-5': chatModel,
          'meta-llama/llama-4-maverick:free': chatModel,
          'meta-llama/llama-4-maverick': chatModel,
          'x-ai/grok-4-fast:free': chatModel,
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
