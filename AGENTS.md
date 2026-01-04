# AGENTS.md

This file provides general guidance for AI agents working with this Next.js AI Chatbot codebase.

## Quick Start

This is a **Next.js AI Chatbot** application built with modern web technologies. For detailed technical documentation, see [`CLAUDE.md`](CLAUDE.md).

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

- **Frontend**: Next.js 16 App Router with React Server Components
- **Backend**: API routes in `app/api/`, server actions in `actions.ts` files
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: Vercel AI SDK with multiple model providers
- **Authentication**: NextAuth v5 with credentials and guest modes

## Common Tasks

### Adding New Features

1. **UI Components**: Add to `components/` following shadcn/ui patterns
2. **API Routes**: Create in `app/(chat)/api/` or `app/(auth)/api/`
3. **Database Changes**: Modify `lib/db/schema.ts`, run migrations
4. **AI Tools**: Add to `lib/ai/tools/` with Zod schemas

### Debugging Issues

- Check browser console and server logs
- Use `pnpm db:studio` to inspect database
- Run `pnpm test` to verify functionality
- Check environment variables in `.env.local`

### Code Review Checklist

- [ ] TypeScript types are correct and explicit
- [ ] Code follows Biome formatting rules
- [ ] Tests pass (`pnpm test`)
- [ ] Database migrations are generated if schema changed
- [ ] Environment variables documented if added
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed

## Model-Specific Guidance

For model-specific guidance, see:

- [`CLAUDE.md`](CLAUDE.md) - Anthropic Claude models
- [`GEMINI.md`](GEMINI.md) - Google Gemini models

## Getting Help

- **Project Structure**: See [`CLAUDE.md`](CLAUDE.md) for detailed architecture
- **API Documentation**: Check route handlers in `app/api/`
- **Component Library**: Explore `components/ui/` for available primitives
- **Database Schema**: Review `lib/db/schema.ts` for data models
