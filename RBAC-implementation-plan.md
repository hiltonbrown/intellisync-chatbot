# IntelliSync RBAC & Admin Platform Implementation Plan

## 1. Foundational Architecture & Schema
- **Define Role Model**: `User`, `Moderator`, `Admin`, `SuperAdmin`; roles independent from subscription tiers.
- **Schema Updates** (Drizzle migration):
  - Extend `User` table with `role`, `featureFlags` (JSONB), `organizationId`, `status` (active/suspended), `lastRoleChangeAt/by`, soft-delete columns.
  - Create `RoleAuditLog` (id, userId, actorId, action, metadata, timestamp).
  - Create `FeatureFlagDefinitions` (id, key, description, defaultRoleScope) and `UserFeatureFlags` override table if needed.
  - Add `UsageSnapshots` for periodic aggregation (userId, period, tokens, credits, cost, cache stats).
  - Update existing OpenRouter key tables to reference organizations if multi-tenant scenarios are expected.
- **Implementation Steps**:
  1. Draft and review migration SQL/Drizzle schema changes.
  2. Apply migrations in dev; backfill roles/tier metadata.
  3. Update `lib/db/queries.ts` helpers for new columns.
  4. Sync Clerk metadata to carry role/tier/featureFlags.
- **Backfill & Migration Guide**:
  - Map current users to `User/free` default; admins seeded manually.
  - Maintain shared-key fallback for legacy until per-user provisioning confirmed.
  - Document rollback (revert schema, restore shared key in env).

## 2. Entitlements & Permission Matrix
- **Define rolePermissions.ts** module:
  - CRUD operations per role (chat, moderation, user management, billing, key rotation, feature flags, reporting, bulk actions).
  - Associate per-role resource limits (concurrent chats, max messages/day, rate limits) independent of subscription tier.
- **Define subscriptionEntitlements.ts** module:
  - `Free`, `Pro`, `Enterprise` caps (usage credits, premium models, support levels) without overriding roles.
  - Combine role + tier at runtime (`resolveEffectiveEntitlements(user)` helper).
- **Feature Flags**:
  - Enumerate `betaFeatures`, `apiAccess`, `workflowBuilder`, `whitelabel` etc; set defaults per role/tier.
  - Provide toggle service with audit logging.
- **Implementation Steps**:
  1. Author role and tier config files with TypeScript types.
  2. Build entitlement resolver utility + unit tests.
  3. Implement feature flag service (read default + overrides).
  4. Integrate with existing request/session builders.

## 3. Middleware & Authorization Layer
- **Global Edge Middleware (middleware.ts)**:
  - Fetch session claims (role, tier, status, featureFlags).
  - Block suspended accounts; redirect to compliance/offboarding.
  - Enforce onboarding completion before granting admin routes.
- **Route Guards**:
  - `/admin` → Admin+; `/moderator` → Moderator+; `/analytics` & `/reports` → Moderator+; `/settings/api-keys` → Admin+; mass operations → SuperAdmin.
  - Provide `withRoleGuard({ minRole, auditAction })` server util for API routes.
- **Audit Hooks**:
  - Extend existing audit logging to capture who performed role changes, key rotations, bulk operations (write to `RoleAuditLog`).
- **Implementation Steps**:
  1. Update middleware to hydrate role/tier from Clerk tokens/DB.
  2. Introduce guard helpers for server actions/API handlers.
  3. Ensure guard failures log audit events and return consistent errors.
  4. Add integration tests for protected routes.

## 4. Backend Services & APIs
- **Role Management API**:
  - Endpoints for assigning roles, toggling feature flags, suspending users, mass operations (SuperAdmin).
  - All endpoints enforce RBAC, emit audit events, update Clerk metadata.
- **Usage Analytics API**:
  - Aggregate per-role/per-tier usage from `UsageSnapshots` + real-time deltas.
  - Support filters (date range, role, tier, organization).
- **OpenRouter Key Management API**:
  - Wrap existing key service with admin endpoints for rotate/disable/update limits, including batch actions with transactional safety.
- **Bulk Operations Queue**:
  - For mass rotations/role changes, enqueue jobs (e.g., via database-based queue or serverless cron) with progress tracking.
- **Logging & Alerts**:
  - Integrate with existing logging subsystem; emit logs on elevated actions (role change, key update, billing threshold, suspicious usage).
- **Implementation Steps**:
  1. Scaffold admin API routes with guard middleware.
  2. Implement role/flag mutations and Clerk metadata sync.
  3. Expose usage analytics endpoints (server actions or REST) backed by snapshots + live data.
  4. Extend key service with admin operations + audit logging.
  5. (Optional) add queue/backoff for bulk operations.

## 5. Admin Dashboard UX
- **Layout**: Multi-panel React dashboard under `/admin` using existing component library.
  1. **Overview panel**: KPIs (total usage, costs, active keys, alerts). Role/tier badges.
  2. **User Management**: searchable table with filters (role, tier, status, usage). Actions: change role, change tier, suspend/reactivate, reset MFA (if applicable).
  3. **Key Management**: per-user key status, rotate/disable buttons, bulk actions, history log.
  4. **Usage Analytics**: charts (line/bar) for usage per role/tier, top users, cache hit rates, historical trends, export buttons.
  5. **Feature Flags**: toggle controls per user/role, live preview of enabled features.
  6. **Audit Trail**: paginated list of admin actions with filters, downloadable CSV.
- **Visual Indicators**: consistent badge styles for role (color-coded), tier, status; warning banners for suspended/over-quota users.
- **Real-Time Data**: leverage SWR polling or websockets for high-frequency metrics.
- **Implementation Steps**:
  1. Produce low-fidelity wireframes for stakeholder review.
  2. Build dashboard shell + navigation with role-aware menu items.
  3. Implement each panel iteratively (User Mgmt → Keys → Analytics → Flags → Audit).
  4. Hook panels to new APIs; add optimistic updates and error handling.
  5. Apply visual indicators and accessibility checks.

## 6. Testing Strategy
- **Unit Tests**:
  - Permission helpers, entitlement resolution, feature flag gating.
- **Integration/API Tests**:
  - Role assignment endpoints, key operations, middleware guards, usage aggregation.
- **E2E/Playwright**:
  - Admin dashboard flows, role change cascade, suspension blocking, fallback when provisioning unavailable.
- **Security Tests**:
  - Attempt privilege escalation, unauthorized route access, idempotency on bulk ops.
- **Migration Tests**:
  - Verify legacy users maintain access; ensure audit logs generated during migration.
- **Implementation Steps**:
  1. Define test matrix per phase; add to CI.
  2. Write targeted unit tests alongside utilities.
  3. Author API/integration tests for admin endpoints.
  4. Expand Playwright suite for dashboard + guard flows.
  5. Document manual QA scripts for rollout.

## 7. Rollout & Fallback Plan
- **Phase 1**: Deploy schema migrations + role metadata; keep UI hidden behind feature flag.
- **Phase 2**: Enable middleware guards in staging; run QA scenarios (onboarding, tier upgrade/downgrade, key rotation, suspension).
- **Phase 3**: Launch admin dashboard to limited SuperAdmins; monitor audit logs & metrics.
- **Fallbacks**:
  - Environment flag to disable per-user provisioning and revert to shared key.
  - Ability to revert role to baseline `User/free` for all accounts quickly.
  - Document manual recovery steps for key rotation failures.
- **Documentation**:
  - Admin guide (roles, permissions, workflows).
  - Compliance notes (audit storage, retention policies).
  - Developer docs for adding new roles/flags/providers.
- **Implementation Steps**:
  1. Draft rollout checklist with success metrics.
  2. Configure feature flags/env toggles for phased launch.
  3. Prepare communication plan (admins, support, compliance).
  4. Establish monitoring dashboards/alerts prior to launch.
  5. Run post-launch review and iterate.

## 8. Future Extensibility
- Modularize role definitions to read from config (e.g., JSON or CMS) for quicker additions.
- Abstract provider APIs to support future AI vendors; reuse key management UX.
- Consider multi-tenant organizations with delegated admins (Org Admin role).
- Integrate anomaly detection alerts (usage spikes, high denial rates) into dashboard.
