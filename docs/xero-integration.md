# Xero Integration Documentation

This document provides comprehensive documentation for the Xero accounting integration in IntelliSync. The integration enables AI-powered access to Xero data through Vercel AI SDK tools.

## Overview

The Xero integration allows IntelliSync's AI assistant to:
- Query organization details and verify connection status
- List and search invoices, contacts, and accounts
- Generate financial reports (P&L, Balance Sheet)
- Create invoices (with user approval)

**Architecture**: The integration uses **Vercel AI SDK tools** (not MCP) with OAuth 2.0 authentication, automatic token refresh, and organization-scoped access control.

## Available Tools

### 1. `listXeroOrganisation`

Retrieves organization details from the connected Xero account.

**Location**: `lib/ai/tools/list-xero-organisation.ts`

**Parameters**: None required

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| `connected` | boolean | Whether Xero is connected |
| `organisationID` | string | Xero organization ID |
| `name` | string | Company name |
| `legalName` | string | Legal/registered name |
| `taxNumber` | string | ABN/Tax number |
| `baseCurrency` | string | Default currency (e.g., AUD) |
| `countryCode` | string | Country code (e.g., AU) |
| `financialYearEndDay` | number | FY end day |
| `financialYearEndMonth` | number | FY end month |
| `salesTaxBasis` | string | GST accounting basis |
| `isDemoCompany` | boolean | Demo company flag |

**Use Cases**:
- Verify Xero connection before other operations
- Get company details for personalized responses
- Check financial year settings for date-aware queries

---

### 2. `listXeroInvoices`

Lists invoices (sales invoices and purchase bills) with filtering options.

**Location**: `lib/ai/tools/list-xero-invoices.ts`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1, 100 per page) |
| `invoiceNumbers` | string[] | No | Filter by specific invoice numbers |
| `contactIDs` | string[] | No | Filter by contact IDs |
| `statuses` | enum[] | No | Filter by status: `DRAFT`, `SUBMITTED`, `DELETED`, `AUTHORISED`, `PAID`, `VOIDED` |
| `type` | enum | No | `ACCREC` (sales) or `ACCPAY` (purchases) |
| `fromDate` | string | No | Start date (YYYY-MM-DD) |
| `toDate` | string | No | End date (YYYY-MM-DD) |

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| `invoices` | array | List of invoice objects |
| `totalInvoices` | number | Count of returned invoices |
| `page` | number | Current page |
| `hasMore` | boolean | Whether more pages exist |

**Invoice Object**:
```typescript
{
  invoiceID: string;
  invoiceNumber: string;
  type: "ACCREC" | "ACCPAY";
  status: string;
  contact: { contactID: string; name: string };
  date: string;
  dueDate: string;
  subTotal: number;
  totalTax: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  currencyCode: string;
  reference?: string;
  lineItems?: array; // Only when filtering by invoiceNumbers
}
```

**Use Cases**:
- "Show me all unpaid invoices"
- "What invoices did we send to Acme Corp?"
- "List overdue bills from this month"

---

### 3. `listXeroContacts`

Lists customers and suppliers with search functionality.

**Location**: `lib/ai/tools/list-xero-contacts.ts`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1, 100 per page) |
| `searchTerm` | string | No | Search by name, email, or contact number |
| `includeArchived` | boolean | No | Include archived contacts (default: false) |

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| `contacts` | array | List of contact objects |
| `totalContacts` | number | Count of returned contacts |
| `page` | number | Current page |
| `hasMore` | boolean | Whether more pages exist |

**Contact Object**:
```typescript
{
  contactID: string;
  name: string;
  contactNumber?: string;
  accountNumber?: string;
  contactStatus: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  isSupplier: boolean;
  isCustomer: boolean;
  defaultCurrency?: string;
  phones: array;
  addresses: array;
  taxNumber?: string;
}
```

**Use Cases**:
- "Find contact details for John Smith"
- "List all our suppliers"
- "Get customer ID for invoice creation"

---

### 4. `listXeroAccounts`

Lists the chart of accounts (GL codes) for categorization.

**Location**: `lib/ai/tools/list-xero-accounts.ts`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | enum | No | Filter by account type |
| `taxType` | string | No | Filter by tax type code |

**Account Types**:
- `BANK` - Bank accounts
- `REVENUE` / `SALES` - Income accounts
- `EXPENSE` / `OVERHEADS` / `DIRECTCOSTS` - Expense accounts
- `FIXED` - Fixed assets
- `CURRENT` / `NONCURRENT` - Current/non-current assets
- `CURRLIAB` / `TERMLIAB` / `LIABILITY` - Liabilities
- `EQUITY` - Equity accounts
- `INVENTORY` - Inventory
- `DEPRECIATN` - Depreciation
- `PREPAYMENT` - Prepayments
- `OTHERINCOME` - Other income

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| `accounts` | array | List of account objects |
| `accountsByType` | object | Accounts grouped by type |
| `totalAccounts` | number | Count of accounts |

**Account Object**:
```typescript
{
  accountID: string;
  code: string;
  name: string;
  type: string;
  taxType: string;
  description?: string;
  class: string;
  status: string;
  systemAccount?: string;
}
```

**Use Cases**:
- "What account code should I use for office supplies?"
- "List all revenue accounts"
- "Show me the chart of accounts"

---

### 5. `listXeroProfitAndLoss`

Generates a Profit and Loss (Income Statement) report.

**Location**: `lib/ai/tools/list-xero-profit-and-loss.ts`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromDate` | string | No | Start date (YYYY-MM-DD), defaults to FY start |
| `toDate` | string | No | End date (YYYY-MM-DD), defaults to today |
| `periods` | number | No | Number of comparison periods (1-12) |
| `timeframe` | enum | No | Period type: `MONTH`, `QUARTER`, `YEAR` |
| `standardLayout` | boolean | No | Use standard layout (default: false) |
| `paymentsOnly` | boolean | No | Hide zero-balance accounts (default: false) |

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| `reportName` | string | Report title |
| `reportDate` | string | Report generation date |
| `dateRange` | string | Period covered |
| `data` | array | Hierarchical report rows |

**Use Cases**:
- "What was our profit last quarter?"
- "Show me the P&L for FY 2024-25"
- "Compare monthly revenue for the last 6 months"

---

### 6. `listXeroBalanceSheet`

Generates a Balance Sheet report.

**Location**: `lib/ai/tools/list-xero-balance-sheet.ts`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Report date (YYYY-MM-DD), defaults to today |
| `periods` | number | No | Number of comparison periods (1-12) |
| `timeframe` | enum | No | Period type: `MONTH`, `QUARTER`, `YEAR` |
| `standardLayout` | boolean | No | Use standard layout (default: false) |
| `paymentsOnly` | boolean | No | Hide zero-balance accounts (default: false) |

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| `reportName` | string | Report title |
| `reportDate` | string | Report generation date |
| `asOfDate` | string | Balance sheet date |
| `data` | array | Hierarchical report rows |

**Use Cases**:
- "What's our current cash position?"
- "Show me the balance sheet as at December 31"
- "Compare quarterly balance sheets for this year"

---

### 7. `createXeroInvoice`

Creates a new invoice in Xero. **Requires user approval before execution.**

**Location**: `lib/ai/tools/create-xero-invoice.ts`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contactID` | string | Yes | Contact ID (from `listXeroContacts`) |
| `type` | enum | Yes | `ACCREC` (sales) or `ACCPAY` (purchase) |
| `lineItems` | array | Yes | Array of line item objects |
| `date` | string | No | Invoice date (YYYY-MM-DD) |
| `dueDate` | string | No | Due date (YYYY-MM-DD) |
| `reference` | string | No | Reference number |
| `status` | enum | No | `DRAFT`, `SUBMITTED`, or `AUTHORISED` |

**Line Item Object**:
```typescript
{
  description: string;    // Required
  quantity: number;       // Required
  unitAmount: number;     // Required
  accountCode: string;    // Required (from listXeroAccounts)
  taxType?: string;       // Optional (e.g., "OUTPUT2" for GST)
  itemCode?: string;      // Optional (Xero inventory item)
}
```

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Creation status |
| `invoiceID` | string | Xero invoice ID |
| `invoiceNumber` | string | Invoice number (e.g., INV-0001) |
| `total` | number | Invoice total |
| `xeroLink` | string | Direct link to invoice in Xero |

**Use Cases**:
- "Create an invoice for Acme Corp for $500 consulting"
- "Draft a bill from our supplier for inventory"

---

## OAuth Flow

### Connection Process

1. **Initiate Connection**: User clicks "Connect Xero" at `/settings/integrations`
   - Requires organization admin/owner role
   - Route: `GET /api/integrations/xero/start`

2. **Authorization**: User redirected to Xero authorization page
   - State parameter with nonce for CSRF protection
   - Scopes requested: `offline_access`, `accounting.transactions`, `accounting.reports.read`, `accounting.settings`, `accounting.contacts`, `accounting.attachments`, `assets.read`

3. **Callback**: Xero redirects to `/api/xero/callback`
   - Validates state/nonce
   - Exchanges authorization code for tokens
   - Encrypts and stores tokens

4. **Tenant Selection**: User selects Xero organization
   - Route: `GET /api/integrations/xero/tenants/list`
   - Route: `POST /api/integrations/xero/tenants/select`
   - Binds tenant to Clerk organization
   - Triggers organization name sync to Clerk

5. **Disconnection**: User clicks "Disconnect"
   - Route: `POST /api/integrations/xero/disconnect`
   - Revokes tokens and removes binding

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/integrations/xero/start` | GET | Initiate OAuth flow |
| `/api/xero/callback` | POST | OAuth callback handler |
| `/api/integrations/xero/tenants/list` | GET | List available Xero tenants |
| `/api/integrations/xero/tenants/select` | POST | Bind tenant to organization |
| `/api/integrations/xero/disconnect` | POST | Disconnect integration |
| `/api/integrations/status` | GET | Get integration status |
| `/api/webhooks/xero` | POST | Webhook event handler |

---

## Token Management

### TokenService (`lib/integrations/token-service.ts`)

Handles OAuth token lifecycle with these features:

**Single-Flight Token Refresh**:
- Prevents race conditions when multiple requests need token refresh
- Uses in-memory locks + PostgreSQL row-level locks
- Only one refresh request executes; others wait for result

**Auto-Refresh Logic**:
- Refresh 5 minutes before expiry
- Proactive refresh if refresh token > 50 days old (60-day rolling limit)
- JWT `exp` claim used as authoritative expiry source

**Token Storage**:
- Access and refresh tokens encrypted with AES-256-GCM
- Stored in `integration_grants` table
- Status tracking: `active`, `superseded`, `revoked`, `refresh_failed`

### Grant Status Values

| Status | Description |
|--------|-------------|
| `active` | Token is valid and usable |
| `superseded` | Replaced by newer grant (after refresh) |
| `revoked` | User disconnected or revoked access |
| `refresh_failed` | Refresh token expired/invalid |

---

## Error Handling

### Error Classes (`lib/integrations/errors.ts`)

| Error Class | Description |
|-------------|-------------|
| `AuthError` | OAuth flow failures |
| `TokenError` | Token validation/refresh issues |
| `ExternalAPIError` | Xero API errors with status codes |
| `RateLimitError` | Rate limiting with retry-after |
| `ConfigError` | Missing configuration |
| `SyncError` | Background sync failures |
| `WebhookError` | Webhook processing errors |

### TokenError Codes

| Code | Description | User Action |
|------|-------------|-------------|
| `INSUFFICIENT_SCOPE` | Missing OAuth permissions | Reconnect with new scopes |
| `API_UNAUTHORIZED` | Token expired, refresh failed | Reconnect Xero |
| `TOKEN_REFRESH_FAILED` | Refresh token invalid | Reconnect Xero |

### Error Handler (`lib/integrations/xero/error-handler.ts`)

Transforms errors into user-friendly responses:

```typescript
interface XeroToolErrorResponse {
  error: string;        // User-friendly message
  hint?: string;        // How to resolve
  details?: object;     // Technical context
  needsReauth?: boolean; // Requires reconnection
}
```

---

## Database Schema

### Integration Tables

**`integration_grants`** - OAuth tokens
```sql
id              UUID PRIMARY KEY
clerkOrgId      TEXT NOT NULL      -- Organization owner
provider        TEXT NOT NULL      -- "xero"
accessTokenEnc  TEXT NOT NULL      -- AES-256-GCM encrypted
refreshTokenEnc TEXT NOT NULL      -- AES-256-GCM encrypted
expiresAt       TIMESTAMP NOT NULL -- Token expiry
refreshTokenIssuedAt TIMESTAMP     -- For 60-day tracking
status          TEXT NOT NULL      -- active|superseded|revoked|refresh_failed
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

**`integration_tenant_bindings`** - Organization-to-tenant mappings
```sql
id               UUID PRIMARY KEY
clerkOrgId       TEXT NOT NULL      -- Clerk org ID
provider         TEXT NOT NULL      -- "xero"
externalTenantId TEXT NOT NULL      -- Xero tenant ID
externalTenantName TEXT             -- Cached tenant name
activeGrantId    UUID REFERENCES integration_grants
status           TEXT NOT NULL      -- active|needs_reauth
createdAt        TIMESTAMP
updatedAt        TIMESTAMP
```

**`integration_webhook_events`** - Webhook deduplication
```sql
id              UUID PRIMARY KEY
provider        TEXT NOT NULL
externalEventId TEXT NOT NULL      -- Xero event ID (unique)
tenantId        TEXT NOT NULL
payload         JSONB
processedAt     TIMESTAMP
createdAt       TIMESTAMP
```

**`integration_sync_state`** - Incremental sync cursors
```sql
id              UUID PRIMARY KEY
tenantBindingId UUID REFERENCES integration_tenant_bindings
dataType        TEXT NOT NULL      -- "invoices", "contacts", etc.
lastSyncAt      TIMESTAMP
syncCursor      TEXT               -- For incremental sync
```

---

## Security Features

### Token Encryption

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key**: 32-byte key from `TOKEN_ENC_KEY_HEX` environment variable
- **Storage**: IV + auth tag + ciphertext stored together
- **Implementation**: `lib/utils/encryption.ts`

### OAuth Security

- **State Parameter**: Random nonce prevents CSRF attacks
- **Nonce Storage**: Redis with 600s TTL
- **PKCE**: Proof Key for Code Exchange (if supported)

### Access Control

- **Organization Scoping**: Tools only access data for the authenticated org
- **Role Requirements**: Only org admins/owners can connect integrations
- **Approval Flow**: Write operations (e.g., `createXeroInvoice`) require user approval

### Input Validation

- **Zod Schemas**: All tool inputs validated with Zod
- **OData Sanitization**: Prevents injection in Xero API queries

### Webhook Security

- **Signature Validation**: HMAC-SHA256 verification
- **Timing-Safe Comparison**: Prevents timing attacks
- **Payload Limits**: 1MB maximum payload size

---

## Configuration

### Required Environment Variables

```bash
# Xero OAuth App Credentials
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=https://yourdomain.com/api/xero/callback

# Token Encryption Key (generate with: openssl rand -hex 32)
TOKEN_ENC_KEY_HEX=your_64_character_hex_key

# Webhook Signature Verification
XERO_WEBHOOK_KEY=your_webhook_key
```

### Optional Environment Variables

```bash
# Redis for sync queue and resumable streams
REDIS_URL=redis://localhost:6379
```

### Xero OAuth App Setup

1. Go to [Xero Developer Portal](https://developer.xero.com/app/manage)
2. Create a new app
3. Set redirect URI to match `XERO_REDIRECT_URI`
4. Enable required scopes:
   - `offline_access` - Refresh tokens
   - `accounting.transactions` - Invoices, bills
   - `accounting.reports.read` - P&L, Balance Sheet
   - `accounting.settings` - Organization details
   - `accounting.contacts` - Customers, suppliers
   - `accounting.attachments` - File attachments
   - `assets.read` - Fixed assets

---

## Tool Execution Flow

```
User Message
    ↓
AI Selects Tool (e.g., listXeroInvoices)
    ↓
Tool Checks Auth (Clerk userId + orgId)
    ↓
Tool Queries Tenant Binding
    ↓
TokenService.getClientForTenantBinding()
    ├── Check token expiry
    ├── Refresh if needed (single-flight)
    └── Return authenticated client
    ↓
Execute Xero API Request
    ↓
withTokenRefreshRetry() wrapper
    ├── Retry on 401 (one time)
    └── Force token refresh
    ↓
Format and Return Response
    ↓
AI Presents Results to User
```

---

## Webhook Processing

### Flow

```
Xero Event
    ↓
POST /api/webhooks/xero
    ↓
Validate Signature (HMAC-SHA256)
    ↓
Check Deduplication (externalEventId)
    ↓
Store in integration_webhook_events
    ↓
Enqueue Sync Job (Redis: xero-sync-queue)
    ↓
/api/cron/process-queue (scheduled)
    ↓
Sync Worker Processes Job
```

### Sync Queue (`lib/integrations/sync/queue.ts`)

- Redis-backed FIFO queue
- Key: `xero-sync-queue`
- Job structure: `{ tenantBindingId, eventId?, resourceType?, resourceId? }`

---

## Differences from MCP Architecture

| Aspect | Current (AI SDK) | MCP Would Offer |
|--------|------------------|-----------------|
| Protocol | REST endpoints | Standardized MCP |
| Tool Definition | AI SDK `tool()` | MCP resource/tool specs |
| Transport | Next.js API routes | Stdio/SSE/HTTP |
| Client Coupling | Tightly coupled | Decoupled server |
| Discovery | Hardcoded | Dynamic discovery |
| Standardization | Custom errors | Standardized handling |

The current implementation is fully functional for IntelliSync's use case. MCP would be beneficial for:
- Reusing Xero tools across multiple Claude applications
- Standardized tool discovery and execution
- Decoupled deployment and scaling

---

## Common Use Cases

### Check Connection Status
```
User: "Is Xero connected?"
Tool: listXeroOrganisation
```

### Query Financial Data
```
User: "What's our profit this quarter?"
Tools: listXeroProfitAndLoss (fromDate, toDate)
```

### Find Customer Details
```
User: "What's the email for Acme Corp?"
Tool: listXeroContacts (searchTerm: "Acme Corp")
```

### Create Invoice Workflow
```
User: "Create an invoice for Acme for $500 consulting"
Tools:
1. listXeroContacts (searchTerm: "Acme") → get contactID
2. listXeroAccounts (type: "REVENUE") → get accountCode
3. createXeroInvoice (requires approval)
```

### Accounts Receivable Analysis
```
User: "Show all unpaid invoices"
Tool: listXeroInvoices (type: "ACCREC", statuses: ["AUTHORISED"])
```

---

## Troubleshooting

### "Xero is not connected"
- Visit `/settings/integrations` to connect
- Ensure you have org admin/owner role

### "Missing required permissions"
- Xero scopes have been updated
- Reconnect Xero to grant new permissions
- Error code: `INSUFFICIENT_SCOPE`

### "Connection needs re-authentication"
- Refresh token expired (60-day limit)
- User revoked access in Xero
- Reconnect at `/settings/integrations`

### "Token refresh failed"
- Check `XERO_CLIENT_SECRET` is correct
- Verify Xero app is still active
- Check grant status in database

### Rate Limiting
- Xero has API rate limits
- Error includes `retry-after` header
- Tools automatically handle transient failures
