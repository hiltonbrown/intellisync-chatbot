import { getWeather } from './get-weather';
import { createDocument } from './create-document';
import { updateDocument } from './update-document';
import { requestSuggestions } from './request-suggestions';
import { analyzeEmailFraud } from './analyze-email-fraud';
import type { ToolContext, ToolDefinition } from './types';

export function createToolRegistry(context: ToolContext): Record<string, any> {
  const tools: Record<string, any> = {
    getWeather,
    createDocument: createDocument(context),
    updateDocument: updateDocument(context),
    requestSuggestions: requestSuggestions(context),
    analyzeEmailFraud: analyzeEmailFraud(context),
  };

  return tools;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'getWeather',
    tool: getWeather,
    requiresContext: false,
  },
  {
    name: 'createDocument',
    tool: null, // Will be created with context
    requiresContext: true,
  },
  {
    name: 'updateDocument',
    tool: null, // Will be created with context
    requiresContext: true,
  },
  {
    name: 'requestSuggestions',
    tool: null, // Will be created with context
    requiresContext: true,
  },
];
