import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage, ClerkSession } from '@/lib/types';
import type { ChatModel } from '../types';

export interface ToolContext {
  session: ClerkSession;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
  selectedModel: ChatModel['id'];
  providerClient: any; // Type from providers
}

export interface ToolDefinition {
  name: string;
  tool: any; // The actual tool function
  requiresContext?: boolean;
}
