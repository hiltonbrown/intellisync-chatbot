import type { UIMessageStreamWriter } from 'ai';
import type { ZodTypeAny } from 'zod';
import type { ChatMessage, ClerkSession } from '@/lib/types';
import type { ChatModel } from '../types';

export interface ToolContext {
  session: ClerkSession;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
  selectedModel: ChatModel['id'];
  providerClient: any; // Type from providers
}

export type ToolFieldDefinition =
  | ({
      type: 'text';
      inputType?: 'text' | 'email' | 'number';
      placeholder?: string;
      defaultValue?: string;
    } & ToolFieldBase)
  | ({
      type: 'textarea';
      placeholder?: string;
      rows?: number;
      defaultValue?: string;
    } & ToolFieldBase)
  | ({
      type: 'select';
      options: Array<{ label: string; value: string }>;
      placeholder?: string;
      defaultValue?: string;
    } & ToolFieldBase)
  | ({
      type: 'checkbox';
      description?: string;
      defaultValue?: boolean;
    } & ToolFieldBase)
  | ({
      type: 'tags';
      description?: string;
      placeholder?: string;
      defaultValue?: Array<string>;
    } & ToolFieldBase);

export interface ToolUIConfiguration {
  fields: Array<ToolFieldDefinition>;
  submitLabel?: string;
}

interface ToolFieldBase {
  name: string;
  label: string;
  helperText?: string;
  required?: boolean;
}

export type ToolRuntimeName =
  | 'getWeather'
  | 'createDocument'
  | 'updateDocument'
  | 'requestSuggestions'
  | 'analyzeEmailFraud';

export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  inputSchema: ZodTypeAny;
  requiresContext?: boolean;
  runtime: ToolRuntimeName;
  ui: ToolUIConfiguration;
}
