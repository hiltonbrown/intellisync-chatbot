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

## Recent Codebase Updates
- Introduced per-user OpenRouter key management (`lib/services/openrouter-keys.ts`) with encrypted storage, lifecycle auditing, and Clerk metadata sync.
- Updated chat API (`app/(chat)/api/chat/route.ts`) to pull user-tier entitlements, call OpenRouter with individual keys, stream back real usage/cost data, and gracefully fall back to the shared key when provisioning is unavailable.
- Expanded entitlements framework (`lib/ai/entitlements.ts`, `lib/types.ts`, related components) to model tiers vs. roles and surface credit/usage details in the UI.
- Added Clerk webhook integration (`app/api/clerk/webhook/route.ts`, `lib/services/clerk-webhook-handler.ts`) to automate key provisioning, rotation, and cleanup across the user lifecycle.
- Authored `RBAC-implementation-plan.md` detailing the phased rollout for the upcoming RBAC/admin dashboard work.
