export const DEFAULT_CHAT_MODEL: string = 'meta-llama/llama-3.2-3b-instruct';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}
