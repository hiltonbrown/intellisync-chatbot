# Xero Token Refresh Prompts

This document contains a series of AI prompts designed to implement a robust, proactive token refresh mechanism for the Xero integration. This ensures tokens are always fresh before the user interacts with the application, preventing "Token Expired" errors during critical flows.

## Overview

The proactive refresh system consists of:
1.  **Backend Service (`TokenService`)**: Handles the complex logic of checking expiry, locking (to prevent concurrent refreshes), and updating the database.
2.  **API Endpoint**: A lightweight wrapper to expose this service to the frontend.
3.  **Frontend Hook**: A component that triggers this check transparently when the app loads or the user switches organizations.

---

## Prompt 1: Token Service Implementation

**Goal**: Implement the core `TokenService` class using Prisma.

**Key Requirements**:
*   **Proactive Buffer**: Refresh tokens 10 minutes before they expire.
*   **Rolling Refresh**: Refresh tokens if the *refresh token* itself is > 45 days old (Xero limit is 60 days).
*   **Concurrency Control**: Use a static `Map` to prevent multiple requests for the same grant from hitting the DB/API simultaneously (Single Flight pattern).
*   **Prisma Transactions**: Use `prisma.$transaction` to ensure data integrity during updates.

**Prompt**:

Create `lib/integrations/token-service.ts`.

**Imports needed**: `date-fns` (addMinutes, differenceInDays, isPast), `prisma` (from your db client), `XeroAdapter` (from your adapter file), `IntegrationGrant` (prisma type), encryption utils.

**Class Structure**: `TokenService`

**Method 1: `proactiveRefreshForOrg(orgId: string)`**
*   **Logic**:
    1.  Find all `IntegrationTenantBinding` records where `clerkOrgId` is `orgId` and `status` is "active". Include the `activeGrant` relation.
    2.  If no bindings, return success with 0 refreshed.
    3.  Loop through each binding:
        *   Check if `activeGrant` needs refresh:
            *   `expiresAt` is < 10 minutes from now.
            *   OR `refreshTokenIssuedAt` is > 45 days old.
        *   If yes, call `refreshGrantSingleFlight(grant.id)`.
        *   Catch errors per binding (don't fail the whole batch) and collect them.
    4.  Return an object: `{ success: boolean, refreshedCount: number, errors: Array<{ bindingId, error }> }`.

**Method 2: `getClientForTenantBinding(bindingId: string, orgId: string)`**
*   **Logic**:
    1.  Fetch binding with `activeGrant`. Ensure it belongs to `orgId`.
    2.  Check if `activeGrant` needs refresh (using same logic as above).
    3.  If yes, call `refreshGrantSingleFlight`.
    4.  Return `xeroAdapter.getApiClient(accessToken, tenantId)`.

**Method 3: `refreshGrantSingleFlight(grantId: string)`**
*   **Concurrency Logic**:
    *   Define a static `private static tokenRefreshLocks = new Map<string, Promise<IntegrationGrant>>();`
    *   Check if `grantId` is in the map. If yes, return the existing promise.
    *   If no, create a new promise (the actual refresh logic) and store it in the map.
    *   **Always** remove the promise from the map in a `finally` block.
*   **Refresh Logic (inside the promise)**:
    1.  Fetch the latest grant from DB.
    2.  Check expiry again (in case another process refreshed it). If fresh, return it.
    3.  Decrypt `refreshToken`.
    4.  Call `xeroAdapter.refreshTokens(refreshToken)`.
    5.  **Handle Errors**:
        *   If error is `invalid_grant` (400), this is permanent. Update Grant status to `refresh_failed` and Binding status to `needs_reauth`. Throw error.
        *   If network error (5xx), throw but keep status active (retry later).
    6.  **On Success**:
        *   Encrypt new tokens.
        *   Update Grant in DB: `accessTokenEnc`, `refreshTokenEnc`, `expiresAt`, `refreshTokenIssuedAt`, `status` = "active".
        *   Return updated grant.

---

## Prompt 2: Refresh API Endpoint

**Goal**: Create the API route that the frontend will call.

**Prompt**:

Create `app/api/integrations/xero/refresh/route.ts`.

*   **Method**: `POST`
*   **Auth**: Get `orgId` from Clerk `auth()`.
*   **Logic**:
    *   If no `orgId`, return `{ success: true, hasActiveBindings: false }` (not an error, just nothing to do).
    *   Call `TokenService.proactiveRefreshForOrg(orgId)`.
    *   Return the result as JSON.
*   **Error Handling**: Wrap in try/catch and return 500 if unexpected error occurs.

---

## Prompt 3: Frontend Auto-Refresh Component

**Goal**: A "headless" component that runs this check automatically.

**Prompt**:

Create `components/integrations/xero-token-refresher.tsx`.

*   **Component**: `XeroTokenRefresher` (Client Component).
*   **Hooks**: `useAuth`, `useOrganization` (from Clerk), `useEffect`.
*   **Logic**:
    *   Watch for changes in `orgId`.
    *   When `orgId` changes (and is present), verify if the user is authenticated.
    *   **Throttling**: Use a ref or state to ensure we don't spam the API on every render. Maybe run once per org switch.
    *   **Fetch**: `POST /api/integrations/xero/refresh`.
    *   **Feedback**:
        *   If `refreshedCount > 0`, show a subtle toast (e.g., "Xero connection refreshed").
        *   If errors occur, show a toast: "Xero connection needs attention".
*   **Usage Instruction**: Tell me where to mount this component (e.g., in the root `layout.tsx` or a provider wrapper inside the authenticated routes).

---

## Prompt 4: Update Settings Page

**Goal**: Add a manual "Refresh Now" button to the settings page as a fallback.

**Prompt**:

Update `app/settings/integrations/page.tsx` (created in the previous prompt series) to include:
1.  A "Refresh Tokens" button near the active connections list.
2.  `onClick` handler that calls `/api/integrations/xero/refresh`.
3.  Show a loading spinner on the button while refreshing.
4.  Show a success message with the number of tokens refreshed.
