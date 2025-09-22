import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ChatModel } from './types';
import { DEFAULT_CHAT_MODEL } from './types';

export const getStaticModels = async (): Promise<ChatModel[]> => {
  try {
    const modelsPath = path.join(process.cwd(), 'models.txt');
    const content = fs.readFileSync(modelsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const models: ChatModel[] = lines.map((line: string) => {
      const trimmedLine = line.trim();

      // Check if line has the format "id: name - description"
      if (trimmedLine.includes(': ') && trimmedLine.includes(' - ')) {
        const [id, rest] = trimmedLine.split(': ');
        const [name, description] = rest.split(' - ');
        return { id: id.trim(), name: name.trim(), description: description.trim() };
      }

      // Otherwise, treat the line as just a model ID
      const id = trimmedLine;
      const name = generateDisplayName(id);
      const description = generateDescription(id);

      return { id, name, description };
    });

    return models;
  } catch (error) {
    console.error('Error loading preset models:', error);
    // Fallback to default models
    return [
      {
        id: DEFAULT_CHAT_MODEL,
        name: 'Gemini 2.5 Flash',
        description: 'Google balanced flagship chat model.',
      },
    ];
  }
};

function generateDisplayName(id: string): string {
  const parts = id.split('/');
  const modelName = parts[parts.length - 1];

  // Remove suffixes like ":free"
  const cleanName = modelName.split(':')[0];

  // Convert to human-readable format
  return cleanName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateDescription(id: string): string {
  const provider = id.split('/')[0];

  switch (provider) {
    case 'google':
      return 'Google AI model with excellent reasoning capabilities.';
    case 'anthropic':
      return 'Anthropic advanced conversational AI model.';
    case 'openai':
      return 'OpenAI powerful language model.';
    case 'meta-llama':
      return 'Meta open-source large language model.';
    case 'x-ai':
      return 'xAI fast and efficient AI model.';
    default:
      return 'Advanced AI language model.';
  }
}
