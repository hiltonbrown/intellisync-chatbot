import { simulateReadableStream } from 'ai';
import { MockLanguageModelV2 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { getResponseChunksByPrompt } from '@/tests/prompts/utils';

const chatModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Hello, world!' }],
    warnings: [],
  }),
  // @ts-expect-error - Mock language model for testing
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt('test prompt'),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

const reasoningModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Hello, world!' }],
    warnings: [],
  }),
  // @ts-expect-error - Mock language model for testing
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt('test prompt', true),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

const titleModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'This is a test title' }],
    warnings: [],
  }),
  doStream: async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: [
        { id: '1', type: 'text-start' },
        { id: '1', type: 'text-delta', delta: 'This is a test title' },
        { id: '1', type: 'text-end' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 3, outputTokens: 10, totalTokens: 13 },
        },
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

const artifactModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Hello, world!' }],
    warnings: [],
  }),
  // @ts-expect-error - Mock language model for testing
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 100,
      chunks: getResponseChunksByPrompt('test prompt'),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

describe('mock chat models', () => {
  it('expose base fixtures', () => {
    expect(chatModel).toBeDefined();
    expect(reasoningModel).toBeDefined();
    expect(titleModel).toBeDefined();
    expect(artifactModel).toBeDefined();
  });
});
