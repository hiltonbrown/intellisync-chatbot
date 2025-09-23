import { getWeather } from './get-weather';
import { createDocument } from './create-document';
import { updateDocument } from './update-document';
import { requestSuggestions } from './request-suggestions';
import { analyzeEmailFraud } from './analyze-email-fraud';
import { toolDefinitions } from './definitions';
import type { ToolContext, ToolRuntimeName } from './types';

const runtimeFactories: Record<ToolRuntimeName, (context: ToolContext) => any> = {
  getWeather: () => getWeather,
  createDocument: (context) => createDocument(context),
  updateDocument: (context) => updateDocument(context),
  requestSuggestions: (context) => requestSuggestions(context),
  analyzeEmailFraud: (context) => analyzeEmailFraud(context),
};

export { toolDefinitions };

export function createToolRegistry(
  context: ToolContext,
): Record<string, any> {
  return toolDefinitions.reduce<Record<string, any>>((registry, definition) => {
    registry[definition.name] = runtimeFactories[definition.runtime](context);
    return registry;
  }, {});
}
