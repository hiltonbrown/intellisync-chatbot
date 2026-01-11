# AGENTS.md

This file provides general guidance for AI agents working with this Next.js AI Chatbot codebase.

## Quick Start

This is a **Next.js AI Chatbot** application built with modern web technologies including RAG (Retrieval-Augmented Generation), advanced visualization, and organization support. For detailed technical documentation, see [`CLAUDE.md`](CLAUDE.md).

## Key Principles for AI Agents

### Code Quality Standards

- **TypeScript Strict Mode**: No `any` types, explicit return types, proper error handling
- **Ultracite/Biome**: Run `pnpm lint` and `pnpm format` before commits
- **Component Patterns**: Prefer server components, use client components only when necessary
- **Naming**: PascalCase for components, camelCase for utilities, kebab-case for files

### Development Workflow

1. **Environment Setup**: Copy `.env.example` to `.env.local` with required variables
2. **Dependencies**: Use `pnpm install` (not npm/yarn)
3. **Development**: `pnpm dev` starts dev server at localhost:3000
4. **Testing**: `pnpm test` runs Playwright E2E tests
5. **Database**: Use `pnpm db:generate` and `pnpm db:migrate` for schema changes

### Architecture Overview

- **Frontend**: Next.js 16.1.1 App Router with React Server Components (Turbopack enabled)
- **Backend**: API routes in `app/api/`, server actions in `actions.ts` files
- **Database**: PostgreSQL with Drizzle ORM 0.45.1 and pgvector extension
- **AI Integration**: Vercel AI SDK 6.0.14 with multiple model providers (Anthropic, OpenAI, Google, xAI)
- **Authentication**: Clerk 6.36.5 with OAuth, email/password, and organization support
- **RAG System**: OpenAI embeddings (text-embedding-3-small) with automatic chunking
- **Visualization**: ReactFlow for graph/flow interfaces, Recharts for analytics

## Common Tasks

### Adding New Features

1. **UI Components**: Add to `components/` following shadcn/ui patterns
   - Use `components/ai-elements/` for AI-specific visualizations (29 components available)
   - Graph/flow components use `@xyflow/react`
   - Reasoning display with `chain-of-thought.tsx`

2. **API Routes**: Create in `app/(chat)/api/` or `app/(auth)/api/`
   - Streaming endpoints use `streamText()` from AI SDK
   - Enable smooth streaming with `smoothStream()` middleware
   - Add geolocation context via Vercel functions

3. **Database Changes**: Modify `lib/db/schema.ts`, run migrations
   - Use pgvector for embedding storage (1536 dimensions)
   - Follow existing patterns for composite keys and foreign keys
   - RAG chunks stored in `DocumentChunk` table

4. **AI Tools**: Add to `lib/ai/tools/` with Zod schemas
   - Use `Output.array()` for structured generation
   - Follow existing tool patterns in `create-document.ts`, etc.

5. **Settings Pages**: Add to `app/(chat)/settings/`
   - Current pages: personalisation, integrations
   - Use `SettingsHeader` component with OrganizationSwitcher

6. **RAG Integration**:
   - Chunk content with `chunkText()` from `lib/ai/rag.ts`
   - Generate embeddings with `createEmbeddings()`
   - Store with `saveDocumentChunks()` in database
   - Retrieve context with `buildRagContext()`

### Debugging Issues

- Check browser console and server logs
- Use `pnpm db:studio` to inspect database (including vector embeddings)
- Run `pnpm test` to verify functionality
- Check environment variables in `.env.local`
- For RAG issues, verify embedding dimensions (1536) and chunk creation
- Test with mock models: set `PLAYWRIGHT=True` environment variable
- Review reasoning output with extended thinking models

### Code Review Checklist

- [ ] TypeScript types are correct and explicit
- [ ] Code follows Biome formatting rules (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] Database migrations are generated if schema changed
- [ ] Environment variables documented if added
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed
- [ ] RAG chunks created for new text content (if applicable)
- [ ] Organization scoping considered (if using Clerk orgs)
- [ ] Accessibility standards met (comprehensive a11y rules)
- [ ] Security: URL sanitization, no XSS vulnerabilities

## Key Features to Understand

### RAG (Retrieval-Augmented Generation)

The codebase includes a full RAG implementation:

- **Text Chunking**: 800 words per chunk with 100-word overlap
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Storage**: PostgreSQL with pgvector extension
- **Retrieval**: Top-K cosine similarity (default K=4, min score=0.15)
- **Integration**: Automatic on artifact creation, injected into system prompts

See `lib/ai/rag.ts` for implementation details.

### Extended Thinking Models

Reasoning models provide detailed chain-of-thought:

- Models: `claude-4.5-sonnet-thinking`, `grok-4.1-fast-reasoning`
- Uses `extractReasoningMiddleware()` to capture reasoning
- Displayed with `chain-of-thought.tsx` component
- Supports thinking budgets and streaming reasoning

### Organization Support

Multi-tenant organization features:

- Clerk `OrganizationSwitcher` in chat and settings headers
- Organization-scoped data and settings
- Dark mode styling throughout
- Hide personal workspace mode (`hidePersonal`)

### Custom System Prompts

Per-user AI behavior customization:

- Stored in `user.systemPrompt` database field
- Managed via Settings > Personalisation page
- Server actions: `saveSystemPrompt()`, `getUserSystemPrompt()`
- Automatically merged with base prompts

### Advanced Visualizations

29 AI-specific UI components including:

- **Graph/Flow**: ReactFlow-based canvas with nodes and edges
- **Workflow**: Plans, checkpoints, tasks, confirmations
- **Reasoning**: Collapsible chain-of-thought display
- **Content**: Sources, suggestions, citations
- **Code**: Syntax highlighting with Shiki

## Model-Specific Guidance

For model-specific guidance, see:

- [`CLAUDE.md`](CLAUDE.md) - Comprehensive technical documentation
- [`GEMINI.md`](GEMINI.md) - Google Gemini models

## Getting Help

- **Project Structure**: See [`CLAUDE.md`](CLAUDE.md) for detailed architecture
- **API Documentation**: Check route handlers in `app/api/`
- **Component Library**: Explore `components/ui/` and `components/ai-elements/`
- **Database Schema**: Review `lib/db/schema.ts` for data models (includes pgvector)
- **RAG System**: Review `lib/ai/rag.ts` for embedding and chunking logic
- **Settings Pages**: Check `app/(chat)/settings/` for user customization UI
