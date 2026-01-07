# GitHub Copilot Instructions

This document provides instructions for GitHub Copilot when working with this Next.js AI Chatbot repository.

## Project Overview

This is a **Next.js AI Chatbot** application (IntelliSync) built with modern web technologies including:
- Next.js 16 App Router with React Server Components
- TypeScript in strict mode
- PostgreSQL with Drizzle ORM
- Vercel AI SDK (supporting xAI, OpenAI, Anthropic, Google models)
- Clerk for authentication
- shadcn/ui component library
- Tailwind CSS for styling

## Essential Documentation

For comprehensive guidance, refer to these files:
- **[AGENTS.md](../AGENTS.md)** - General AI agent guidance and workflows
- **[CLAUDE.md](../CLAUDE.md)** - Detailed technical architecture
- **[GEMINI.md](../GEMINI.md)** - Model-specific guidance for Google Gemini

## Code Quality Standards

### TypeScript
- Use strict mode - no `any` types
- Always provide explicit return types
- Implement proper error handling
- Follow existing type patterns in the codebase

### Formatting & Linting
- Use **Biome** (via Ultracite) for linting and formatting
- Run `pnpm lint` to check code
- Run `pnpm format` to fix formatting issues
- Always lint before committing

### Component Patterns
- Prefer React Server Components by default
- Use Client Components only when necessary (interactivity, hooks, browser APIs)
- Follow shadcn/ui patterns for UI components
- Place components in appropriate directories under `components/`

### Naming Conventions
- **PascalCase** for React components (e.g., `ChatMessage.tsx`)
- **camelCase** for functions and variables (e.g., `handleSubmit`, `userId`)
- **kebab-case** for file names (e.g., `chat-message.tsx`)
- **SCREAMING_SNAKE_CASE** for constants (e.g., `API_ENDPOINT`)

## Development Workflow

### Setup
```bash
pnpm install                    # Install dependencies
cp .env.example .env.local      # Setup environment variables
pnpm db:migrate                 # Run database migrations
pnpm dev                        # Start development server (localhost:3000)
```

### Common Tasks
- **Database changes**: Modify `lib/db/schema.ts`, run `pnpm db:generate` then `pnpm db:migrate`
- **New UI components**: Add to `components/` following shadcn/ui patterns
- **API routes**: Create in `app/(chat)/api/` or `app/(auth)/api/`
- **Server actions**: Add to `actions.ts` files in relevant directories
- **AI tools**: Add to `lib/ai/tools/` with Zod schemas for validation

### Testing
- Run `pnpm test` to execute Playwright E2E tests
- Ensure tests pass before committing changes
- Add tests for new features following existing patterns

## Architecture Patterns

### Directory Structure
- `app/` - Next.js App Router pages and layouts
  - `(chat)/` - Chat-related pages and API routes
  - `(auth)/` - Authentication pages and API routes
- `components/` - React components
  - `ui/` - shadcn/ui primitives
  - `custom/` - Custom application components
- `lib/` - Utility functions and shared code
  - `db/` - Database schema and utilities
  - `ai/` - AI SDK configuration and tools
- `actions.ts` files - Server actions for data mutations

### State Management
- Use React Server Components for server state
- Use hooks (useState, useReducer) for client state
- Leverage Server Actions for mutations
- Use Vercel AI SDK hooks for streaming AI responses

### Database Operations
- Use Drizzle ORM for all database queries
- Follow existing query patterns in the codebase
- Always handle errors appropriately
- Use transactions for related operations

## Code Review Checklist

Before submitting code, ensure:
- [ ] TypeScript types are correct and explicit (no `any`)
- [ ] Code follows Biome formatting rules (`pnpm lint` passes)
- [ ] Tests pass (`pnpm test`)
- [ ] Database migrations generated if schema changed
- [ ] Environment variables documented in `.env.example` if added
- [ ] Error handling is appropriate and consistent
- [ ] Performance implications considered
- [ ] Server Components used where possible
- [ ] Security best practices followed

## Security Considerations

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Validate all user inputs with Zod schemas
- Sanitize data before database operations
- Follow Clerk authentication patterns for protected routes
- Use Server Actions for mutations requiring authentication

## Package Manager

**Always use `pnpm`** - not npm or yarn. This project uses pnpm for dependency management.

## Questions or Issues?

- Check existing documentation in AGENTS.md and CLAUDE.md
- Review similar code patterns in the codebase
- Inspect database schema in `lib/db/schema.ts`
- Check API routes for endpoint patterns
- Review component library in `components/ui/`
