# GEMINI.md

This file provides guidance for working with Google Gemini models in this Next.js AI Chatbot codebase.

## Gemini Model Support

This project supports Google's Gemini models through the Vercel AI SDK and AI Gateway. Current supported models include:

- `google/gemini-2.5-flash-lite` (default) - Ultra fast and effective at a range of tasks
- `google/gemini-3-pro-preview` - Most capable Google model

## Model Configuration

### Adding Gemini Models

To add a new Gemini model to the application:

1. **Update Model Registry** (`lib/ai/models.ts`):

   ```typescript
   export const chatModels: ChatModel[] = [
     // ... existing models
     {
       id: "google/gemini-3-pro-preview",
       name: "Gemini 3 Pro",
       provider: "google",
       description: "Most capable Google model",
     },
   ];
   ```
The `lib/ai/models.ts` file has been verified and contains the `google/gemini-3-pro-preview` model as described. The `tailwindcss` version in `package.json` is also consistent with the documented usage of Tailwind CSS v4.1.

2. **Environment Variables**: Models are accessed through Vercel AI Gateway, so ensure `AI_GATEWAY_API_KEY` is configured (or deploy on Vercel for automatic OIDC authentication)

### Model-Specific Features

#### Multimodal Capabilities

Gemini models in this application handle multimodal inputs in the chat interface:

- **Text + Images**: Users can upload images alongside text prompts.
- **Mixed Content**: The chat can handle conversations with both text and visual elements.

**Note on Document Processing and RAG:** The application has a Retrieval-Augmented Generation (RAG) pipeline for uploaded documents (PDF, DOCX, TXT, CSV, TSV). This feature, including text extraction and embedding generation, is primarily powered by OpenAI's `text-embedding-3-small` model, not Gemini.

#### Long Context Windows

- Gemini 3 Pro: Large context window for handling extensive conversations
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

- Use `gemini-2.5-flash-lite` for fast, cost-effective responses (default)
- Reserve `gemini-3-pro-preview` for complex reasoning tasks
- Allow users to switch models via the model selector UI

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
