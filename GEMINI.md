# GEMINI.md

This file provides guidance for working with Google Gemini models in this Next.js AI Chatbot codebase.

## Gemini Model Support

This project supports Google's Gemini models through the Vercel AI SDK. Current supported models include:

- `google/gemini-2.5-flash-lite` (default)
- `google/gemini-2.5-flash`
- `google/gemini-2.5-pro`

## Model Configuration

### Adding Gemini Models

To add a new Gemini model to the application:

1. **Update Model Registry** (`lib/ai/models.ts`):

   ```typescript
   export const chatModels: ChatModel[] = [
     // ... existing models
     {
       id: "google/gemini-2.5-pro",
       name: "Gemini 2.5 Pro",
       provider: "google",
       tier: "premium",
       contextWindow: 2000000, // 2M tokens
       maxTokens: 8192,
       inputPricing: 0.00125, // per 1K chars
       outputPricing: 0.005, // per 1K chars
     },
   ];
   ```

2. **Environment Variables**: Ensure `GOOGLE_GENERATIVE_AI_API_KEY` is set in `.env.local`

### Model-Specific Features

#### Multimodal Capabilities

Gemini models excel at processing multimodal inputs:

- **Text + Images**: Users can upload images alongside text prompts
- **Mixed Content**: Handle conversations with both text and visual elements
- **Artifact Generation**: Create images, code, and documents from multimodal prompts

#### Long Context Windows

- Gemini 2.5 Pro: 2M token context window
- Efficient handling of large codebases and long conversations
- Maintains coherence across extended interactions

## Best Practices for Gemini

### Prompt Engineering

- **Be Specific**: Gemini responds well to detailed, structured prompts
- **Use Examples**: Provide clear examples in your prompts for better results
- **Context Matters**: Include relevant context from the conversation history

### Code Generation

- **Language Specification**: Explicitly mention programming languages
- **Framework Context**: Include framework and library information
- **Error Handling**: Request comprehensive error handling in generated code

### Artifact Creation

- **Clear Instructions**: Provide detailed specifications for artifacts
- **Iterative Refinement**: Use follow-up messages to refine artifacts
- **Type Safety**: Request TypeScript interfaces and proper typing

## Common Issues & Solutions

### Rate Limiting

- Gemini models have rate limits based on usage tier
- Implement proper error handling for rate limit responses
- Consider user entitlements for premium features

### Token Limits

- Monitor context window usage in long conversations
- Implement conversation summarization for extended sessions
- Use resumable streams to maintain context across sessions

### Multimodal Processing

- Validate image uploads before processing
- Handle different image formats appropriately
- Consider file size limits for optimal performance

## Integration Points

### Streaming Responses

Gemini models work seamlessly with the application's streaming architecture:

- Real-time text generation
- Progressive artifact creation
- Interruptible responses for better UX

### Tool Calling

- Gemini supports function calling for tool integration
- Weather lookups, document creation, and other tools work reliably
- Proper error handling for tool execution failures

## Testing Gemini Integration

### E2E Testing

- Use Playwright tests to verify Gemini model responses
- Test multimodal inputs with image uploads
- Validate artifact generation workflows

### Mock Testing

- Set `PLAYWRIGHT=True` to use mock models in tests
- Ensure fallback behavior when Gemini is unavailable
- Test error scenarios and recovery mechanisms

## Performance Optimization

### Caching Strategies

- Cache frequently used prompts and responses
- Implement intelligent context pruning
- Use Redis for session persistence when available

### Model Selection

- Use `gemini-2.5-flash-lite` for fast, cost-effective responses
- Reserve `gemini-2.5-pro` for complex reasoning tasks
- Implement automatic model selection based on task complexity

## Troubleshooting

### API Errors

- **429 Rate Limited**: Implement exponential backoff
- **403 Forbidden**: Check API key permissions
- **500 Internal Error**: Retry with different model or fallback

### Content Filtering

- Gemini has safety filters that may block certain content
- Provide clear, appropriate prompts to avoid filtering
- Handle filtered responses gracefully in the UI

For general project guidance, see [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md).
