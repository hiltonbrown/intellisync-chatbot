import fs from 'node:fs';
import path from 'node:path';
import type { ChatModel } from './types';
import { DEFAULT_CHAT_MODEL } from './types';

export const getStaticModels = async (): Promise<ChatModel[]> => {
  try {
    const modelsPath = path.join(process.cwd(), 'models.txt');
    const content = fs.readFileSync(modelsPath, 'utf-8');
    const lines = content.trim().split('\n');
    const models: ChatModel[] = lines.map((line: string) => {
      const [id, rest] = line.split(': ');
      const [name, description] = rest.split(' - ');
      return { id, name, description };
    });
    return models;
  } catch (error) {
    console.error('Error loading preset models:', error);
    // Fallback to default models
    return [
      {
        id: DEFAULT_CHAT_MODEL,
        name: 'Llama 3.2 3B Instruct',
        description: 'Meta’s latest fast instruct-tuned model.',
      },
      {
        id: 'deepseek/deepseek-chat-v3.1:free',
        name: 'DeepSeek V3.1 (Free)',
        description: 'Hybrid reasoning model with long-context support.',
      },
      {
        id: 'google/gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Google’s balanced flagship chat model.',
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'OpenAI’s cost-efficient frontier model.',
      },
    ];
  }
};
