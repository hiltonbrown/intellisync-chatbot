# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Package Management

- **Install dependencies**: `pnpm install`
- **Development server**: `pnpm dev` (runs on localhost:3000)
- **Build**: `pnpm build` (includes database migration before build)
- **Start production**: `pnpm start`

### Code Quality

- **Lint**: `pnpm lint` (Biome with auto-fix)
- **Lint & Format**: `pnpm lint:fix`
- **Format only**: `pnpm format`

### Database Operations

- **Generate migrations**: `pnpm db:generate`
- **Run migrations**: `pnpm db:migrate`
- **Database studio**: `pnpm db:studio`
- **Push schema**: `pnpm db:push`
- **Check migrations**: `pnpm db:check`

### Testing

- **Run tests**: `pnpm test` (Playwright tests)

## Architecture Overview

### Technology Stack

- **Framework**: Next.js 15 with App Router
- **AI Integration**: Vercel AI SDK with OpenRouter provider
- **Authentication**: Clerk
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **Code Quality**: Biome (linting & formatting)

### Project Structure

- `app/` - Next.js App Router structure with route groups:
  - `(auth)/` - Authentication routes (login, register)
  - `(chat)/` - Main chat interface and API routes
  - `api/` - API endpoints for models and utilities
- `lib/` - Core business logic:
  - `ai/` - AI provider configuration, models, tools, and prompts
  - `db/` - Database schema, queries, and migrations
  - `types.ts` - TypeScript type definitions
- `components/` - React components (primarily shadcn/ui based)
- `hooks/` - Custom React hooks

### AI Integration Architecture

- **Provider**: OpenRouter (configurable via environment variables)
- **Default Model**: `google/gemini-2.5-flash`
- **Model Management**: Dynamic model fetching from OpenRouter API with caching
- **Tools Integration**: Built-in tools for weather, document creation/updates, and suggestions
- **Streaming**: Real-time message streaming with resumable streams
- **Rate Limiting**: Message limits per user (24-hour window)

### Database Schema

- **Core Tables**: User, Chat, Message_v2, Document, Suggestion, Vote_v2, Stream
- **Migration Strategy**: Uses versioned schema (Message_v2, Vote_v2) for backwards compatibility
- **Authentication Integration**: Users created automatically via Clerk integration

### Authentication Flow

- **Provider**: Clerk with automatic user creation
- **Session Management**: Custom session compatibility layer for existing tools
- **Authorization**: Chat ownership validation, user-specific data access

### Development Guidelines

- **Environment Setup**: Requires `.env.local` with OpenRouter API key and database URL
- **Code Style**: Enforced via Biome with specific React/TypeScript rules
- **Testing**: Playwright for end-to-end testing
- **Deployment**: Optimized for Vercel with automatic environment handling

### Key Configuration Files

- `biome.jsonc` - Code formatting and linting rules
- `drizzle.config.ts` - Database configuration
- `next.config.ts` - Next.js configuration with CORS headers
- `middleware.ts` - Authentication middleware

# Repository Guidelines

## Project Structure & Module Organization

The Next.js App Router lives in `app/`, with feature groups such as `(auth)` and `(chat)` plus API handlers under `app/api/`. Shared UI primitives and layouts sit in `components/` and `src/ui/`, while domain logic, AI adapters, and database helpers are grouped under `lib/` (see `lib/db` for Drizzle migrations and `lib/ai` for provider wiring). Front-end assets reside in `public/`, and Playwright fixtures and helpers are maintained in `tests/` alongside generated reports in `playwright-report/`.

## Build, Test, and Development Commands

Run `pnpm install` once per clone, then `pnpm dev` to start the local server on port 3000. Use `pnpm build` to apply database migrations via `tsx lib/db/migrate` and produce a production bundle, followed by `pnpm start` when testing the optimized build. `pnpm lint` (or `pnpm lint:fix`) enforces Biome rules, and `pnpm format` auto-formats sources. Database tasks rely on Drizzle: `pnpm db:generate` updates SQL artifacts, while `pnpm db:migrate` executes migrations. Execute end-to-end suites with `pnpm test`, which boots Playwright using the `tests/` scenarios.

## Coding Style & Naming Conventions

TypeScript and React components should use 2-space indentation and stay strongly typed—export shared types through `lib/types.ts`. Favor server components by default; opt into `"use client"` only when hooks demand it. Components and hooks use PascalCase filenames (`ChatHeader.tsx`), while utilities remain camelCase (`formatMessage.ts`). Tailwind utility classes follow the conventions in `src/ui/tailwind.config.js`; run Biome before committing to ensure lint and format compliance.

## Testing Guidelines

Playwright drives integration coverage, with specs living in `tests/e2e` and named `*.spec.ts`. Keep fixtures reusable via `tests/fixtures.ts`, and prefer data from `tests/prompts/` or `tests/routes/` over inline literals. When adding user flows, record expected UI states or screenshots in the generated Playwright report, and rerun `pnpm test` locally to confirm stability before pushing.

## Commit & Pull Request Guidelines

Recent history favors brief, lowercase summaries such as `bug fixes` and `authentication redirect fix`; keep following that concise style while clarifying scope (e.g., `auth: fix redirect loop`). Squash commits as needed so each PR tells a clear story. In pull requests, include a short problem statement, reference any GitHub issues, list manual verification steps (commands, screenshots, or links to Playwright output), and flag migrations or config changes so reviewers can provision matching environments.

## Environment & Configuration

Copy `.env.example` to `.env.local` and fill credentials for the AI gateway, database, and Clerk auth. The recommended workflow is `vercel link` then `vercel env pull` to sync secrets; never commit local `.env*` files. When adjusting configuration (e.g., `drizzle.config.ts` or `next.config.ts`), document the change in the PR description and coordinate any required infrastructure updates.

# Using Gemini CLI for Large Codebase Analysis

  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.

## File and Directory Inclusion Syntax

  Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:

### Examples

  **Single file analysis:**

  ```bash
  gemini -p "@src/main.py Explain this file's purpose and structure"

  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"

  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"

  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"

  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  
#
 Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"

  Implementation Verification Examples

  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"

  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"

  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"

  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"

  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"

  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"

  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"

  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"

  When to Use Gemini CLI

  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase

  Important Notes

  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results # Using Gemini CLI for Large Codebase Analysis


  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.
