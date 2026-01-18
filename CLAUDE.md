# CLAUDE.md

This file provides comprehensive documentation for the Next.js AI Chatbot codebase. It serves as the main technical reference for developers working on this project.

## Project Overview

This is a **Next.js AI Chatbot** template (Chat SDK) built with Next.js 16 App Router, AI SDK, and Vercel AI Gateway. It provides a full-featured chat interface with support for multiple AI model providers, artifacts (real-time document creation/editing), RAG (Retrieval-Augmented Generation), and collaborative features.

**Key Technologies:**

- Next.js 16.1.1 with App Router and React Server Components (Turbopack enabled)
- AI SDK (Vercel) 6.0.14 with streaming responses, tool calling, and extended thinking
- Clerk for authentication (with organization support)
- Drizzle ORM 0.45.1 with PostgreSQL (Neon) and pgvector for embeddings
- Vercel Blob for file storage
- Redis for resumable streams (optional)
- RAG system with OpenAI embeddings (text-embedding-3-small)
- ReactFlow for graph/flow visualization
- Playwright for E2E testing
- Ultracite (Biome 2.3.11) for linting and formatting

## Development Commands

### Essential Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start dev server (localhost:3000, uses Turbo)
pnpm build                # Build for production (runs migrations first)
pnpm start                # Start production server
pnpm lint                 # Check code with Ultracite
pnpm format               # Auto-fix code with Ultracite
pnpm test                 # Run Playwright E2E tests
```

### Database Commands

```bash
pnpm db:migrate           # Run database migrations
pnpm db:generate          # Generate migration files from schema changes
pnpm db:studio            # Open Drizzle Studio (database GUI)
pnpm db:push              # Push schema changes directly (dev only)
pnpm db:pull              # Pull schema from database
pnpm db:check             # Validate migrations
```

### Testing

```bash
pnpm test                 # Run all Playwright tests
npx playwright test tests/e2e/chat.test.ts  # Run single test file
npx playwright test --ui  # Run tests in UI mode
npx playwright show-report  # View test report
```

## Architecture

### Route Groups Structure

The app uses Next.js route groups for organization:

- **`app/(auth)/`** - Authentication routes and logic

  - `/login` - Clerk sign-in page
  - `/register` - Clerk sign-up page
  - `personalization-actions.ts` - Server actions for user customization (system prompt)
  - Uses Clerk's pre-built components for authentication UI

- **`app/(chat)/`** - Main chat application
  - Root `/` and `/chat/[id]` routes
  - `layout.tsx` - Chat layout with sidebar
  - `actions.ts` - Server actions for chat operations (title generation, etc.)
  - **Settings routes:**
    - `/settings` - Main settings dashboard with grid layout
    - `/settings/personalisation` - User customization (system prompt, AI preferences)
    - `/settings/integrations` - Third-party integrations (Xero, QuickBooks, MYOB, Zoho, Sage)
  - API routes:
    - `/api/chat/route.ts` - Main chat streaming endpoint
    - `/api/chat/[id]/stream/route.ts` - Resumable stream endpoint
    - `/api/document/route.ts` - Document CRUD operations
    - `/api/files/upload/route.ts` - File upload handling (supports PDF, DOCX)
    - `/api/history/route.ts` - Chat history
    - `/api/suggestions/route.ts` - Artifact suggestions
    - `/api/vote/route.ts` - Message voting

### Core Modules

#### AI Integration (`lib/ai/`)

- **`providers.ts`** - Model provider abstraction

  - Uses Vercel AI Gateway for unified model access
  - `getLanguageModel(modelId)` - Get model with optional reasoning middleware
  - `getTitleModel()` and `getArtifactModel()` - Specialized model getters
  - Test mode uses mock models from `models.mock.ts`

- **`models.ts`** - Model registry

  - Defines available models from Anthropic, OpenAI, Google, xAI
  - Current models include:
    - Anthropic: `claude-haiku-4.5`, `claude-sonnet-4.5`
    - OpenAI: `gpt-5-mini`, `gpt-5.2`
    - Google: `gemini-2.5-flash-lite`, `gemini-3-pro-preview`
    - xAI: `grok-4.1-fast-non-reasoning`
    - Reasoning models: `claude-4.5-sonnet-thinking`, `grok-4.1-fast-reasoning`
  - Groups models by provider for UI presentation
  - Default model: `google/gemini-2.5-flash-lite`
  - Reasoning models use `extractReasoningMiddleware()` for extended thinking support

- **`rag.ts`** - RAG (Retrieval-Augmented Generation) system

  - Text chunking with configurable overlap (default: 800 words, 100 overlap)
  - Embedding generation using OpenAI's `text-embedding-3-small` (1536 dimensions)
  - Cosine similarity scoring for chunk retrieval
  - `buildRagContext()` function for context injection (top-K=4, minScore=0.15)
  - Test environment uses mock embeddings
  - Automatic chunking and embedding on artifact creation
  - Context injected into chat system prompt

- **`prompts.ts`** - System prompts

  - `artifactsPrompt` - Instructions for artifact creation/updates
  - `regularPrompt` - Standard assistant behavior
  - `codePrompt`, `imagePrompt`, etc. - Artifact-specific prompts

- **`tools/`** - AI SDK tool definitions

  - `create-document.ts` - Create new artifacts
  - `update-document.ts` - Update existing artifacts
  - `request-suggestions.ts` - Request document suggestions
  - `get-weather.ts` - Weather lookup tool
  - `search-abn-by-name.ts` - Search Australian Business Register by company name
  - `get-abn-details.ts` - Get detailed ABN information
  - **Xero Integration Tools** (requires Xero connection via `/settings/integrations`):
    - `list-xero-organisation.ts` - Check Xero connection status and get org details
    - `list-xero-profit-and-loss.ts` - Retrieve P&L reports with date filtering
    - `list-xero-balance-sheet.ts` - Retrieve balance sheet reports
    - `list-xero-invoices.ts` - List/search invoices with filtering and pagination
    - `list-xero-contacts.ts` - List customers and suppliers with search
    - `list-xero-accounts.ts` - Get chart of accounts for categorization
    - `create-xero-invoice.ts` - Create sales invoices or purchase bills (requires approval)

- **`entitlements.ts`** - User-based rate limits and feature access

#### Database Layer (`lib/db/`)

- **`schema.ts`** - Drizzle schema definitions

  - `User` - User accounts (id, email, systemPrompt - managed by Clerk)
  - `Chat` - Chat sessions with visibility settings
  - `Message_v2` - Messages with parts-based structure (current)
  - `Message` - Legacy messages (deprecated)
  - `Document` - Artifacts (text, code, image, sheet, pdf, docx)
  - `DocumentChunk` - Chunked content with embeddings (1536-dim vectors for RAG)
  - `Suggestion` - Document edit suggestions
  - `Vote_v2` - Message voting
  - `Stream` - Resumable stream tracking

- **`queries.ts`** - Database query functions

  - All database operations are centralized here
  - Server-only module (uses `"server-only"`)
  - Pattern: Functions are prefixed by operation (get*, create*, save*, update*, delete*)
  - RAG-related: `saveDocumentChunks()`, `getDocumentChunksByUserId()`, `deleteDocumentChunksByArtifactId()`
  - Customization: `updateUserSystemPrompt()`, `getSystemPromptByUserId()`

- **`migrate.ts`** - Migration runner
  - Run automatically during build: `pnpm build`
  - Safe to run multiple times

#### Artifacts System (`artifacts/`)

Artifacts are documents created/edited in real-time alongside the chat. Each artifact type has client and server components:

- **`artifacts/code/`** - Python code artifacts (CodeMirror editor)
- **`artifacts/text/`** - Rich text documents (ProseMirror editor with RAG support)
- **`artifacts/image/`** - Generated images
- **`artifacts/sheet/`** - Spreadsheet data (react-data-grid, CSV parsing with papaparse)
- **`artifacts/actions.ts`** - Artifact server actions
- **Document types**: text, code, image, sheet, pdf, docx

Pattern: `server.ts` defines `createDocument` and `updateDocument` handlers that stream deltas to the client via `dataStream.write()`. Text artifacts automatically generate embeddings and store chunks for RAG retrieval.

### Streaming Architecture

The chat uses AI SDK's streaming with custom data types:

1. **Main chat endpoint** (`/api/chat/route.ts`):

   - Uses `streamText()` from AI SDK
   - Calls tools that write custom data types to stream
   - Returns `createUIMessageStream()` for client consumption
   - **Enhanced features**:
     - Tool approval flow for sensitive operations
     - Parallel title generation (non-blocking)
     - Extended thinking support with `extractReasoningMiddleware`
     - Smooth streaming with word-level chunking via `smoothStream()`
     - Step limiting with `stepCountIs(5)` constraint
     - Geolocation context injection via Vercel functions

2. **Custom data types** (defined in `lib/types.ts`):

   - `textDelta`, `codeDelta`, `imageDelta`, `sheetDelta` - Artifact content deltas
   - `appendMessage` - Append to message content
   - `chat-title` - Set chat title
   - `suggestion` - Add document suggestion
   - `id`, `title`, `kind` - Artifact metadata
   - `clear`, `finish` - Control signals

3. **Resumable streams** (optional, requires Redis):
   - Uses `resumable-stream` package
   - Allows reconnecting to in-progress streams
   - Context created in `getStreamContext()`

### Authentication Flow

Authentication is handled by **Clerk**, providing:

- Email/password authentication
- OAuth providers (Google, GitHub, etc.)
- User management and session handling
- Pre-built UI components for auth flows
- **Organization support** with `OrganizationSwitcher` (hidePersonal mode enabled)

Session access:

- Use `auth()` from `@clerk/nextjs/server` for user ID in server components
- Use `currentUser()` for full user details
- User ID stored as text in database

**User Customization:**

- Custom system prompts stored per-user in database (`user.systemPrompt`)
- Server actions: `saveSystemPrompt()` and `getUserSystemPrompt()` in `personalization-actions.ts`
- System prompt integration via `systemPrompt()` function in chat API
- RAG context automatically injected into system prompt

Rate limiting based on user entitlements via `entitlements.ts`.

### Message Structure

**Current (Message_v2):**

```typescript
{
  id: uuid,
  chatId: uuid,
  role: string,
  parts: json,        // Array of message parts (text, tool calls, tool results)
  attachments: json,  // File attachments
  createdAt: timestamp
}
```

**Legacy (Message):** Uses `content` field instead of `parts`. Deprecated schema maintained for migration compatibility.

### Component Patterns

- **`components/ai-elements/`** - Reusable AI UI components (29 components):
  - **Graph/Flow**: `canvas.tsx`, `node.tsx`, `edge.tsx`, `connection.tsx` (ReactFlow-based)
  - **Workflow**: `plan.tsx`, `checkpoint.tsx`, `confirmation.tsx`, `task.tsx`
  - **Reasoning**: `chain-of-thought.tsx`, `reasoning.tsx` (collapsible with streaming)
  - **Content**: `sources.tsx`, `suggestion.tsx`, `queue.tsx`, `conversation.tsx`
  - **UI**: `toolbar.tsx`, `panel.tsx`, `open-in-chat.tsx`, `web-preview.tsx`
  - **Display**: `code-block.tsx`, `image.tsx`, `shimmer.tsx`, `loader.tsx`, `inline-citation.tsx`
  - **Core**: `message.tsx`, `artifact.tsx`, `tool.tsx`
- **`components/elements/`** - Application-specific UI elements
  - `settings-header.tsx` - Settings navigation with OrganizationSwitcher
  - `chat-header.tsx` - Chat header with organization support
- **`components/ui/`** - Base shadcn/ui components (Radix UI)
- **`hooks/`** - Custom React hooks
  - `use-messages.tsx` - Message state management
  - `use-artifact.ts` - Artifact state management
  - `use-auto-resume.ts` - Auto-resume interrupted streams
  - `use-chat-visibility.ts` - Chat visibility controls
  - `use-mobile.ts` - Mobile device detection
  - `use-scroll-to-bottom.tsx` - Auto-scroll behavior

## Environment Variables

Required variables (see `.env.example`):

- `AUTH_SECRET` - General auth secret (generate with `openssl rand -base64 32`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `POSTGRES_URL` - PostgreSQL connection string (Neon or other)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

Optional:

- `AI_GATEWAY_API_KEY` - Required for non-Vercel deployments (Vercel uses OIDC)
- `REDIS_URL` - Enable resumable streams

Local development: Create `.env.local` with these variables.

## Code Quality (Ultracite)

This project uses **Ultracite** (wraps Biome) with strict rules defined in `.cursor/rules/ultracite.mdc`.

Key enforcement:

- **TypeScript**: Strict mode, no `any`, export types separately, no enums
- **React**: Hooks rules, no array index keys, fragment shorthand
- **Accessibility**: Comprehensive a11y rules (ARIA, semantic HTML, focus management)
- **Code style**: Arrow functions, `const` by default, template literals, optional chaining
- **Next.js**: No `<img>`, `<head>`, or `<Link>` misuse

Run `pnpm lint` before committing. Auto-fix with `pnpm format`.

## Testing Strategy

**E2E tests** with Playwright (located in `tests/e2e/`):

- `auth.test.ts` - Clerk authentication flows
- `chat.test.ts` - Chat interactions and streaming
- `api.test.ts` - API endpoint tests
- `model-selector.test.ts` - Model switching

Tests run against local dev server (started automatically).

**Test environment**: Set `PLAYWRIGHT=True` env var to use mock models.

## Common Workflows

### Adding a New AI Model

1. Add to `lib/ai/models.ts` in `chatModels` array
2. Model IDs follow format: `provider/model-name`
3. For reasoning models, use provider `"reasoning"` and name with `thinking` keyword
4. Reasoning models automatically use `extractReasoningMiddleware()` in `providers.ts`

### Creating a New Artifact Type

1. Create `artifacts/{type}/` directory with `client.tsx` and `server.ts`
2. Define type handler in `server.ts` using `createDocumentHandler`
3. Export handler from `lib/artifacts/server.ts`
4. Register in artifact tools (`lib/ai/tools/create-document.ts`, etc.)
5. Add custom data type to `lib/types.ts`
6. Update artifact component renderer in `components/artifact.tsx`

### Adding a New Tool

1. Create tool file in `lib/ai/tools/{tool-name}.ts`
2. Define with `tool()` from AI SDK and Zod schema
3. Add to tools object in `/api/chat/route.ts`
4. Update `ChatTools` type in `lib/types.ts`
5. Create UI component in `components/ai-elements/` if needed

### Database Schema Changes

1. Modify `lib/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Review generated SQL in `lib/db/migrations/`
4. Run `pnpm db:migrate` to apply
5. Update TypeScript types if needed (Drizzle auto-infers)

### Working with RAG

**Adding RAG to Content:**

1. Import `chunkText()` and `createEmbeddings()` from `lib/ai/rag.ts`
2. Chunk content: `const chunks = chunkText(content, { chunkSize: 800, overlap: 100 })`
3. Generate embeddings: `const embeddings = await createEmbeddings(chunks)`
4. Save to database: `await saveDocumentChunks({ artifactId, userId, chatId, chunks, embeddings })`

**Retrieving Context:**

1. Import `buildRagContext()` from `lib/ai/rag.ts`
2. Build context: `const { context, chunks } = await buildRagContext({ userId, chatId, query, topK: 4, minScore: 0.15 })`
3. Inject context into system prompt or tool parameters

**Configuration:**
- Adjust `topK` to retrieve more/fewer chunks
- Adjust `minScore` threshold for relevance filtering
- Chunks are scoped by user and optionally by chat

### Managing Custom System Prompts

**Saving User Prompts:**

1. Import `saveSystemPrompt()` from `app/(auth)/personalization-actions.ts`
2. Call with `await saveSystemPrompt(userId, promptText)`
3. Stored in `user.systemPrompt` field

**Using Custom Prompts:**

1. Import `getUserSystemPrompt()` from query functions
2. Retrieve with `const customPrompt = await getUserSystemPrompt(userId)`
3. Combine with base prompt in `systemPrompt()` function
4. RAG context automatically included if available

## Important Patterns

### Server Actions

All server actions use `"use server"` directive and are in `actions.ts` files within route groups.

### Data Stream Pattern

Artifact handlers write deltas to stream:

```typescript
dataStream.write({
  type: "data-textDelta",
  data: content,
  transient: true, // Don't persist in message history
});
```

### Error Handling

Use `ChatSDKError` class (from `lib/errors.ts`) for consistent error responses:

```typescript
throw new ChatSDKError("bad_request:database", "Description");
```

### Client-Server Communication

- API routes return streaming responses (not JSON)
- Use `useCompletion()` or `useChat()` from AI SDK on client
- Custom hooks wrap SDK hooks for application-specific logic

## Migration Notes

This codebase migrated from content-based messages to parts-based messages. Legacy schema (`Message`, `Vote`) is kept for compatibility. New code should only use `Message_v2` and `Vote_v2`.

Migration helper: `lib/db/helpers/01-core-to-parts.ts`

## Additional Project Details

### Settings & Customization

**Settings Pages** (located at `/settings`):

- **Personalisation** (`/settings/personalisation`):
  - Custom system prompt editor (stored in database)
  - AI behavior customization
  - User-specific preferences

- **Integrations** (`/settings/integrations`):
  - Third-party accounting tool connections
  - Supported platforms: Xero, QuickBooks, MYOB, Zoho Books, Sage Accounting
  - Organization-level integration management

**Organization Support**:
- Clerk `OrganizationSwitcher` in headers
- Dark mode styling for organization switcher
- Organization-scoped data and settings

### RAG System Details

**Implementation** (`lib/ai/rag.ts`):

- **Chunking Strategy**:
  - Word-based chunking (default: 800 words per chunk)
  - Configurable overlap (default: 100 words)
  - Whitespace normalization

- **Embedding Generation**:
  - Model: OpenAI `text-embedding-3-small`
  - Dimensions: 1536
  - Test mode uses deterministic mock embeddings

- **Retrieval**:
  - Cosine similarity scoring
  - Top-K retrieval (default: 4 chunks)
  - Minimum score threshold (default: 0.15)
  - Results formatted with source attribution

- **Integration**:
  - Automatic on artifact creation/update
  - Context injected into system prompt
  - User and chat-scoped retrieval

### Styling

- **Tailwind CSS 4.1.18** - Utility-first CSS framework
- **shadcn/ui** - Component library built on Radix UI
- **Radix UI** - Unstyled, accessible components
- **Framer Motion 12.24.7** - Animation library
- **Geist Font** - Typography

### Key Dependencies

- **Visualization**: `@xyflow/react@12.10.0` (graph/flow UI)
- **Document Processing**: `pdf-parse@2.4.5`, `mammoth@1.11.0` (DOCX)
- **Code Highlighting**: `shiki@3.20.0`
- **Spreadsheets**: `papaparse@5.5.3`, `react-data-grid@7.0.0-beta.59`
- **Charts**: `recharts@3.6.0`
- **Streaming**: `resumable-stream@2.2.10`

### Package Manager

This project uses **pnpm 9.12.3** for dependency management.

### Utilities & Helpers

**Core Utilities** (`lib/utils.ts`):

- `sanitizeUrl()` - URL validation (http/https only, prevents protocol-relative attacks)
- `fetchWithErrorHandlers()` - Enhanced fetch with offline detection
- `generateUUID()` - Uses `crypto.randomUUID()` (browser compatible)
- `convertToUIMessages()` - DBMessage → UIMessage conversion
- `getTextFromMessage()` - Extract text from message parts
- `isValidClerkUserId()` - Validate Clerk user ID format
- Standard shadcn/ui utilities (`cn()`, etc.)

**Editor Utilities** (`lib/editor/`):

- `config.ts` - ProseMirror configuration with list node extensions
- `functions.tsx` - React renderer components for ProseMirror
- `suggestions.tsx` - Suggestion rendering in text editor

## Repository Guidelines

### Directory Structure

- `app/` - Next.js App Router routes and layouts with grouped routes (`(auth)`, `(chat)`)
- `components/` - React components (ui/, ai-elements/, elements/)
- `lib/` - Shared utilities (db/, ai/, auth/, editor/, artifacts/)
  - `lib/ai/` - AI model providers, RAG system, prompts, tools
  - `lib/db/` - Database schema, queries, migrations
  - `lib/auth/` - Authentication helpers
  - `lib/editor/` - ProseMirror configuration and utilities
  - `lib/artifacts/` - Artifact server handlers
- `hooks/` - Custom React hooks
- `tests/` - Playwright E2E tests
- `artifacts/` - Artifact type implementations (client components)
- `types/` - TypeScript type definitions
- `scripts/` - Utility scripts
- `public/` - Static assets
- Configuration files in repo root

### Coding Style

- TypeScript strict mode everywhere
- 2-space indentation, trailing commas
- PascalCase for components, camelCase for utilities
- Use `@/*` path alias for imports
- Follow Biome/Ultracite formatting rules

### Testing

- Playwright for E2E tests (`tests/e2e/*.spec.ts`)
- Keep selectors stable with data attributes
- Run `pnpm test` before PRs
- Set `PLAYWRIGHT=True` for mock models

### Commits & PRs

- Concise, imperative commit messages
- Group schema changes with migrations
- Include testing details and screenshots for UI changes
- Document environment variable changes

### Security

- Never commit secrets to version control
- Use `.env.local` for local development
- Required keys: Clerk, AI Gateway, Postgres, Vercel Blob
