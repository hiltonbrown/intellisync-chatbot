# CLAUDE.md

This file provides comprehensive documentation for the Next.js AI Chatbot codebase. It serves as the main technical reference for developers working on this project.

## Project Overview

This is a **Next.js AI Chatbot** template (Chat SDK) built with Next.js 16 App Router, AI SDK, and Vercel AI Gateway. It provides a full-featured chat interface with support for multiple AI model providers, artifacts (real-time document creation/editing), and collaborative features.

**Key Technologies:**

- Next.js 16 with App Router and React Server Components
- AI SDK (Vercel) with streaming responses and tool calling
- Auth.js (NextAuth v5) for authentication (credentials + guest mode)
- Drizzle ORM with PostgreSQL (Neon)
- Vercel Blob for file storage
- Redis for resumable streams (optional)
- Playwright for E2E testing
- Ultracite (Biome-based) for linting and formatting

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

  - `/login` and `/register` pages
  - `auth.ts` - NextAuth configuration with credentials + guest providers
  - `auth.config.ts` - Shared auth configuration
  - `actions.ts` - Server actions for auth operations
  - API routes: `/api/auth/*` for NextAuth, `/api/auth/guest` for guest creation

- **`app/(chat)/`** - Main chat application
  - Root `/` and `/chat/[id]` routes
  - `layout.tsx` - Chat layout with sidebar
  - `actions.ts` - Server actions for chat operations (title generation, etc.)
  - API routes:
    - `/api/chat/route.ts` - Main chat streaming endpoint
    - `/api/chat/[id]/stream/route.ts` - Resumable stream endpoint
    - `/api/document/route.ts` - Document CRUD operations
    - `/api/files/upload/route.ts` - File upload handling
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
  - Groups models by provider for UI presentation
  - Default model: `google/gemini-2.5-flash-lite`

- **`prompts.ts`** - System prompts

  - `artifactsPrompt` - Instructions for artifact creation/updates
  - `regularPrompt` - Standard assistant behavior
  - `codePrompt`, `imagePrompt`, etc. - Artifact-specific prompts

- **`tools/`** - AI SDK tool definitions

  - `create-document.ts` - Create new artifacts
  - `update-document.ts` - Update existing artifacts
  - `request-suggestions.ts` - Request document suggestions
  - `get-weather.ts` - Weather lookup tool

- **`entitlements.ts`** - User-based rate limits and feature access

#### Database Layer (`lib/db/`)

- **`schema.ts`** - Drizzle schema definitions

  - `User` - User accounts (regular and guest)
  - `Chat` - Chat sessions with visibility settings
  - `Message_v2` - Messages with parts-based structure (current)
  - `Message` - Legacy messages (deprecated)
  - `Document` - Artifacts (text, code, image, sheet)
  - `Suggestion` - Document edit suggestions
  - `Vote_v2` - Message voting
  - `Stream` - Resumable stream tracking

- **`queries.ts`** - Database query functions

  - All database operations are centralized here
  - Server-only module (uses `"server-only"`)
  - Pattern: Functions are prefixed by operation (get*, create*, save*, update*, delete\*)

- **`migrate.ts`** - Migration runner
  - Run automatically during build: `pnpm build`
  - Safe to run multiple times

#### Artifacts System (`artifacts/`)

Artifacts are documents created/edited in real-time alongside the chat. Each artifact type has client and server components:

- **`artifacts/code/`** - Python code artifacts (CodeMirror editor)
- **`artifacts/text/`** - Rich text documents (ProseMirror editor)
- **`artifacts/image/`** - Generated images
- **`artifacts/sheet/`** - Spreadsheet data (react-data-grid)
- **`artifacts/actions.ts`** - Artifact server actions

Pattern: `server.ts` defines `createDocument` and `updateDocument` handlers that stream deltas to the client via `dataStream.write()`.

### Streaming Architecture

The chat uses AI SDK's streaming with custom data types:

1. **Main chat endpoint** (`/api/chat/route.ts`):

   - Uses `streamText()` from AI SDK
   - Calls tools that write custom data types to stream
   - Returns `createUIMessageStream()` for client consumption

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

Two authentication methods:

1. **Credentials** - Email/password with bcrypt
2. **Guest** - Auto-generated temporary accounts (`guest-{timestamp}@email`)

Session includes:

- `session.user.id` - User UUID
- `session.user.type` - "regular" | "guest"

Rate limiting based on user type via `entitlements.ts`.

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

- **`components/ai-elements/`** - Reusable AI UI components (message, tool, artifact, etc.)
- **`components/elements/`** - Application-specific UI elements
- **`components/ui/`** - Base shadcn/ui components
- **`hooks/`** - Custom React hooks
  - `use-messages.tsx` - Message state management
  - `use-artifact.ts` - Artifact state management
  - `use-auto-resume.ts` - Auto-resume interrupted streams

## Environment Variables

Required variables (see `.env.example`):

- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
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

- `auth.test.ts` - Login/register flows
- `chat.test.ts` - Chat interactions and streaming
- `api.test.ts` - API endpoint tests
- `model-selector.test.ts` - Model switching

Tests run against local dev server (started automatically).

**Test environment**: Set `PLAYWRIGHT=True` env var to use mock models.

## Common Workflows

### Adding a New AI Model

1. Add to `lib/ai/models.ts` in `chatModels` array
2. Model IDs follow format: `provider/model-name`
3. For reasoning models, append `-thinking` suffix (handled in `providers.ts`)

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

# Project Overview

This is a Next.js 16 AI Chatbot application, built using the Vercel AI SDK. It features a modern chat interface with support for various AI models (defaulting to xAI/Grok), artifacts, and multimodal input.

**Key Technologies:**

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui, Radix UI
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/react`), Vercel AI Gateway
- **Database:** PostgreSQL (Neon), Drizzle ORM
- **Caching/Storage:** Redis, Vercel Blob
- **Authentication:** Auth.js (NextAuth v5 beta)
- **Testing:** Playwright
- **Linting/Formatting:** Biome (via `ultracite`)

# Building and Running

**Package Manager:** `pnpm`

**Environment Setup:**
Copy `.env.example` to `.env.local` and populate the required environment variables (Database URL, AI keys, Auth secrets, etc.).

**Key Commands:**

- **Development Server:**

  ```bash
  pnpm dev
  ```

  Starts the app at `http://localhost:3000` with Turbopack.

- **Build:**

  ```bash
  pnpm build
  ```

  Runs database migrations (`lib/db/migrate`) and builds the Next.js application.

- **Testing:**

  ```bash
  pnpm test
  ```

  Runs Playwright E2E tests. Sets `PLAYWRIGHT=True`.

- **Linting:**

  ```bash
  pnpm lint
  ```

  Checks code quality using `ultracite` (Biome).

- **Formatting:**

  ```bash
  pnpm format
  ```

  Fixes code formatting issues using `ultracite` (Biome).

- **Database Management (Drizzle):**
  - `pnpm db:generate`: Generate migrations based on schema changes.
  - `pnpm db:migrate`: Run pending migrations.
  - `pnpm db:studio`: Open Drizzle Studio to inspect the database.
  - `pnpm db:push`: Push schema changes directly to the DB (prototyping).

# Development Conventions

- **Directory Structure:**

  - `app/`: Next.js App Router routes and layouts.
    - `(auth)`: Authentication-related routes.
    - `(chat)`: Main chat interface routes.
    - `api/`: Backend API routes.
  - `components/`: React components.
    - `ui/`: Reusable UI primitives (shadcn/ui).
    - `ai-elements/`, `elements/`: AI-specific UI components.
  - `lib/`: Shared utilities.
    - `db/`: Drizzle ORM schema (`schema.ts`) and migration logic.
    - `ai/`: AI-related logic and prompt definitions.
  - `hooks/`: Custom React hooks.
  - `tests/`: Playwright E2E tests.

- **Database:**

  - Schema definitions are located in `lib/db/schema.ts`.
  - Always run `pnpm db:generate` after modifying the schema to create migration files.

- **Styling:**

  - Uses Tailwind CSS v4.
  - Follows shadcn/ui patterns for component composition.

- **Code Quality:**
  - Strict adherence to Biome configuration (defined in `biome.jsonc`).
  - `ultracite` config extends standard rules but disables some specific rules (e.g., `noExplicitAny`, `noMagicNumbers` in style).

# Repository Guidelines

## Project Structure & Module Organization

- Next.js App Router lives in `app/`; grouped routes use segments like `app/(auth)` and `app/(chat)`. Server actions and layouts stay close to their routes.
- Shared UI primitives are under `components/` and hooks in `hooks/`. Reusable logic and data access sit in `lib/` (`lib/db` for Drizzle schema/migrations, `lib/ai` for AI SDK wiring, `lib/utils.ts` for helpers).
- Static assets go in `public/`. E2E test specs and fixtures live in `tests/` (see `tests/e2e`, `tests/helpers.ts`).
- Configuration lives in repo root: `next.config.ts`, `vercel.json`, `drizzle.config.ts`, `biome.jsonc`, `playwright.config.ts`.

## Build, Test, and Development Commands

- `pnpm install` — install dependencies (uses `pnpm` per `packageManager`).
- `pnpm dev` — start the Next.js dev server with Turbo.
- `pnpm build` — run `tsx lib/db/migrate` then `next build`; requires DB env vars.
- `pnpm start` — run the production build.
- `pnpm lint` / `pnpm format` — check or auto-fix with Ultracite/Biome.
- `pnpm db:generate` / `pnpm db:migrate` — generate and apply Drizzle migrations; keep schema changes committed.
- `pnpm test` — run Playwright E2E suite (`PLAYWRIGHT=True` set in script). For debugging, use `pnpm exec playwright test --headed --debug`.

## Coding Style & Naming Conventions

- TypeScript everywhere; `tsconfig.json` is strict. Prefer server components unless client hooks are needed.
- Stick to 2-space indentation and trailing commas; let `pnpm format` settle style. Avoid `any` unless unavoidable.
- Components/pages: PascalCase filenames; helpers/hooks: camelCase; route folders mirror URL segments.
- Use `@/*` path alias for imports; keep side-effectful code out of `lib/` utilities.

## Testing Guidelines

- Tests use Playwright (`tests/e2e/*.spec.ts`). Keep selectors stable with data attributes where possible.
- When adding flows, extend shared helpers/fixtures in `tests/helpers.ts` and `tests/fixtures.ts` to minimize duplication.
- Run `pnpm test` before PRs; for visual changes, add screenshots or describe expected behavior.

## Commit & Pull Request Guidelines

- Commits: concise, imperative subject (e.g., “Add chat retry handling”); include why when non-obvious. Group schema changes with generated migrations.
- PRs: describe intent, scope, and testing performed (`pnpm lint`, `pnpm test`, migrations). Link issues/linear tickets. Include screenshots or recordings for UI-impacting work and note any env/config changes.

## Security & Configuration Tips

- Copy envs from `.env.example`; never commit secrets. Required keys include AI Gateway, Auth.js, Postgres/Neon, and Vercel Blob.
- Local build/migrations expect a reachable Postgres instance; use `pnpm db:push` for schema sync and `pnpm db:studio` to inspect data.
