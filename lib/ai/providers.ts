import {
  customProvider,
} from 'ai';
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
          'google/gemini-flash-1.5': chatModel,
          'meta-llama/llama-3.1-8b-instruct': chatModel,
          'mistralai/mistral-large-latest': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : openrouter;
