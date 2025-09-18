import { openrouter } from './models';
import type { LanguageModel } from 'ai';

export function getModel(modelId?: string): LanguageModel {
  const selectedModel =
    modelId || process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';

  if (!selectedModel) {
    throw new Error(
      'No model specified in API route or environment variables.',
    );
  }

  // Pass the model ID directly to the OpenRouter provider
  return openrouter(selectedModel);
}
