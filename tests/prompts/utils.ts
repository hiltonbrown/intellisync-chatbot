interface TextChunk {
  id: string;
  type: 'text-start' | 'text-delta' | 'text-end';
  delta?: string;
}

interface ReasoningChunk {
  id: string;
  type: 'reasoning-start' | 'reasoning-delta' | 'reasoning-end';
  delta?: string;
}

interface FinishChunk {
  type: 'finish';
  finishReason: 'stop';
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

type ResponseChunk = TextChunk | ReasoningChunk | FinishChunk;

export function getResponseChunksByPrompt(
  prompt: string,
  includeReasoning = false,
): Array<ResponseChunk> {
  const response: Array<ResponseChunk> = [
    { id: '1', type: 'text-start' },
    { id: '1', type: 'text-delta', delta: `Response for: ${prompt}` },
    { id: '1', type: 'text-end' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    },
  ];

  if (!includeReasoning) {
    return response;
  }

  return [
    { id: 'r1', type: 'reasoning-start' },
    { id: 'r1', type: 'reasoning-delta', delta: 'Analyzing prompt…' },
    { id: 'r1', type: 'reasoning-end' },
    ...response,
  ];
}
