# Repository Guidelines

## Project Structure & Module Organization
The Next.js app lives in `app/`, with chat flows under `app/(chat)/` and shared providers in `app/(chat)/layout.tsx`. Reusable UI sits in `components/` and `src/ui/`, while domain logic, AI tools, and Drizzle schema stay in `lib/`. Artifact renderers are centralized in `artifacts/`, static assets in `public/`, and end-to-end suites with fixtures live in `tests/`.

## Build, Test, and Development Commands
Use `pnpm dev` for the local Next.js dev server. `pnpm build` runs database migrations (`tsx lib/db/migrate.ts`) before `next build`; follow with `pnpm start` to preview production. Manage migrations explicitly with `pnpm db:migrate`. Run full Playwright coverage by exporting `PLAYWRIGHT=True` then `pnpm test`. Target a single journey via `npx playwright test tests/e2e/<file>.test.ts --project=e2e`.

## Coding Style & Naming Conventions
Biome enforces formatting (`pnpm lint`, `pnpm format`): 2-space indentation, 80-character lines, single quotes in JS, double quotes in JSX, and trailing commas. Keep Tailwind classes sorted and prefer the `cn()` helper for conditional merges. React components use PascalCase filenames and exports; utilities stay camelCase. Co-locate TypeScript types with their modules in `lib/` or `src/ui/`.

## Testing Guidelines
Playwright drives UI regression coverage. Place new journeys in `tests/e2e/`, name them after the user flow (e.g., `artifacts.test.ts`), and reuse shared fixtures from `tests/fixtures.ts`. Capture failures with the default reporters and include screenshots when triaging. When schema changes land, add a test step that exercises the new data shape.

## Commit & Pull Request Guidelines
Write concise, present-tense commit messages (`Openrouter + UI fixes`, `DB migration`). PRs should explain the problem and solution, highlight schema/config updates, link tracking issues, and add screenshots or console output for UX shifts. Run `pnpm build` and the relevant Playwright specs before requesting review, and document any skipped coverage or follow-up tasks.

## Security & Configuration Tips
Store secrets in `.env.local` and keep Neon/Redis credentials verified before migrations. Middleware protects chat routes with Clerk and redirects unauthenticated users to `/login`; keep server actions and APIs auth-aware. Pyodide executes untrusted code client-side—avoid introducing new server execution paths for artifacts without review.
