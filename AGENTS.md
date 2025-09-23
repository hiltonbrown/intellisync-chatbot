# Repository Guidelines

## Project Structure & Module Organization

The Next.js App Router lives in `app/`, with feature groups such as `(auth)` and `(chat)` plus API handlers under `app/api/`. Shared UI primitives and layouts sit in `components/` and `src/ui/`, while domain logic, AI adapters, and database helpers are grouped under `lib/` (see `lib/db` for Drizzle migrations and `lib/ai` for provider wiring). Front-end assets reside in `public/`, and Playwright fixtures and helpers are maintained in `tests/` alongside generated reports in `playwright-report/`.

## Build, Test, and Development Commands

Run `pnpm install` once per clone, then `pnpm dev` to start the local server on port 3000. Use `pnpm build` to apply database migrations via `tsx lib/db/migrate` and produce a production bundle, followed by `pnpm start` when testing the optimized build. `pnpm lint` (or `pnpm lint:fix`) enforces Biome rules, and `pnpm format` auto-formats sources. Database tasks rely on Drizzle: `pnpm db:generate` updates SQL artifacts, while `pnpm db:migrate` executes migrations. Execute end-to-end suites with `pnpm test`, which boots Playwright using the `tests/` scenarios.

## Coding Style & Naming Conventions

TypeScript and React components should use 2-space indentation and stay strongly typed—export shared types through `lib/types.ts`. Favor server components by default; opt into `"use client"` only when hooks demand it. Components and hooks use PascalCase filenames (`ChatHeader.tsx`), while utilities remain camelCase (`formatMessage.ts`). Tailwind utility classes follow the conventions in `src/ui/tailwind.config.js`; run Biome before committing to ensure lint and format compliance.

## Testing Guidelines

Playwright drives integration coverage, with specs living in `tests/e2e` and named `*.spec.ts`. Keep fixtures reusable via `tests/fixtures.ts`, and prefer data from `tests/prompts/` or `tests/routes/` over inline literals. When adding user flows, record expected UI states or screenshots in the generated Playwright report, and rerun `pnpm test` locally to confirm stability before pushing. Run unit tests with `pnpm test:unit`, which uses Vitest for component and utility testing.

## Accounting Integrations

The application supports integrations with accounting platforms to sync financial data. Currently supported providers include QuickBooks Online, Xero, and FreshBooks (coming soon). Integrations use OAuth 2.0 for secure connections and support syncing invoices, bills, expenses, and other financial records. Integration status and management is available through the settings panel, with data stored in the `AccountingIntegration` table.

## Commit & Pull Request Guidelines

Recent history favors brief, lowercase summaries such as `bug fixes` and `authentication redirect fix`; keep following that concise style while clarifying scope (e.g., `auth: fix redirect loop`). Squash commits as needed so each PR tells a clear story. In pull requests, include a short problem statement, reference any GitHub issues, list manual verification steps (commands, screenshots, or links to Playwright output), and flag migrations or config changes so reviewers can provision matching environments.

## Environment & Configuration

Copy `.env.example` to `.env.local` and fill credentials for the AI gateway, database, and Clerk auth. The recommended workflow is `vercel link` then `vercel env pull` to sync secrets; never commit local `.env*` files. When adjusting configuration (e.g., `drizzle.config.ts` or `next.config.ts`), document the change in the PR description and coordinate any required infrastructure updates.

## Recent Codebase Updates

- Introduced per-user OpenRouter key management (`lib/services/openrouter-keys.ts`) with encrypted storage, lifecycle auditing, and Clerk metadata sync.
- Updated chat API (`app/(chat)/api/chat/route.ts`) to pull user-tier entitlements, call OpenRouter with individual keys, stream back real usage/cost data, and gracefully fall back to the shared key when provisioning is unavailable.
- Expanded entitlements framework (`lib/ai/entitlements.ts`, `lib/types.ts`, related components) to model tiers vs. roles and surface credit/usage details in the UI.
- Added Clerk webhook integration (`app/api/clerk/webhook/route.ts`, `lib/services/clerk-webhook-handler.ts`) to automate key provisioning, rotation, and cleanup across the user lifecycle.
- Authored `RBAC-implementation-plan.md` detailing the phased rollout for the upcoming RBAC/admin dashboard work.
- Re-engineered available chat models to use OpenRouter preset '@preset/intellisync-chatbot' with curated model selection stored in `models.txt` for easy maintenance and faster loading.
- Implemented server-side model routing with `lib/ai/server-models.ts` that reads from `models.txt` and provides filtered model lists to the API.
- Updated model API endpoint (`app/api/models/route.ts`) to serve curated models instead of fetching all OpenRouter models, improving performance and ensuring only vetted models are available.
- Modified FloatingModelSelector component to fetch models from the API endpoint, enabling dynamic model updates without code changes.
- Standardized AI tools system with `ToolContext` interface providing chat ID, selected model, and provider client to all tools for consistent context passing.
- Implemented email fraud analysis tool (`lib/ai/tools/analyze-email-fraud.ts`) with step-by-step user guidance and AI-powered risk assessment using the selected model.
- Added accounting integrations for QuickBooks Online, Xero, and FreshBooks (coming soon) with OAuth-based connections and data syncing capabilities (`lib/services/integrations/`, `app/(chat)/api/integrations/`, `AccountingIntegration` table).
- Implemented additional AI tools: create-document (`lib/ai/tools/create-document.ts`), get-weather (`lib/ai/tools/get-weather.ts`), request-suggestions (`lib/ai/tools/request-suggestions.ts`), and update-document (`lib/ai/tools/update-document.ts`).
- Introduced unit testing with Vitest via `pnpm test:unit` for component and utility testing.
- Added new settings pages for billing/usage tracking (`app/(chat)/settings/billing-usage/`) and integration management (`app/(chat)/settings/integration-settings/`).
