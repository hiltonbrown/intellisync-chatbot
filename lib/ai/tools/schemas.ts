import { z } from 'zod';
import { artifactKinds } from '@/lib/artifacts/constants';

export const getWeatherInputSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const createDocumentInputSchema = z.object({
  title: z.string(),
  kind: z.enum(artifactKinds),
});

export const updateDocumentInputSchema = z.object({
  id: z.string().describe('The ID of the document to update'),
  description: z
    .string()
    .describe('The description of changes that need to be made'),
});

export const requestSuggestionsInputSchema = z.object({
  documentId: z
    .string()
    .describe('The ID of the document to request edits'),
});

export const analyzeEmailFraudInputSchema = z.object({
  senderEmail: z.string().email('Please provide a valid sender email address'),
  senderName: z.string().min(1, "Please provide the sender's display name"),
  subject: z.string().min(1, 'Please provide the email subject'),
  emailBody: z.string().min(10, 'Please provide the email body content'),
  receivedHeaders: z.string().optional(),
  links: z.array(z.string().url()).optional(),
  hasAttachments: z.boolean().optional(),
  userFlags: z.array(z.string()).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
  requestsPersonalInfo: z.boolean().optional(),
  analysisDepth: z
    .enum(['basic', 'detailed', 'comprehensive'])
    .default('detailed'),
});
