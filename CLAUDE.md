# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Core development commands using pnpm:

- `pnpm dev` - Start development server with Turbo (http://localhost:3000)
- `pnpm build` - Run database migrations and build for production
- `pnpm start` - Start production server
- `pnpm test` - Run Playwright e2e tests (requires PLAYWRIGHT=True environment variable)

Code quality and formatting:
- `pnpm lint` - Run Biome linter with auto-fixes and unsafe mode
- `pnpm lint:fix` - Run linter and formatter with auto-fixes
- `pnpm format` - Format code with Biome

Database operations (Drizzle ORM):
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Apply database migrations (runs tsx lib/db/migrate.ts)
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:push` - Push schema changes to database
- `pnpm db:pull` - Pull schema from database
- `pnpm db:check` - Check database schema
- `pnpm db:up` - Apply pending migrations

## Project Architecture

This is a Next.js AI chatbot application built with:

### Core Stack
- **Next.js 15** with App Router and React Server Components
- **AI SDK v5** for LLM integration via OpenRouter
- **OpenRouter Models** - Gemini Flash 1.5 (default), Llama 3.1 8B, Mistral Large
- **Clerk Authentication** for user authentication and management
- **Drizzle ORM** with PostgreSQL (Neon Serverless)
- **Vercel Blob** for file storage
- **shadcn/ui** components with Tailwind CSS v4
- **Biome** for linting and formatting

### Directory Structure
- `app/(auth)/` - Authentication pages (login, register)
- `app/(chat)/` - Main chat interface, settings, and API routes
- `artifacts/` - Artifact rendering components (text, code, image, sheet)
- `components/` - Reusable UI components
- `lib/ai/` - AI model configuration, prompts, tools, and providers
- `lib/db/` - Database schema, queries, and migrations
- `public/` - Static assets (images, fonts)
- `tests/` - Playwright e2e tests

### Key Features
- Chat with AI models including vision capabilities
- Document creation and editing (text, code, images, spreadsheets)
- Real-time streaming with resumable contexts
- File upload and processing
- Artifact rendering system
- Chat history persistence
- User settings and preferences
- Message voting system

### Authentication Flow
- Uses **Clerk** for authentication with secure middleware
- Protected routes include `/`, `/chat/:id`, and `/api/:path*`
- Middleware handles authentication checks and redirects
- User creation happens automatically on first API call
- Database stores users with Clerk user IDs

### Database Schema
Key tables:
- **User** - User information with Clerk integration
- **Chat** - Chat sessions with titles, visibility, and usage tracking
- **Message_v2** - New message format with parts and attachments
- **Vote_v2** - Message voting system
- **Document** - User-created documents with different types
- **Suggestion** - Collaborative document suggestions
- **Stream** - Stream handling for real-time updates

Note: Contains deprecated v1 schemas (Message, Vote) for backward compatibility.

### AI Integration
- **OpenRouter Provider** with custom configuration and headers
- **Model Selection**: Gemini Flash 1.5, Llama 3.1 8B, Mistral Large
- **Streaming Responses** via AI SDK with smooth word chunking
- **Tools**: document creation/updates, weather, suggestions
- **Usage Tracking** and context management per chat
- **Resumable Streams** with Redis support (optional)
- **Artifact System** for rendering various content types

### Code Quality and Linting

Uses **Biome v1.9.4** for linting and formatting with:
- 2-space indentation, 80 character line width
- Single quotes for JavaScript, double quotes for JSX
- Semicolons required, trailing commas enforced
- Custom accessibility rules with UX-focused exceptions
- Sorted Tailwind classes enforced (useSortedClasses: error)
- TypeScript strict mode enabled

## Environment Setup

Required environment variables (see `.env.example`):

**OpenRouter Configuration:**
- `OPENROUTER_API_KEY` - API key from OpenRouter
- `OPENROUTER_MODEL` - Default model (default: `google/gemini-flash-1.5`)
- `OPENROUTER_BASE_URL` - Custom base URL (optional)

**Clerk Authentication:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key (production: `pk_live_*`)
- `CLERK_SECRET_KEY` - Clerk secret key (production: `sk_live_*`)
- `AUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL="/register"`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"`

**Database and Storage:**
- `POSTGRES_URL` - PostgreSQL connection string
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

**Optional:**
- `AI_GATEWAY_API_KEY` - For non-Vercel deployments
- `REDIS_URL` - For resumable streams (optional)
- `NEXT_PUBLIC_APP_URL` - App URL for OpenRouter headers

### Quick Start

1. **Installation:**
   ```bash
   pnpm install
   ```

2. **Environment Setup:**
   ```bash
   cp .env.example .env.local
   # Fill in required environment variables
   ```

3. **Local Development with Vercel CLI:**
   ```bash
   npm i -g vercel
   vercel link
   vercel env pull
   ```

4. **Run Development Server:**
   ```bash
   pnpm dev
   ```
   The application will be available at http://localhost:3000

5. **Production Build:**
   ```bash
   pnpm build
   pnpm start
   ```

## Key Implementation Patterns

### AI Provider Architecture
- `lib/ai/providers.ts` - Switches between OpenRouter (production) and mock models (testing)
- `lib/ai/models.ts` - OpenRouter configuration with custom headers and HTTP-Referer
- `lib/ai/get-model.ts` - Model selection logic
- Chat title generation uses same model as conversations (google/gemini-flash-1.5)

### Authentication Integration
- Clerk middleware protects routes automatically
- User creation happens on-demand in API routes when Clerk user first interacts
- Users stored with Clerk user IDs and placeholder emails (`${userId}@clerk.local`)
- Session compatibility layer for existing tools

### Database Operations
- Drizzle ORM with TypeScript-first schema optimized for serverless
- Automatic migrations via `tsx lib/db/migrate.ts`
- User IDs stored as varchar(255) to support Clerk string IDs
- Foreign key constraints ensure data integrity
- Separate v1/v2 schemas for backward compatibility

### Streaming and Real-time
- AI SDK streaming with UI message streams and smooth word chunking
- Resumable stream contexts with Redis (optional, graceful fallback)
- Server-sent events with JSON transformation
- Error handling with ChatSDKError system for user-friendly messages

## Documentation Resources

When working with this codebase, you can use context7 to fetch up-to-date documentation for the main technologies:

- **Next.js 15**: Library ID `/vercel/next.js` - App Router, Server Components, routing patterns
- **Drizzle ORM**: Library ID `/drizzle-team/drizzle-orm` - Database schema, queries, migrations
- **Neon Postgres**: Library ID `/neondatabase/neon` - Serverless PostgreSQL platform with branching
- **Clerk**: Library ID `/clerk/clerk-docs` - Authentication patterns and configuration
- **OpenRouter**: Library ID `/openrouter.ai/llmstxt` - Unified API for accessing multiple AI models
- **Vercel AI SDK**: Check latest docs for streaming, tools, and model integration patterns
- **Biome**: Library ID `/biomejs/biome` - Linting and formatting configuration

Use these resources when implementing new features or debugging framework-specific issues.