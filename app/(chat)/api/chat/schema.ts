import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum(['image/jpeg', 'image/png']),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const toolInvocationSchema = z.object({
  type: z
    .string()
    .refine((value) => value.startsWith('tool-'), {
      message: 'Tool type must start with "tool-"',
    })
    .describe('Tool invocation payload identifier'),
  toolCallId: z.string().uuid(),
  state: z.literal('input-available'),
  input: z.unknown(),
});

const partSchema = z.union([textPartSchema, filePartSchema, toolInvocationSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.string().min(1), // Allow any valid model ID string
  selectedVisibilityType: z.enum(['public', 'private']),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
