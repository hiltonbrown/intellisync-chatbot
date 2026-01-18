# Clerk Authentication & Xero Integration Technical Documentation

**Version:** 1.0
**Last Updated:** 2026-01-18
**Application:** IntelliSync AI Chatbot

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Clerk Authentication System](#clerk-authentication-system)
3. [Xero OAuth 2.0 Integration](#xero-oauth-20-integration)
4. [Integration Flow](#integration-flow)
5. [Token Management & Refresh](#token-management--refresh)
6. [Database Schema](#database-schema)
7. [Security Considerations](#security-considerations)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [API Endpoints Reference](#api-endpoints-reference)
10. [Sequence Diagrams](#sequence-diagrams)

---

## Architecture Overview

### System Components

The integration consists of three primary systems working together:

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  Clerk Auth     │◄───────►│  Application    │◄───────►│  Xero API       │
│  (User/Org)     │         │  (Next.js)      │         │  (Accounting)   │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                    │
                                    │
                                    ▼
                            ┌─────────────────┐
                            │                 │
                            │  PostgreSQL DB  │
                            │  (Token Store)  │
                            │                 │
                            └─────────────────┘
```

### Key Integration Points

1. **Clerk** - Handles user authentication and organization management
2. **Application** - Next.js 16 with App Router, mediates between Clerk and Xero
3. **Xero** - Third-party accounting platform accessed via OAuth 2.0
4. **Database** - PostgreSQL with encrypted token storage

### Technology Stack

- **Authentication:** Clerk (with organization support)
- **Framework:** Next.js 16.1.1 with App Router
- **Database:** PostgreSQL (Neon) with Drizzle ORM 0.45.1
- **Encryption:** AES-256-GCM for token storage
- **Scheduling:** Vercel Cron for token refresh

---

## Clerk Authentication System

### User Authentication

Clerk provides the foundation for user identity and session management.

#### Authentication Flow

```
User → Login Page → Clerk Auth → Session Cookie → Application
```

**Implementation:** `app/(auth)/login/[[...rest]]/page.tsx`

```typescript
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return <SignIn />;
}
```

#### Session Access Patterns

**Server Components & Route Handlers:**

```typescript
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Use userId for database queries
}
```

**Session Data Available:**
- `userId` - Unique Clerk user ID (text format: `user_xxxxxxxxxxxxx`)
- `orgId` - Current organization ID (text format: `org_xxxxxxxxxxxxx`)
- `orgRole` - User's role in organization (`org:admin`, `org:owner`, `org:member`)

### Organization Support

Organizations enable multi-tenant architecture where multiple users can collaborate under a single Xero integration.

#### Organization Context

**Key Principles:**
- Xero integrations are **organization-scoped**, not user-scoped
- Only `org:admin` and `org:owner` roles can manage integrations
- Users can switch between organizations via `OrganizationSwitcher`

**UI Components:**

```typescript
// components/elements/settings-header.tsx
import { OrganizationSwitcher } from "@clerk/nextjs";

<OrganizationSwitcher
  hidePersonal={true}  // Only show organization contexts
/>
```

#### Authorization Checks

**Integration Management:**

```typescript
// app/api/integrations/xero/start/route.ts
const { userId, orgId, orgRole } = await auth();

if (!userId || !orgId) {
  return new Response("Unauthorized: Org context required", { status: 401 });
}

if (orgRole !== "org:admin" && orgRole !== "org:owner") {
  return new Response("Unauthorized: Admin access required", { status: 403 });
}
```

### User → Database Mapping

**User Table Schema:**

```typescript
export const user = pgTable("User", {
  id: text("id").primaryKey().notNull(),  // Clerk userId
  email: varchar("email", { length: 64 }).notNull(),
  systemPrompt: text("systemPrompt"),  // User customization
});
```

**Important:** Clerk manages user data; the application database only stores the user ID reference and application-specific data.

---

## Xero OAuth 2.0 Integration

### OAuth 2.0 Flow Overview

Xero uses standard OAuth 2.0 Authorization Code Grant with PKCE-like security.

```
User clicks "Connect Xero"
    ↓
Application generates state (contains userId + orgId)
    ↓
Redirect to Xero authorization endpoint
    ↓
User authorizes application (Xero login page)
    ↓
Xero redirects back with authorization code
    ↓
Application exchanges code for tokens
    ↓
Store encrypted tokens in database
    ↓
Fetch available Xero tenants
    ↓
User selects tenant to connect
    ↓
Create tenant binding → READY
```

### Step 1: Authorization Request

**Endpoint:** `GET /api/integrations/xero/start`

**File:** `app/api/integrations/xero/start/route.ts`

**Authorization Requirements:**
- User must be authenticated (Clerk session)
- User must be in organization context
- User must have `org:admin` or `org:owner` role

**Process:**

```typescript
const { userId, orgId, orgRole } = await auth();

// Security: Encode user/org context in state
const state = Buffer.from(
  JSON.stringify({
    clerk_user_id: userId,
    clerk_org_id: orgId,
    nonce: Math.random().toString(36).substring(7)  // CSRF protection
  })
).toString("base64");

// Generate Xero authorization URL
const url = xeroAdapter.getAuthUrl(state);

redirect(url);  // Redirect to Xero
```

**Xero Authorization URL Format:**

```
https://login.xero.com/identity/connect/authorize?
  response_type=code
  &client_id={XERO_CLIENT_ID}
  &redirect_uri={XERO_REDIRECT_URI}
  &scope=offline_access accounting.transactions accounting.settings accounting.contacts
  &state={base64_encoded_state}
```

**Scopes Requested:**
- `offline_access` - Required for refresh tokens
- `accounting.transactions` - Access to invoices, bills, payments
- `accounting.settings` - Access to chart of accounts, tax rates
- `accounting.contacts` - Access to customers and suppliers

### Step 2: Authorization Callback

**Endpoint:** `GET /api/xero/callback`

**File:** `app/api/xero/callback/route.ts`

**Callback Parameters:**
- `code` - Authorization code (short-lived, single-use)
- `state` - State parameter from request (for CSRF validation)
- `scope` - Granted scopes (for verification)

**Security Validations:**

```typescript
// 1. Decode and validate state
const decodedState = JSON.parse(
  Buffer.from(state, "base64").toString("utf-8")
);

// 2. Verify current session matches state
const { userId, orgId } = await auth();

if (userId !== decodedState.clerk_user_id) {
  return new Response("Unauthorized: User mismatch", { status: 403 });
}

// 3. Verify organization context (optional but recommended)
if (orgId !== decodedState.clerk_org_id) {
  console.warn("Org ID mismatch in callback");
}
```

**Token Exchange:**

```typescript
// Exchange authorization code for tokens
const tokenSet = await xeroAdapter.exchangeCode(code);

// tokenSet contains:
// {
//   access_token: string,      // 30-minute lifespan
//   refresh_token: string,     // 60-day lifespan (rolling)
//   expires_in: number,        // Seconds until expiration (1800)
//   id_token: string,          // JWT with user info
//   token_type: "Bearer"
// }
```

**Store Grant in Database:**

```typescript
const [grant] = await db
  .insert(integrationGrants)
  .values({
    authorisedByClerkUserId: decodedState.clerk_user_id,
    clerkOrgId: decodedState.clerk_org_id,
    provider: "xero",
    accessTokenEnc: encryptToken(tokenSet.access_token),
    refreshTokenEnc: encryptToken(tokenSet.refresh_token),
    expiresAt: addMinutes(new Date(), 30),  // Default 30 mins
    status: "active",
  })
  .returning();
```

**Critical Implementation Detail:**

```typescript
// IMPORTANT: redirect() must be OUTSIDE try/catch
// Next.js throws NEXT_REDIRECT error internally
redirect(`/settings/integrations?action=select_tenant&grantId=${grant.id}`);
```

### Step 3: Tenant Selection

**Endpoint:** `GET /api/integrations/xero/tenants/list`

Xero supports multiple organizations (tenants) per authorization. Users must select which tenant to connect.

**Fetch Available Tenants:**

```typescript
const tenants = await xeroAdapter.getTenants(accessToken);

// Tenant format:
// {
//   id: string,              // Connection ID
//   tenantId: string,        // Organization ID
//   tenantName: string,      // "Acme Corp"
//   tenantType: string,      // "ORGANISATION"
// }
```

**Create Tenant Binding:**

```typescript
// app/api/integrations/xero/tenants/select/route.ts
await db.insert(integrationTenantBindings).values({
  clerkOrgId: orgId,
  provider: "xero",
  externalTenantId: selectedTenant.tenantId,
  externalTenantName: selectedTenant.tenantName,
  activeGrantId: grantId,
  status: "active",
});
```

### XeroAdapter Implementation

**File:** `lib/integrations/xero/adapter.ts`

The adapter encapsulates all Xero API interactions:

```typescript
export class XeroAdapter {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.XERO_CLIENT_ID || "";
    this.clientSecret = process.env.XERO_CLIENT_SECRET || "";
    this.redirectUri = process.env.XERO_REDIRECT_URI || "";
  }

  // Generate authorization URL
  getAuthUrl(state: string): string { ... }

  // Exchange code for tokens
  async exchangeCode(code: string): Promise<XeroTokenSet> { ... }

  // Refresh access token
  async refreshTokens(refreshToken: string): Promise<XeroTokenSet> { ... }

  // Get connected tenants
  async getTenants(accessToken: string): Promise<XeroTenant[]> { ... }

  // Revoke token (disconnect)
  async revokeToken(token: string): Promise<void> { ... }

  // Get authenticated API client
  getApiClient(accessToken: string, tenantId: string) { ... }
}
```

---

## Integration Flow

### Complete Authorization Sequence

```
┌─────────┐         ┌─────────────┐         ┌──────────┐         ┌──────────┐
│  User   │         │ Application │         │  Clerk   │         │   Xero   │
└────┬────┘         └──────┬──────┘         └─────┬────┘         └─────┬────┘
     │                     │                      │                    │
     │ 1. Login           │                      │                    │
     ├────────────────────►│                      │                    │
     │                     │ 2. Auth Check       │                    │
     │                     ├─────────────────────►│                    │
     │                     │ 3. Session Cookie   │                    │
     │                     │◄─────────────────────┤                    │
     │                     │                      │                    │
     │ 4. Click "Connect" │                      │                    │
     ├────────────────────►│                      │                    │
     │                     │ 5. Verify Admin Role│                    │
     │                     ├─────────────────────►│                    │
     │                     │ 6. OK               │                    │
     │                     │◄─────────────────────┤                    │
     │                     │                      │                    │
     │                     │ 7. Generate State   │                    │
     │                     │    (userId + orgId) │                    │
     │                     │                      │                    │
     │ 8. Redirect to Xero │                      │                    │
     │◄────────────────────┤                      │                    │
     ├──────────────────────────────────────────────────────────────►│
     │                     │                      │ 9. User Authorizes│
     │◄──────────────────────────────────────────────────────────────┤
     │ 10. Callback        │                      │                    │
     ├────────────────────►│                      │                    │
     │                     │ 11. Verify State    │                    │
     │                     │ 12. Verify Session  │                    │
     │                     ├─────────────────────►│                    │
     │                     │ 13. OK              │                    │
     │                     │◄─────────────────────┤                    │
     │                     │                      │                    │
     │                     │ 14. Exchange Code for Tokens             │
     │                     ├──────────────────────────────────────────►│
     │                     │ 15. Access + Refresh Tokens              │
     │                     │◄──────────────────────────────────────────┤
     │                     │                      │                    │
     │                     │ 16. Encrypt & Store │                    │
     │                     │     in DB           │                    │
     │                     │                      │                    │
     │                     │ 17. Fetch Tenants   │                    │
     │                     ├──────────────────────────────────────────►│
     │                     │ 18. Tenant List     │                    │
     │                     │◄──────────────────────────────────────────┤
     │                     │                      │                    │
     │ 19. Select Tenant   │                      │                    │
     ├────────────────────►│                      │                    │
     │                     │ 20. Create Binding  │                    │
     │                     │                      │                    │
     │ 21. Success         │                      │                    │
     │◄────────────────────┤                      │                    │
```

### Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         User Layer                               │
│  ┌────────────┐      ┌─────────────┐      ┌──────────────┐     │
│  │   Login    │─────►│  Settings   │─────►│ Integration  │     │
│  │   Page     │      │   Dashboard │      │   Setup      │     │
│  └────────────┘      └─────────────┘      └──────────────┘     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Authentication Layer                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Clerk Session: { userId, orgId, orgRole }                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Application Layer                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Authorization│    │    Token     │    │     API      │      │
│  │   Handler    │───►│   Service    │───►│   Client     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Data Layer                                │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ integrationGrant│  │ tenantBinding│  │  syncState   │       │
│  │ (Encrypted)     │  │ (Active)     │  │  (Cursor)    │       │
│  └─────────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Token Management & Refresh

### Token Storage Architecture

**Encryption Layer:** `lib/utils/encryption.ts`

All tokens are encrypted at rest using **AES-256-GCM** authenticated encryption.

```typescript
export function encryptToken(text: string): string {
  const key = getKey();  // 32-byte key from TOKEN_ENC_KEY_B64
  const iv = randomBytes(12);  // 12-byte IV (GCM standard)
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(encryptedText: string): string {
  const key = getKey();
  const [ivHex, authTagHex, contentHex] = encryptedText.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(contentHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

**Security Features:**
- **Authenticated Encryption:** GCM mode prevents tampering
- **Unique IV per encryption:** Random 12-byte IV prevents pattern analysis
- **Key derivation:** 256-bit key from environment variable
- **Format validation:** Decryption validates structure and auth tag

### Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      Token Lifecycle                             │
└─────────────────────────────────────────────────────────────────┘

OAuth Flow
    ↓
[Access Token: 30 min] + [Refresh Token: 60 days]
    ↓
Encrypted Storage in Database
    ↓
┌──────────────────────┐
│  Access Token Usage  │
└──────────────────────┘
    │
    ├─ Valid (>5 min remaining) → Use directly
    │
    ├─ Expiring (<5 min) → Refresh → New tokens
    │
    └─ Expired → Refresh → New tokens
                │
                ├─ Success → Update DB
                │
                └─ Failure → Mark as "refresh_failed"
                             Mark bindings as "needs_reauth"
```

### Token Service Implementation

**File:** `lib/integrations/token-service.ts`

#### Primary Method: getClientForTenantBinding

This is the **main entry point** for all Xero API access.

```typescript
export class TokenService {
  static async getClientForTenantBinding(tenantBindingId: string) {
    // 1. Load tenant binding
    const binding = await db.query.integrationTenantBindings.findFirst({
      where: eq(integrationTenantBindings.id, tenantBindingId),
    });

    if (!binding || binding.status !== "active") {
      throw new Error("Tenant binding not found or inactive");
    }

    // 2. Load grant (contains tokens)
    const grant = await db.query.integrationGrants.findFirst({
      where: eq(integrationGrants.id, binding.activeGrantId),
    });

    if (!grant) {
      throw new Error("Active grant not found");
    }

    // 3. Check if refresh needed (5-minute buffer)
    if (isPast(addMinutes(grant.expiresAt, -5))) {
      console.log(`Token expiring soon, refreshing...`);

      try {
        const refreshedGrant = await this.refreshGrantSingleFlight(grant.id);
        return xeroAdapter.getApiClient(
          decryptToken(refreshedGrant.accessTokenEnc),
          binding.externalTenantId,
        );
      } catch (error) {
        console.error("Failed to refresh token:", error);
        throw new Error("Token expired and refresh failed");
      }
    }

    // 4. Return client with valid token
    return xeroAdapter.getApiClient(
      decryptToken(grant.accessTokenEnc),
      binding.externalTenantId,
    );
  }
}
```

**Usage Pattern:**

```typescript
// In any API route or background job:
const client = await TokenService.getClientForTenantBinding(tenantBindingId);

// Client has authenticated fetch method
const response = await client.fetch("/Invoices");
const invoices = await response.json();
```

### Refresh Strategy: Single Flight Pattern

The "Single Flight" pattern prevents multiple concurrent refresh attempts for the same grant.

```typescript
static async refreshGrantSingleFlight(
  grantId: string,
): Promise<IntegrationGrant> {
  return await db.transaction(async (tx) => {
    // 1. LOCK THE ROW (PostgreSQL FOR UPDATE)
    // This blocks other processes trying to refresh the same grant
    await tx.execute(
      sql`SELECT * FROM ${integrationGrants}
          WHERE ${integrationGrants.id} = ${grantId}
          FOR UPDATE`
    );

    // 2. Re-fetch grant (inside transaction, sees locked state)
    const grant = await tx
      .select()
      .from(integrationGrants)
      .where(eq(integrationGrants.id, grantId))
      .limit(1)[0];

    if (!grant) throw new Error("Grant not found");

    // 3. RE-CHECK EXPIRY (another process may have refreshed)
    if (!isPast(addMinutes(grant.expiresAt, -5))) {
      console.log("Grant was already refreshed by another process.");
      return grant;  // Use existing fresh token
    }

    try {
      // 4. PERFORM REFRESH
      const currentRefreshToken = decryptToken(grant.refreshTokenEnc);
      const tokenSet = await xeroAdapter.refreshTokens(currentRefreshToken);

      if (!tokenSet.access_token || !tokenSet.refresh_token) {
        throw new Error("Invalid token response from Xero");
      }

      const newExpiresAt = addMinutes(new Date(), 30);

      // 5. UPDATE DATABASE (atomic)
      const [updatedGrant] = await tx
        .update(integrationGrants)
        .set({
          accessTokenEnc: encryptToken(tokenSet.access_token),
          refreshTokenEnc: encryptToken(tokenSet.refresh_token),
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
          status: "active",
        })
        .where(eq(integrationGrants.id, grantId))
        .returning();

      return updatedGrant;

    } catch (error) {
      console.error(`Refresh failed for grant ${grantId}:`, error);

      // 6. HANDLE FAILURE (mark as failed)
      await tx
        .update(integrationGrants)
        .set({
          status: "refresh_failed",
          updatedAt: new Date(),
        })
        .where(eq(integrationGrants.id, grantId));

      // Mark all bindings using this grant as needs_reauth
      await tx
        .update(integrationTenantBindings)
        .set({
          status: "needs_reauth",
          updatedAt: new Date(),
        })
        .where(eq(integrationTenantBindings.activeGrantId, grantId));

      throw error;
    }
  });
}
```

**Key Benefits:**
1. **Race Condition Prevention:** Row locking ensures only one refresh occurs
2. **Atomic Updates:** Transaction ensures consistency
3. **Graceful Degradation:** Failed refreshes mark grants for re-auth
4. **Efficient:** Competing processes use already-refreshed token

### Dual-Layer Refresh Architecture

#### Layer 1: On-Demand Refresh (Primary)

Triggered automatically when accessing the API:

```typescript
// Anywhere in the application:
const client = await TokenService.getClientForTenantBinding(bindingId);
// Token automatically refreshed if needed
```

**Advantages:**
- Just-in-time refresh
- No wasted refreshes for unused integrations
- Immediate error handling

#### Layer 2: Proactive Background Refresh (Backup)

**Cron Job:** `app/api/cron/keep-alive/route.ts`

**Schedule:** Every 10 minutes (`*/10 * * * *`)

```typescript
export async function GET(req: Request) {
  // 1. Find grants expiring in next 10 minutes
  const threshold = addMinutes(new Date(), 10);

  const grants = await db
    .select()
    .from(integrationGrants)
    .where(
      and(
        eq(integrationGrants.status, "active"),
        lt(integrationGrants.expiresAt, threshold)
      )
    );

  console.log(`Keep-Alive: Found ${grants.length} grants expiring soon.`);

  const results = { success: 0, failed: 0 };

  // 2. Refresh each grant
  for (const grant of grants) {
    try {
      await TokenService.refreshGrantSingleFlight(grant.id);
      results.success++;
    } catch (e) {
      console.error(`Keep-Alive: Failed to refresh grant ${grant.id}`, e);
      results.failed++;
    }
  }

  return Response.json({
    message: "Keep-alive job completed",
    stats: results
  });
}
```

**Vercel Cron Configuration:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/keep-alive",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Advantages:**
- Reduces API latency (tokens pre-refreshed)
- Catches tokens that might expire between requests
- Provides monitoring data on refresh health

### Token Refresh API Call

**Xero Endpoint:** `POST https://identity.xero.com/connect/token`

```typescript
async refreshTokens(refreshToken: string): Promise<XeroTokenSet> {
  const credentials = Buffer.from(
    `${this.clientId}:${this.clientSecret}`
  ).toString("base64");

  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Xero token refresh failed: ${error}`);
  }

  return response.json();
}
```

**Response:**

```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "f8d7e6c...",
  "expires_in": 1800,
  "token_type": "Bearer",
  "id_token": "eyJhbGc..."
}
```

**Important:** Both access and refresh tokens are rotated on each refresh (rolling refresh tokens).

---

## Database Schema

### Integration Tables Overview

```sql
-- Grant: OAuth token storage
CREATE TABLE integration_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorised_by_clerk_user_id TEXT NOT NULL,  -- Who authorized
  clerk_org_id TEXT NOT NULL,                 -- Which organization
  provider VARCHAR(50) NOT NULL DEFAULT 'xero',
  access_token_enc TEXT NOT NULL,             -- Encrypted
  refresh_token_enc TEXT NOT NULL,            -- Encrypted
  expires_at TIMESTAMP NOT NULL,              -- Token expiration
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active|superseded|revoked|refresh_failed
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);

-- Tenant Binding: Organization ↔ Xero Tenant mapping
CREATE TABLE integration_tenant_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT NOT NULL,                 -- Application organization
  provider VARCHAR(50) NOT NULL DEFAULT 'xero',
  external_tenant_id TEXT NOT NULL,           -- Xero organization ID
  external_tenant_name TEXT,                  -- "Acme Corp"
  active_grant_id UUID NOT NULL REFERENCES integration_grants(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active|suspended|revoked|needs_reauth
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_tenant_id)       -- One binding per tenant
);

-- Sync State: Cursor-based sync tracking
CREATE TABLE integration_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_binding_id UUID NOT NULL UNIQUE REFERENCES integration_tenant_bindings(id),
  data_type VARCHAR(50) NOT NULL,             -- "invoices", "contacts", etc.
  cursor TEXT,                                -- Last sync cursor/timestamp
  last_sync_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Webhook Events: Deduplicated webhook storage
CREATE TABLE integration_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'xero',
  external_event_id TEXT NOT NULL UNIQUE,     -- For deduplication
  payload JSON NOT NULL,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Entity Relationships

```
┌─────────────────────┐
│  Clerk Organization │
│  (orgId)            │
└──────────┬──────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────┐         ┌──────────────────────┐
│ integration_grants      │◄────────│ integration_tenant_  │
│                         │  N:1    │ bindings             │
├─────────────────────────┤         ├──────────────────────┤
│ id                      │         │ id                   │
│ clerk_org_id            │         │ clerk_org_id         │
│ access_token_enc        │         │ external_tenant_id   │
│ refresh_token_enc       │         │ active_grant_id ─────┤
│ expires_at              │         │ status               │
│ status                  │         └──────────┬───────────┘
└─────────────────────────┘                    │
                                               │ 1:1
                                               ▼
                                    ┌──────────────────────┐
                                    │ integration_sync_    │
                                    │ state                │
                                    ├──────────────────────┤
                                    │ id                   │
                                    │ tenant_binding_id    │
                                    │ data_type            │
                                    │ cursor               │
                                    │ last_sync_at         │
                                    └──────────────────────┘
```

### Status States

**Grant Status:**
- `active` - Valid, usable grant
- `superseded` - Replaced by newer grant (user re-authorized)
- `revoked` - Manually disconnected or upstream revoked
- `refresh_failed` - Refresh attempt failed, needs re-auth

**Binding Status:**
- `active` - Working connection
- `suspended` - Temporarily disabled (manual)
- `revoked` - Disconnected
- `needs_reauth` - Grant failed, user must re-authorize

### Data Access Patterns

**Get Active Integration for Organization:**

```typescript
const binding = await db.query.integrationTenantBindings.findFirst({
  where: and(
    eq(integrationTenantBindings.clerkOrgId, orgId),
    eq(integrationTenantBindings.status, "active")
  ),
  with: {
    // Could use relation if defined
  }
});

const grant = await db.query.integrationGrants.findFirst({
  where: eq(integrationGrants.id, binding.activeGrantId),
});
```

**Check Integration Status:**

```typescript
// app/api/integrations/status/route.ts
const status = await db.query.integrationTenantBindings.findFirst({
  where: and(
    eq(integrationTenantBindings.clerkOrgId, orgId),
    eq(integrationTenantBindings.provider, "xero"),
    eq(integrationTenantBindings.status, "active")
  ),
});

return Response.json({
  connected: !!status,
  tenantName: status?.externalTenantName,
  needsReauth: status?.status === "needs_reauth",
});
```

---

## Security Considerations

### Authentication Security

#### Clerk Session Validation

**Every protected route must validate session:**

```typescript
const { userId, orgId } = await auth();

if (!userId) {
  return new Response("Unauthorized", { status: 401 });
}

if (!orgId) {
  return new Response("Organization context required", { status: 401 });
}
```

#### Role-Based Access Control (RBAC)

**Integration management requires admin privileges:**

```typescript
const { orgRole } = await auth();

if (orgRole !== "org:admin" && orgRole !== "org:owner") {
  return new Response("Forbidden: Admin access required", { status: 403 });
}
```

### OAuth Security

#### State Parameter CSRF Protection

**State encoding:**

```typescript
const state = Buffer.from(
  JSON.stringify({
    clerk_user_id: userId,
    clerk_org_id: orgId,
    nonce: Math.random().toString(36).substring(7)  // Random nonce
  })
).toString("base64");
```

**State validation:**

```typescript
// Callback handler
const decodedState = JSON.parse(
  Buffer.from(state, "base64").toString("utf-8")
);

const { userId: currentUserId } = await auth();

if (currentUserId !== decodedState.clerk_user_id) {
  throw new Error("State validation failed: User mismatch");
}
```

**Why this matters:** Prevents CSRF attacks where an attacker tricks a user into completing an OAuth flow initiated by the attacker.

### Token Security

#### Encryption at Rest

**AES-256-GCM provides:**
1. **Confidentiality:** Tokens unreadable without encryption key
2. **Authentication:** Auth tag prevents tampering
3. **Unique IV:** Each encryption uses random IV

**Key Management:**

```typescript
// Environment variable (never commit!)
TOKEN_ENC_KEY_B64=<128-char hex string (64 bytes)>

// Key derivation
function getKey(): Buffer {
  const keyHex = process.env.TOKEN_ENC_KEY_B64 || "";
  if (!keyHex) throw new Error("TOKEN_ENC_KEY_B64 not defined");

  const keyBuffer = Buffer.from(keyHex, "hex");
  if (keyBuffer.length < 32) {
    throw new Error("Key must be at least 32 bytes");
  }

  return keyBuffer.subarray(0, 32);  // AES-256 requires 32 bytes
}
```

**Best Practices:**
- Generate key using: `openssl rand -hex 64`
- Store in environment variables only (Vercel, Neon, etc.)
- Rotate periodically (requires re-encryption of all tokens)
- Never log or expose in errors

#### Token Lifecycle Security

**Minimize token exposure:**
- Decrypt only when needed (just before API call)
- Never log decrypted tokens
- Clear from memory after use (automatic in Node.js)

**Revocation on disconnect:**

```typescript
// app/api/integrations/xero/disconnect/route.ts
if (grant && grant.status === 'active') {
  // 1. Revoke upstream at Xero
  try {
    const token = decryptToken(grant.refreshTokenEnc);
    await xeroAdapter.revokeToken(token);
  } catch (e) {
    console.warn("Failed to revoke token upstream:", e);
  }

  // 2. Overwrite tokens in database
  await db.update(integrationGrants)
    .set({
      status: "revoked",
      accessTokenEnc: "revoked",  // Overwrite encrypted data
      refreshTokenEnc: "revoked",
      updatedAt: new Date()
    })
    .where(eq(integrationGrants.id, grantId));
}
```

### Network Security

#### HTTPS Only

All OAuth callbacks must use HTTPS in production:

```typescript
// Environment setup
XERO_REDIRECT_URI=https://intellisync.com/api/xero/callback
```

#### Secure Headers

```typescript
// API responses should include security headers
headers: {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
}
```

### Database Security

#### Row-Level Security (RLS) Considerations

**Organization isolation:**

```typescript
// Always scope queries by orgId
where: and(
  eq(integrationTenantBindings.clerkOrgId, orgId),
  eq(integrationTenantBindings.status, "active")
)
```

**Prevent unauthorized access:**
- Never trust client-provided IDs without validation
- Always verify resource ownership before operations
- Use parameterized queries (Drizzle handles this)

---

## Error Handling & Recovery

### Error Categories

#### 1. Authentication Errors

**Clerk Session Errors:**

```typescript
const { userId, orgId } = await auth();

if (!userId) {
  return new Response("Unauthorized", { status: 401 });
}
```

**User Actions:**
- Redirect to login page
- Clear invalid sessions

#### 2. Authorization Errors

**Insufficient Permissions:**

```typescript
if (orgRole !== "org:admin" && orgRole !== "org:owner") {
  return new Response("Forbidden: Admin access required", { status: 403 });
}
```

**User Actions:**
- Display permission error
- Prompt to contact organization admin

#### 3. OAuth Flow Errors

**Authorization Denied:**

```typescript
const error = searchParams.get("error");

if (error) {
  console.error("Xero OAuth callback reported error:", error);
  return new Response("Xero Auth Error", { status: 400 });
}
```

**User Actions:**
- Show friendly error message
- Offer retry button

**State Validation Failure:**

```typescript
if (userId !== decodedState.clerk_user_id) {
  return new Response("Unauthorized: User mismatch", { status: 403 });
}
```

**Possible Causes:**
- CSRF attack
- Session expired during OAuth flow
- Browser issues (cookies disabled)

#### 4. Token Refresh Errors

**Refresh Failed:**

```typescript
catch (error) {
  console.error(`Refresh failed for grant ${grantId}:`, error);

  // Mark grant as failed
  await tx.update(integrationGrants)
    .set({ status: "refresh_failed" })
    .where(eq(integrationGrants.id, grantId));

  // Mark bindings as needs_reauth
  await tx.update(integrationTenantBindings)
    .set({ status: "needs_reauth" })
    .where(eq(integrationTenantBindings.activeGrantId, grantId));

  throw error;
}
```

**Common Causes:**
- Refresh token expired (60-day limit)
- User revoked access in Xero
- Xero API downtime
- Network issues

**Recovery:**
- User must re-authorize (repeat OAuth flow)
- Frontend detects `needs_reauth` status
- Display "Reconnect to Xero" button

#### 5. API Client Errors

**Unauthorized (401):**

```typescript
if (response.status === 401) {
  throw new Error("Xero API 401 Unauthorized");
}
```

**Causes:**
- Token refresh failed silently
- Token revoked upstream
- Tenant disconnected

**Recovery:**
- Attempt token refresh
- If refresh fails, mark as needs_reauth

### Monitoring & Logging

**Key Metrics to Track:**

```typescript
// Successful operations
console.log(`Token refreshed successfully for grant ${grantId}`);

// Failures
console.error(`Failed to refresh grant ${grantId}:`, error);

// Keep-alive stats
console.log(`Keep-Alive: Found ${grants.length} grants expiring soon.`);
console.log(`Keep-Alive: ${results.success} succeeded, ${results.failed} failed`);
```

**Recommended Monitoring:**
- Token refresh success rate
- Average time to refresh
- Number of `needs_reauth` states
- Failed API calls by error type

---

## API Endpoints Reference

### Integration Management

#### Start Xero Connection

```
GET /api/integrations/xero/start
```

**Authorization:** Requires admin role in organization context

**Flow:**
1. Validates user session and role
2. Generates state with userId + orgId
3. Redirects to Xero authorization URL

**Example:**
```typescript
// User clicks "Connect Xero" button
window.location.href = "/api/integrations/xero/start";
```

#### OAuth Callback

```
GET /api/xero/callback?code={code}&state={state}&scope={scope}
```

**Parameters:**
- `code` - Authorization code from Xero
- `state` - Base64-encoded state object
- `scope` - Granted scopes

**Flow:**
1. Validates state parameter
2. Verifies user session matches state
3. Exchanges code for tokens
4. Stores encrypted tokens
5. Redirects to tenant selection

#### List Available Tenants

```
GET /api/integrations/xero/tenants/list?grantId={grantId}
```

**Authorization:** Requires admin role

**Response:**
```json
{
  "tenants": [
    {
      "id": "conn_123",
      "tenantId": "tenant_abc",
      "tenantName": "Acme Corporation",
      "tenantType": "ORGANISATION"
    }
  ]
}
```

#### Select Tenant

```
POST /api/integrations/xero/tenants/select
```

**Body:**
```json
{
  "grantId": "uuid",
  "tenantId": "tenant_abc"
}
```

**Authorization:** Requires admin role

**Flow:**
1. Creates tenant binding
2. Links to active grant
3. Sets status to "active"

#### Check Integration Status

```
GET /api/integrations/status
```

**Authorization:** Requires organization context

**Response:**
```json
{
  "xero": {
    "connected": true,
    "tenantName": "Acme Corporation",
    "needsReauth": false,
    "connectedAt": "2026-01-18T10:30:00Z"
  }
}
```

#### Disconnect Integration

```
POST /api/integrations/xero/disconnect
```

**Body:**
```json
{
  "tenantBindingId": "uuid"
}
```

**Authorization:** Requires admin role

**Flow:**
1. Marks binding as revoked
2. If grant is orphaned (no other active bindings):
   - Revokes token at Xero
   - Marks grant as revoked
   - Overwrites encrypted tokens

### Cron Jobs

#### Token Keep-Alive

```
GET /api/cron/keep-alive
```

**Schedule:** Every 10 minutes

**Authorization:** Vercel Cron secret header

**Response:**
```json
{
  "message": "Keep-alive job completed",
  "stats": {
    "success": 5,
    "failed": 0
  }
}
```

---

## Sequence Diagrams

### Complete User Journey

```
User              Frontend           Auth API          Xero API          Database
 |                   |                   |                 |                 |
 |  Login            |                   |                 |                 |
 ├──────────────────►|                   |                 |                 |
 |                   |  auth()           |                 |                 |
 |                   ├──────────────────►|                 |                 |
 |                   |◄──────────────────┤                 |                 |
 |                   |  {userId, orgId}  |                 |                 |
 |                   |                   |                 |                 |
 |  Navigate to      |                   |                 |                 |
 |  Settings         |                   |                 |                 |
 ├──────────────────►|                   |                 |                 |
 |                   |  Check Status     |                 |                 |
 |                   ├───────────────────────────────────────────────────────►|
 |                   |                   |                 |  Query bindings |
 |                   |◄───────────────────────────────────────────────────────┤
 |                   |  {connected: false}                 |                 |
 |                   |                   |                 |                 |
 |  Click "Connect"  |                   |                 |                 |
 ├──────────────────►|                   |                 |                 |
 |                   |  Verify Admin     |                 |                 |
 |                   ├──────────────────►|                 |                 |
 |                   |◄──────────────────┤                 |                 |
 |                   |  OK               |                 |                 |
 |                   |                   |                 |                 |
 |                   |  Generate State   |                 |                 |
 |                   |  {userId, orgId}  |                 |                 |
 |                   |                   |                 |                 |
 |  Redirect         |                   |                 |                 |
 |◄──────────────────┤                   |                 |                 |
 |                   |                   |                 |                 |
 |  Authorize at Xero                    |                 |                 |
 ├───────────────────────────────────────────────────────►|                 |
 |                   |                   |  User Consents  |                 |
 |◄───────────────────────────────────────────────────────┤                 |
 |  Callback         |                   |  {code, state}  |                 |
 |                   |                   |                 |                 |
 ├──────────────────►|                   |                 |                 |
 |                   |  Validate State   |                 |                 |
 |                   |  Verify Session   |                 |                 |
 |                   ├──────────────────►|                 |                 |
 |                   |◄──────────────────┤                 |                 |
 |                   |                   |                 |                 |
 |                   |  Exchange Code    |                 |                 |
 |                   ├───────────────────────────────────►|                 |
 |                   |                   |  Token Exchange |                 |
 |                   |◄───────────────────────────────────┤                 |
 |                   |  {access, refresh}                 |                 |
 |                   |                   |                 |                 |
 |                   |  Encrypt & Store  |                 |                 |
 |                   ├───────────────────────────────────────────────────────►|
 |                   |                   |                 |  INSERT grant   |
 |                   |◄───────────────────────────────────────────────────────┤
 |                   |  {grantId}        |                 |                 |
 |                   |                   |                 |                 |
 |                   |  Fetch Tenants    |                 |                 |
 |                   ├───────────────────────────────────►|                 |
 |                   |◄───────────────────────────────────┤                 |
 |                   |  [tenants]        |                 |                 |
 |                   |                   |                 |                 |
 |  Select Tenant    |                   |                 |                 |
 ├──────────────────►|                   |                 |                 |
 |                   |  Create Binding   |                 |                 |
 |                   ├───────────────────────────────────────────────────────►|
 |                   |                   |                 |  INSERT binding |
 |                   |◄───────────────────────────────────────────────────────┤
 |                   |                   |                 |                 |
 |  Success          |                   |                 |                 |
 |◄──────────────────┤                   |                 |                 |
```

### Token Refresh Flow

```
Worker/API         TokenService        Database          Xero API
    |                   |                 |                 |
    |  getClientFor     |                 |                 |
    |  TenantBinding()  |                 |                 |
    ├──────────────────►|                 |                 |
    |                   |  Load Binding   |                 |
    |                   ├────────────────►|                 |
    |                   |◄────────────────┤                 |
    |                   |  Load Grant     |                 |
    |                   ├────────────────►|                 |
    |                   |◄────────────────┤                 |
    |                   |                 |                 |
    |                   |  Check Expiry   |                 |
    |                   |  (< 5 min?)     |                 |
    |                   |  YES            |                 |
    |                   |                 |                 |
    |                   |  refreshGrant   |                 |
    |                   |  SingleFlight() |                 |
    |                   |                 |                 |
    |                   |  BEGIN TX       |                 |
    |                   ├────────────────►|                 |
    |                   |  FOR UPDATE     |                 |
    |                   ├────────────────►|                 |
    |                   |  [LOCK GRANT]   |                 |
    |                   |◄────────────────┤                 |
    |                   |                 |                 |
    |                   |  Re-check       |                 |
    |                   |  Expiry         |                 |
    |                   |  Still < 5 min? |                 |
    |                   |  YES            |                 |
    |                   |                 |                 |
    |                   |  Call Xero      |                 |
    |                   |  Refresh API    |                 |
    |                   ├─────────────────────────────────►|
    |                   |                 |  POST /token    |
    |                   |                 |  refresh_token  |
    |                   |◄─────────────────────────────────┤
    |                   |  {new_access,   |                 |
    |                   |   new_refresh}  |                 |
    |                   |                 |                 |
    |                   |  Encrypt        |                 |
    |                   |  Update Grant   |                 |
    |                   ├────────────────►|                 |
    |                   |  UPDATE grant   |                 |
    |                   |  SET tokens,    |                 |
    |                   |  expiresAt      |                 |
    |                   |◄────────────────┤                 |
    |                   |                 |                 |
    |                   |  COMMIT TX      |                 |
    |                   ├────────────────►|                 |
    |                   |◄────────────────┤                 |
    |                   |                 |                 |
    |                   |  Return Client  |                 |
    |◄──────────────────┤  with fresh     |                 |
    |  Authenticated    |  token          |                 |
    |  API Client       |                 |                 |
```

---

## Conclusion

This integration architecture provides:

✅ **Security:** Multi-layer encryption, CSRF protection, role-based access
✅ **Reliability:** Dual-layer token refresh, single-flight pattern, graceful degradation
✅ **Scalability:** Organization-based multi-tenancy, efficient database queries
✅ **Maintainability:** Clear separation of concerns, comprehensive error handling
✅ **Auditability:** Complete logging, status tracking, webhook support

### Key Takeaways

1. **Clerk handles user authentication** - Never implement custom auth
2. **Organization context is critical** - All integrations are org-scoped
3. **Tokens are always encrypted at rest** - Use AES-256-GCM
4. **Refresh happens automatically** - On-demand + proactive background
5. **State parameter prevents CSRF** - Always validate in OAuth callback
6. **Row locking prevents race conditions** - Use transactions for refreshes
7. **Graceful degradation is essential** - Mark failed grants as needs_reauth
8. **Never log decrypted tokens** - Security best practice

### Future Enhancements

- [ ] Webhook-based sync instead of polling
- [ ] Multi-provider support (QuickBooks, MYOB, etc.)
- [ ] Token rotation monitoring and alerting
- [ ] Automatic re-authorization flow for expired tokens
- [ ] Audit log for all integration operations

---

**Document Version:** 1.0
**Authors:** IntelliSync Development Team
**Last Review:** 2026-01-18
