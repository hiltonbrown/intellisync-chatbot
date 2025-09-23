import {
  analyzeEmailFraudInputSchema,
  createDocumentInputSchema,
  getWeatherInputSchema,
  requestSuggestionsInputSchema,
  updateDocumentInputSchema,
} from './schemas';
import type { ToolDefinition } from './types';

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const toolDefinitions: Array<ToolDefinition> = [
  {
    name: 'getWeather',
    label: 'Get weather',
    description: 'Fetch live weather details for a set of coordinates.',
    inputSchema: getWeatherInputSchema,
    runtime: 'getWeather',
    ui: {
      submitLabel: 'Fetch weather',
      fields: [
        {
          type: 'text',
          name: 'latitude',
          label: 'Latitude',
          inputType: 'number',
          placeholder: '-28.0167',
          required: true,
        },
        {
          type: 'text',
          name: 'longitude',
          label: 'Longitude',
          inputType: 'number',
          placeholder: '153.4307',
          required: true,
        },
      ],
    },
  },
  {
    name: 'createDocument',
    label: 'Create document',
    description: 'Spin up a new artifact using AI drafting helpers.',
    inputSchema: createDocumentInputSchema,
    runtime: 'createDocument',
    requiresContext: true,
    ui: {
      submitLabel: 'Create document',
      fields: [
        {
          type: 'text',
          name: 'title',
          label: 'Title',
          placeholder: 'Quarterly roadmap',
          required: true,
        },
        {
          type: 'select',
          name: 'kind',
          label: 'Document kind',
          required: true,
          options: createDocumentInputSchema.shape.kind.options.map((kind) => ({
            label: titleCase(kind),
            value: kind,
          })),
        },
      ],
    },
  },
  {
    name: 'updateDocument',
    label: 'Update document',
    description: 'Apply AI-authored edits to an existing artifact.',
    inputSchema: updateDocumentInputSchema,
    runtime: 'updateDocument',
    requiresContext: true,
    ui: {
      submitLabel: 'Update document',
      fields: [
        {
          type: 'text',
          name: 'id',
          label: 'Document ID',
          placeholder: 'doc_123',
          required: true,
        },
        {
          type: 'textarea',
          name: 'description',
          label: 'Change description',
          placeholder: 'Describe what should change or improve…',
          rows: 4,
          required: true,
        },
      ],
    },
  },
  {
    name: 'requestSuggestions',
    label: 'Request suggestions',
    description: 'Stream inline revision ideas for a saved document.',
    inputSchema: requestSuggestionsInputSchema,
    runtime: 'requestSuggestions',
    requiresContext: true,
    ui: {
      submitLabel: 'Request suggestions',
      fields: [
        {
          type: 'text',
          name: 'documentId',
          label: 'Document ID',
          placeholder: 'doc_123',
          required: true,
        },
      ],
    },
  },
  {
    name: 'analyzeEmailFraud',
    label: 'Analyze email fraud',
    description: 'Review a suspicious email with phased fraud detection.',
    inputSchema: analyzeEmailFraudInputSchema,
    runtime: 'analyzeEmailFraud',
    requiresContext: true,
    ui: {
      submitLabel: 'Analyze email',
      fields: [
        {
          type: 'text',
          name: 'senderEmail',
          label: 'Sender email',
          inputType: 'email',
          placeholder: 'alerts@bank.com',
          required: true,
        },
        {
          type: 'text',
          name: 'senderName',
          label: 'Sender name',
          placeholder: 'Bank Security Team',
          required: true,
        },
        {
          type: 'text',
          name: 'subject',
          label: 'Email subject',
          placeholder: 'Your account requires verification',
          required: true,
        },
        {
          type: 'textarea',
          name: 'emailBody',
          label: 'Email body',
          placeholder: 'Paste the suspicious email content here…',
          rows: 6,
          required: true,
        },
        {
          type: 'textarea',
          name: 'receivedHeaders',
          label: 'Received headers',
          placeholder: 'Paste raw header information (optional)',
        },
        {
          type: 'tags',
          name: 'links',
          label: 'Links',
          helperText: 'Add any URLs found in the email.',
          placeholder: 'https://example.com/login',
        },
        {
          type: 'checkbox',
          name: 'hasAttachments',
          label: 'Email includes attachments?',
          defaultValue: false,
        },
        {
          type: 'tags',
          name: 'userFlags',
          label: 'User observations',
          helperText: 'List any red flags or context you noticed.',
        },
        {
          type: 'select',
          name: 'urgencyLevel',
          label: 'Urgency level',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
          ],
          placeholder: 'Select a level (optional)',
        },
        {
          type: 'checkbox',
          name: 'requestsPersonalInfo',
          label: 'Requests personal information?',
          defaultValue: false,
        },
        {
          type: 'select',
          name: 'analysisDepth',
          label: 'Analysis depth',
          options: [
            { label: 'Basic', value: 'basic' },
            { label: 'Detailed', value: 'detailed' },
            { label: 'Comprehensive', value: 'comprehensive' },
          ],
          defaultValue: 'detailed',
        },
      ],
    },
  },
];
