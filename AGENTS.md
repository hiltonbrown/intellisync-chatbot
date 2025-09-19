# Repository Guidelines

## Project Structure & Module Organization
The Next.js app lives in `app/`, with chat flows under `app/(chat)/` and shared providers in `app/(chat)/layout.tsx`. Reusable UI lives in `components/` and `src/ui/` (Subframe exports), while domain logic, AI tools, and Drizzle schema sit in `lib/`. Artifact renderers are centralized in `artifacts/`, and static assets belong in `public/`. End-to-end Playwright suites reside in `tests/` alongside helpers and fixtures.

## Build, Test, and Development Commands
Use `pnpm dev` for local development. Run `pnpm build` before release—it automatically runs `tsx lib/db/migrate.ts` prior to `next build`. Production preview uses `pnpm start`. Database migrations are managed with `pnpm db:migrate` (Drizzle + Neon). Execute all Playwright E2E suites via `pnpm test` after exporting `PLAYWRIGHT=True`; target a single run with `npx playwright test tests/e2e/<file>.test.ts --project=e2e`.

## Coding Style & Naming Conventions
Formatting is enforced by Biome (`pnpm lint` / `pnpm format`), which expects 2-space indentation, 80-character lines, single quotes in JS, double quotes in JSX, and trailing commas. Tailwind class order is validated (use the `cn()` helper for conditional merges). React components and files that export components follow PascalCase; utilities remain camelCase. Keep TypeScript types colocated with their modules in `lib/` or `src/ui/`.

## Testing Guidelines
Playwright is the primary test runner; place new journeys in `tests/e2e/` and reuse fixtures from `tests/fixtures.ts`. Name tests after the user path they cover (e.g., `artifacts.test.ts`). Record observed failures and screenshots with the default Playwright reporters. When migrations touch persisted data, add a corresponding test step that exercises the new schema.

## Commit & Pull Request Guidelines
Commits follow a short, present-tense summary (`Openrouter + UI fixes`, `DB migration`); mirror this style and keep related changes together. Each PR should: explain the problem and solution, note any schema or config changes, link tracking issues, and attach UI screenshots or console output when behavior changes. Run `pnpm build` and relevant Playwright specs before requesting review, and call out any skipped coverage or follow-up work.

## Security & Configuration Tips
Store secrets in `.env.local`; never commit `.env` files. Verify Neon and Redis credentials locally before running migrations. Middleware automatically redirects guest traffic to `/api/auth/guest`, so keep authentication checks in server actions and API routes consistent. Pyodide executes untrusted code in-browser—avoid introducing server-side execution paths for artifacts without review.
