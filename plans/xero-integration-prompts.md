# Xero Integration Prompts

This document contains a series of AI prompts designed to implement a robust Xero integration into a Next.js 15+ project using Clerk, Prisma, and Postgres.

## Overview

The integration follows a "connect once, bind many" pattern:
1.  **IntegrationGrant**: Represents the OAuth connection (tokens) for a user/org.
2.  **IntegrationTenantBinding**: Links a specific Xero Tenant (Organization) to a Clerk Organization using a Grant.

This separation allows a single user to authenticate once and connect multiple Xero organizations, or switch which Xero org is connected without re-authenticating.

## Prerequisites

*   Next.js 15+ (App Router)
*   Clerk (Auth)
*   Prisma (ORM)
*   Postgres (Database)
*   **No Redis** (State management adapted to DB)

---

## Prompt 1: Schema & Environment Setup

**Goal**: Set up the database schema and environment variables.

**Prompt**:

I need to set up the database schema for a Xero integration. I am using Prisma with Postgres. Please add the following models to my `schema.prisma` file.

**Requirements:**
1.  `IntegrationGrant`: Stores OAuth tokens.
    *   Fields: `id` (UUID), `authorisedByClerkUserId` (String), `clerkOrgId` (String), `provider` (String, default "xero"), `accessTokenEnc` (String), `refreshTokenEnc` (String), `refreshTokenIssuedAt` (DateTime), `expiresAt` (DateTime), `status` (String: "active", "revoked", "refresh_failed"), `createdAt`, `updatedAt`, `lastUsedAt`.
    *   Relation: `tenantBindings` (One-to-Many with `IntegrationTenantBinding`).
    *   Indexes on `clerkOrgId` and `expiresAt`.
2.  `IntegrationTenantBinding`: Links a Xero tenant to a Clerk org.
    *   Fields: `id` (UUID), `clerkOrgId` (String), `provider` (String, default "xero"), `externalTenantId` (String), `externalTenantName` (String), `activeGrantId` (UUID, Foreign Key to IntegrationGrant), `status` (String: "active", "suspended", "revoked", "needs_reauth"), `createdAt`, `updatedAt`.
    *   Relation: `activeGrant` (Many-to-One with `IntegrationGrant`).
    *   Unique constraint on `[provider, externalTenantId]`.
3.  `VerificationToken`: Stores temporary OAuth state/nonces (replacing Redis).
    *   Fields: `identifier` (String, unique - this will be the nonce), `token` (String - the full state payload), `expires` (DateTime).

**Environment Variables:**
Create a `.env.example` snippet with:
*   `XERO_CLIENT_ID`
*   `XERO_CLIENT_SECRET`
*   `XERO_REDIRECT_URI`
*   `ENCRYPTION_KEY` (32-character hex string for token encryption)

---

## Prompt 2: Utilities & Encryption

**Goal**: specific utility classes for error handling and encryption.

**Prompt**:

Create two utility files:

1.  `lib/integrations/errors.ts`:
    *   Define a base `IntegrationError` class.
    *   Define subclasses: `AuthError`, `TokenError`, `ExternalAPIError`, `RateLimitError`, `ConfigError`.
    *   These should capture status codes and operational flags.

2.  `lib/utils/encryption.ts`:
    *   Implement `encryptToken(text: string): string` and `decryptToken(encryptedText: string): string`.
    *   Use `aes-256-gcm` algorithm.
    *   Use the `ENCRYPTION_KEY` env var.
    *   The output format should be `iv:authTag:encryptedData` (hex encoded).

---

## Prompt 3: Xero Adapter

**Goal**: Create the core adapter class that interacts with Xero's API.

**Context**:
Use the following logic as a reference for `lib/integrations/xero/adapter.ts`.

```typescript
// [INSERT CONTENT OF lib/integrations/xero/adapter.ts]
// Omit the 'rate-limiter' import if not available, or mock it.
```

**Prompt**:

Create `lib/integrations/xero/adapter.ts`.
*   It should handle OAuth URL generation (`getAuthUrl`).
*   It should handle Code Exchange (`exchangeCode`).
*   It should handle Token Refresh (`refreshTokens`).
*   It should handle Fetching Tenants (`getTenants`).
*   It should handle Token Revocation (`revokeToken`).
*   It should provide an `getApiClient` method that returns a `fetch` wrapper with automatic header injection.

---

## Prompt 4: Auth Flow (Start & Callback)

**Goal**: Implement the OAuth 2.0 flow endpoints, using Prisma for state verification instead of Redis.

**Prompt**:

Create two Next.js API routes (App Router):

1.  `app/api/integrations/xero/start/route.ts`:
    *   Check for Clerk auth (`userId`, `orgId`). Restrict to `org:admin`.
    *   Generate a secure random `nonce`.
    *   Store the nonce and state in the `VerificationToken` Prisma table (expire in 10 mins).
    *   Construct the Xero Auth URL with the state.
    *   Redirect the user.

2.  `app/api/integrations/xero/callback/route.ts`:
    *   Verify `code` and `state` params.
    *   Decode the state.
    *   **Verify the nonce**: Check if it exists in `VerificationToken` and hasn't expired. Delete it after use.
    *   **Verify User/Org**: Ensure the `userId` and `orgId` in the state match the current session.
    *   Exchange the code for tokens using `XeroAdapter`.
    *   Store the new `IntegrationGrant` in Prisma (encrypting tokens).
    *   Redirect to `/settings/integrations?action=select_tenant&grantId={grantId}`.

---

## Prompt 5: Token Service & Refresh Logic

**Goal**: Implement a service to handle token lifecycle and proactive refreshing.

**Context**:
See `lib/integrations/token-service.ts` for logic.
**Important**: Adapt the Drizzle `db.transaction` and locking logic to Prisma. Prisma doesn't support explicit `FOR UPDATE` in the same way. Use `prisma.$transaction` and rely on optimistic concurrency (or just standard transaction isolation) for now, or use `$queryRaw` if strict locking is needed.

**Prompt**:

Create `lib/integrations/token-service.ts` with a `TokenService` class.

**Features:**
1.  `proactiveRefreshForOrg(orgId)`:
    *   Find all active `IntegrationTenantBinding`s for the org.
    *   Check if their grants are expiring soon (e.g., < 10 mins) or if the refresh token is old (> 45 days).
    *   Refresh them if needed.

2.  `getClientForTenantBinding(bindingId, orgId)`:
    *   Get the binding and its grant.
    *   Refresh if expired.
    *   Return the `XeroAdapter` client.

3.  `refreshGrantSingleFlight(grantId)`:
    *   **Crucial**: Handle concurrent refreshes.
    *   Use a static Map (`tokenRefreshLocks`) to prevent multiple in-flight requests for the same grant in the same process.
    *   Use a Prisma transaction to fetch, refresh, and update the grant.
    *   Handle `invalid_grant` errors by marking the grant as `refresh_failed`.

---

## Prompt 6: Management API Routes

**Goal**: APIs for the frontend to list tenants, select a tenant, and disconnect.

**Prompt**:

Create the following API routes:

1.  `app/api/integrations/xero/tenants/list/route.ts`:
    *   GET request.
    *   Validate `grantId` and ensure it belongs to the current Org.
    *   Use `XeroAdapter.getTenants` to list available Xero organizations.

2.  `app/api/integrations/xero/tenants/select/route.ts`:
    *   POST request (`grantId`, `tenantId`).
    *   Validate grant ownership.
    *   Verify the grant *can* access the requested `tenantId` (call Xero API).
    *   Upsert `IntegrationTenantBinding`:
        *   If a binding exists for this `tenantId` in *another* org, return 409 Conflict.
        *   If it exists in the *same* org, update it to use the new `grantId`.
        *   Otherwise, create a new binding.

3.  `app/api/integrations/xero/disconnect/route.ts`:
    *   POST request (`tenantBindingId`).
    *   Mark binding as `revoked`.
    *   Check for "Orphaned Grants" (grants with no active bindings).
    *   If orphaned, revoke the grant (call Xero API) and delete/clear tokens in DB.

---

## Prompt 7: Frontend Integration Page

**Goal**: A settings page to manage the connection.

**Context**:
Reference `app/(chat)/settings/integrations/page.tsx` for the UI layout and logic.

**Prompt**:

Create a React component `app/settings/integrations/page.tsx`.

**Features:**
*   List connected organizations (`IntegrationTenantBinding`).
*   Show status (Active, Error, Token Health).
*   "Connect Xero" button -> redirects to `/api/integrations/xero/start`.
*   "Refresh Tokens" button -> calls `/api/integrations/xero/refresh` (you'll need to create this simple wrapper around `TokenService.proactiveRefreshForOrg`).
*   **Tenant Selection Modal**:
    *   When URL has `?action=select_tenant&grantId=...`, open a modal.
    *   Fetch tenants from `/api/integrations/xero/tenants/list`.
    *   Let user select one -> POST to `/api/integrations/xero/tenants/select`.
*   Handle "Disconnect" action.

**Styling**: Use Tailwind CSS and Shadcn UI components (Card, Button, Badge, Dialog, Table/List).
