import { customProvider } from 'ai';
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
          'google/gemini-flash-1.5': chatModel, // Legacy support
          'openai/gpt-4o-mini': chatModel,
          'mistralai/mistral-large': reasoningModel,
          'openai/gpt-oss-120b:free': chatModel,
          'meta-llama/llama-4-maverick:free': chatModel,
          'google/gemma-3-27b-it:free': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : openrouter;
