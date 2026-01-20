# Clerk Organization Selector & Accounting Integrations - Implementation Plan

## Executive Summary

This document outlines the implementation of accounting platform integrations (Xero, MYOB, QuickBooks) with Clerk organization management. When a user connects an accounting platform within an organization context, they can select which Xero tenant to bind to their Clerk organization.

---

## 1. Current State

### Clerk Organization Implementation

- `OrganizationSwitcher` used in chat and settings headers
- **Configuration**: `hidePersonal={true}` - Only shows organizations, personal accounts hidden
- **Current Behavior**: Users must be in an organization context to use the application
- **Organization Support**:
  - Users can create and switch between multiple organizations
  - Organization members can collaborate on shared chats and integrations
  - Organization-scoped data (chats, integrations, settings)
- **Personal Accounts**: Currently disabled via `hidePersonal` configuration
  - If enabled, users could work in personal workspace without organization
  - Personal workspace would have isolated data from organizations
  - Integration connections would be user-scoped instead of organization-scoped
- **Styling**: Custom dark mode theming with conditional class application
- **Location**: `components/chat-header.tsx` and `components/settings-header.tsx`

**Note**: To enable personal accounts, remove `hidePersonal={true}` from `OrganizationSwitcher` components. This would require updates to integration logic to handle both personal and organization contexts.

### Integrations Page

- Located at `/settings/integrations`
- Shows Xero integration with connection management
- **Xero Integration**: Fully implemented and functional
  - OAuth 2.0 Authorization Code flow with tenant selection
  - Connection status display with detailed grant info
  - Disconnect functionality with confirmation
  - 7 AI tools available (profit & loss, balance sheet, invoices, contacts, accounts, create invoice, org details)
  - Two-phase connection: OAuth → Tenant Selection
- **Other Platforms**: Backend implementation pending
  - QuickBooks: Not started
  - MYOB: Not started

**Xero Implementation Status**:

- ✅ Database tables: `integrationGrants`, `integrationTenantBindings`, `integrationWebhookEvents`, `integrationSyncState`
- ✅ OAuth flow: Start, callback, tenant selection, and disconnect routes
- ✅ Token encryption: AES-256-GCM with `TOKEN_ENC_KEY_HEX`
- ✅ State parameter: Base64-encoded JSON with nonce and timestamp
- ✅ Two-phase tenant selection: OAuth completes, then user selects tenant
- ✅ AI Tools: 7 Xero-specific tools for accounting data access
- ✅ UI: Full integration management in `/settings/integrations`
- ✅ Token refresh: Automatic refresh via `lib/integrations/token-service.ts`
- ⚠️ Organization name sync: Not implemented (planned feature)

### Database

**Current Implementation** (`lib/db/schema.ts`):

#### Table 1: `integrationGrants`

Stores OAuth tokens (encrypted) from authorization flows.

```typescript
{
  id: uuid (primary key),
  authorisedByClerkUserId: text (user who authorized),
  clerkOrgId: text (Clerk org ID),
  provider: varchar ("xero"),
  accessTokenEnc: text (encrypted),
  refreshTokenEnc: text (encrypted),
  expiresAt: timestamp,
  status: "active" | "superseded" | "revoked" | "refresh_failed",
  createdAt: timestamp,
  updatedAt: timestamp,
  lastUsedAt: timestamp
}
```

#### Table 2: `integrationTenantBindings`

Links Clerk organizations to external platform tenants.

```typescript
{
  id: uuid (primary key),
  clerkOrgId: text (Clerk org ID),
  provider: varchar ("xero"),
  externalTenantId: text (Xero tenant ID),
  externalTenantName: text (for display),
  activeGrantId: uuid (references integrationGrants.id),
  status: "active" | "suspended" | "revoked" | "needs_reauth",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Table 3: `integrationWebhookEvents`

Stores incoming webhook events for deduplication and processing.

```typescript
{
  id: uuid (primary key),
  provider: varchar ("xero"),
  externalEventId: text (unique, for deduplication),
  payload: json,
  processedAt: timestamp,
  createdAt: timestamp
}
```

#### Table 4: `integrationSyncState`

Tracks sync cursors for incremental data synchronization.

```typescript
{
  id: uuid (primary key),
  tenantBindingId: uuid (references integrationTenantBindings.id, unique),
  dataType: varchar ("invoices", "contacts"),
  cursor: text,
  lastSyncAt: timestamp,
  updatedAt: timestamp
}
```

**Indexes**:

- `integration_grants_org_idx` on `clerkOrgId`
- `integration_grants_expiry_idx` on `expiresAt, status`
- `integration_tenant_bindings_org_idx` on `clerkOrgId`

---

## 2. Technical Architecture

### Database Schema

Four tables handle integrations:

1. **`integrationGrants`**: OAuth tokens (service-level, organization-scoped)
2. **`integrationTenantBindings`**: Links Clerk orgs to external tenants
3. **`integrationWebhookEvents`**: Webhook deduplication
4. **`integrationSyncState`**: Incremental sync tracking

This design supports:

- Multiple tenants per grant (Xero allows access to multiple orgs)
- Token rotation without losing tenant bindings
- Webhook event processing
- Incremental sync with cursor-based pagination

### OAuth Flow

**Current Implementation (Xero)**:

```
User clicks "Connect New Organization" → window.location.href = "/api/integrations/xero/start"
  ↓
/api/integrations/xero/start/route.ts
  ↓
Auth check: userId, orgId, orgRole (admin/owner only)
  ↓
Generate state token (base64 JSON with nonce and timestamp)
  {
    clerk_user_id: userId,
    clerk_org_id: orgId,
    nonce: randomBytes(32).toString("hex"),
    timestamp: Date.now()
  }
  ↓
Redirect to Xero OAuth (via XeroAdapter.getAuthUrl(state))
  - response_type=code
  - client_id from XERO_CLIENT_ID
  - redirect_uri from XERO_REDIRECT_URI
  - scope: openid profile email accounting.settings.read accounting.transactions accounting.contacts offline_access
  - state parameter (base64 encoded)
  ↓
User authorizes on Xero platform
  ↓
Xero redirects to /api/xero/callback?code=xxx&state=xxx
  ↓
/api/xero/callback/route.ts
  ↓
Validate state: decode base64, parse JSON, verify user/org match
  ↓
Exchange authorization code for tokens (XeroAdapter.exchangeCode)
  ↓
Encrypt tokens (encryptToken from lib/utils/encryption.ts)
  ↓
Insert into integrationGrants table
  ↓
Redirect to /settings/integrations?action=select_tenant&grantId={grantId}
  ↓
Client-side: Opens tenant selection modal
  ↓
GET /api/integrations/xero/tenants/list?grantId={grantId}
  - Fetches available tenants from Xero using grant's access token
  ↓
User selects a tenant
  ↓
POST /api/integrations/xero/tenants/select
  { grantId, tenantId }
  ↓
Insert into integrationTenantBindings table
  ↓
Connection complete, UI refreshes
```

---

## 3. Platform Specifications

### Xero

**OAuth 2.0**: Authorization Code Grant

**Environment Variables**:

```bash
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback
```

**Endpoints**:

- Authorize: `https://login.xero.com/identity/connect/authorize`
- Token: `https://identity.xero.com/connect/token`
- Connections: `https://api.xero.com/connections`
- API Base: `https://api.xero.com/api.xro/2.0/`

**Scopes**: `openid profile email accounting.settings.read accounting.transactions accounting.contacts offline_access`

**Token Lifecycle**:

- Access token expires in ~30 minutes (1800 seconds)
- Refresh tokens used for automatic renewal
- `token-service.ts` handles refresh logic

### QuickBooks (Planned)

**OAuth 2.0**: Authorization Code Grant

**Endpoints**:

- Authorize: `https://appcenter.intuit.com/connect/oauth2`
- Token: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
- Company Info: `https://quickbooks.api.intuit.com/v3/company/{realmId}/companyinfo/{realmId}`

**Scopes**: `com.intuit.quickbooks.accounting`

### MYOB (Planned)

**OAuth 2.0**: Authorization Code Grant

**Endpoints**:

- Authorize: `https://secure.myob.com/oauth2/account/authorize`
- Token: `https://secure.myob.com/oauth2/v1/authorize`
- Company Files: `https://api.myob.com/accountright/`

**Scopes**: `CompanyFile`

---

## 4. Implementation Files

### 4.1 Database Schema

**File**: `lib/db/schema.ts`

Contains all four integration tables with proper indexes and foreign keys.

### 4.2 Xero Adapter

**File**: `lib/integrations/xero/adapter.ts`

```typescript
class XeroAdapter {
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<XeroTokenSet>;
  refreshTokens(refreshToken: string): Promise<XeroTokenSet>;
  getTenants(accessToken: string): Promise<XeroTenant[]>;
  revokeToken(token: string): Promise<void>;
  getApiClient(accessToken: string, tenantId: string);
}
```

### 4.3 Token Service

**File**: `lib/integrations/token-service.ts`

Handles token refresh and encryption/decryption.

### 4.4 Encryption Utilities

**File**: `lib/utils/encryption.ts`

```typescript
function encryptToken(token: string): string;
function decryptToken(encryptedToken: string): string;
```

Uses AES-256-GCM with `TOKEN_ENC_KEY_HEX` environment variable.

### 4.5 API Routes

| Route                                   | Method | Purpose                      |
| --------------------------------------- | ------ | ---------------------------- |
| `/api/integrations/xero/start`          | GET    | Initiate OAuth flow          |
| `/api/xero/callback`                    | GET    | OAuth callback handler       |
| `/api/integrations/xero/tenants/list`   | GET    | List available tenants       |
| `/api/integrations/xero/tenants/select` | POST   | Select and bind tenant       |
| `/api/integrations/xero/disconnect`     | POST   | Revoke connection            |
| `/api/integrations/status`              | GET    | Get all integration statuses |
| `/api/webhooks/xero`                    | POST   | Xero webhook handler         |

### 4.6 UI

**File**: `app/(chat)/settings/integrations/page.tsx`

Single-page integration management with:

- Connection status cards
- Tenant selection modal
- Disconnect functionality
- Connection details (created, refreshed, expires)

### 4.7 AI Tools

- `lib/ai/tools/list-xero-profit-and-loss.ts`
- `lib/ai/tools/list-xero-balance-sheet.ts`
- `lib/ai/tools/list-xero-invoices.ts`
- `lib/ai/tools/list-xero-contacts.ts`
- `lib/ai/tools/list-xero-accounts.ts`
- `lib/ai/tools/list-xero-organisation.ts`
- `lib/ai/tools/create-xero-invoice.ts`

---

## 5. Planned Features

### Clerk Organization Name Sync ✅

**Concept**: Automatically update Clerk organization name from Xero on first connection.

**Implementation**: `lib/integrations/clerk-sync.ts`

```typescript
import { syncClerkOrgNameFromXero } from "@/lib/integrations/clerk-sync";

// Called in tenants/select/route.ts after creating a new tenant binding
syncClerkOrgNameFromXero(orgId, targetTenant.tenantName);
```

**When to Update**: Only on first-time connection to prevent overwriting manually-set names.

**Error Handling**: Non-blocking - sync failures are logged but don't affect the connection.

**Status**: Implemented.

---

## 6. Environment Variables

Required in `.env.local`:

```bash
# Token Encryption Key (generate with: openssl rand -hex 64)
TOKEN_ENC_KEY_HEX=your_128_character_hex_string

# Xero OAuth
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback

# QuickBooks OAuth (Planned)
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
QUICKBOOKS_ENVIRONMENT=sandbox

# MYOB OAuth (Planned)
MYOB_CLIENT_ID=your_myob_client_id
MYOB_CLIENT_SECRET=your_myob_client_secret

# Public App URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 7. Implementation Phases

### Phase 1: Infrastructure ✅

- [x] Create integration tables migration
- [x] Implement Drizzle ORM schema
- [x] Implement XeroAdapter class
- [x] Implement token encryption utilities
- [x] Implement token refresh service
- [x] Add environment variables

### Phase 2: Xero Integration ✅

- [x] Implement OAuth start route
- [x] Implement OAuth callback route
- [x] Implement tenant list endpoint
- [x] Implement tenant selection endpoint
- [x] Implement disconnect endpoint
- [x] Implement status endpoint
- [x] Create integrations page UI
- [x] Implement tenant selection modal
- [x] Create 7 AI tools for Xero data access

### Phase 3: QuickBooks & MYOB (Planned)

- [ ] Create QuickBooks adapter
- [ ] Implement QuickBooks routes
- [ ] Create MYOB adapter
- [ ] Implement MYOB routes
- [ ] Update UI for multiple platforms

### Phase 4: Advanced Features

- [x] Implement Clerk org name sync on first connection
- [ ] Add webhook event processing for real-time sync
- [ ] Implement incremental data sync with cursors
- [ ] Add integration health monitoring

---

## 8. Security Considerations

### Token Storage

- **Encryption**: AES-256-GCM for all tokens
- **Key Management**: `TOKEN_ENC_KEY_HEX` in environment variables (128 hex chars)
- **Database**: Encrypted tokens only, never in logs or client-side

### OAuth Security

- **State Parameter**: Base64-encoded JSON with cryptographically random nonce
- **User Verification**: Callback verifies initiating user matches completing user
- **Org Verification**: Callback verifies org context hasn't changed
- **Role Check**: Only org admins/owners can initiate connections
- **HTTPS Only**: Required in production

### Access Control

- **Organization-Scoped**: Integrations tied to Clerk organizations
- **User Authentication**: All routes require Clerk auth
- **Role Authorization**: Integration management requires admin/owner role

---

## 9. Testing Strategy

### Manual Testing Checklist

- [x] Xero OAuth flow completes successfully
- [x] Tenant selection modal displays available tenants
- [x] Tenant binding created correctly
- [x] Disconnect removes binding and revokes grant
- [x] Token refresh works transparently
- [x] AI tools retrieve correct data
- [ ] QuickBooks connection (planned)
- [ ] MYOB connection (planned)
- [x] First connection updates Clerk org name

### Error Scenarios

- [x] User cancels OAuth on Xero side
- [x] OAuth state validation fails
- [x] Token exchange fails
- [x] Token refresh fails (status updated to `refresh_failed`)
- [x] API rate limiting handled via retry helper

---

## 10. Success Criteria

### Functional

- [x] Users can connect/disconnect Xero organizations
- [x] Integration status displays correctly with details
- [x] AI tools access Xero data successfully
- [x] First-time connection updates Clerk org name

### Security

- [x] Tokens encrypted at rest
- [x] CSRF protection via state parameter
- [x] Role-based access control
- [ ] Security audit (planned)

### User Experience

- [x] Clear connection flow with tenant selection
- [x] Visible connection status and health indicators
- [x] Actionable error messages
- [x] Responsive UI design

---

## 11. Related Documentation

- `lib/integrations/xero/adapter.ts` - Xero OAuth and API client
- `lib/integrations/token-service.ts` - Token management
- `lib/utils/encryption.ts` - Token encryption utilities
- `app/(chat)/settings/integrations/page.tsx` - Integration UI
- `app/api/webhooks/xero/route.ts` - Webhook handler

---

**Document Version**: 3.1
**Last Updated**: 2026-01-20
**Status**: Reflects Current Implementation (Clerk org name sync added)
