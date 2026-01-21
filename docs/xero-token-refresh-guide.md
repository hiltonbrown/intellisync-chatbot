# Xero Token Refresh Implementation Guide

## Executive Summary

This guide documents the token refresh implementation from the LedgerBot codebase for reuse in other applications. The implementation provides production-grade OAuth2 token management with automatic refresh, encryption, concurrency safety, and intelligent error handling.

**Key Features:**
- Automatic token refresh 5 minutes before expiry
- AES-256-GCM encryption for stored tokens
- Concurrent request protection with in-memory locks
- Optimistic database locking to prevent race conditions
- 60-day refresh token lifetime tracking
- Intelligent retry logic with 30-minute grace period
- Rate limit awareness and throttling
- JWT parsing for authoritative expiry timestamps

---

## Architecture Overview

### Token Lifecycle

```
1. Initial OAuth Flow
   ↓
2. Store Encrypted Tokens (access + refresh)
   ↓
3. API Request Initiated
   ↓
4. Check Token Expiry (<5 min remaining?)
   ↓ (yes)
5. Trigger Automatic Refresh
   ↓
6. Decrypt Old Tokens → Call Xero API → Get New Tokens
   ↓
7. Encrypt & Store New Tokens
   ↓
8. Proceed with Original API Request
```

### Core Components

1. **Connection Manager** - Orchestrates token refresh logic
2. **Encryption Module** - Secures tokens at rest
3. **Client Helpers** - Integrates refresh into API calls
4. **Database Layer** - Persists tokens with optimistic locking
5. **Rate Limit Handler** - Tracks Xero API limits
6. **Error Handler** - Distinguishes permanent vs temporary failures

---

## Implementation Steps

### Step 1: Database Schema

Create a table to store OAuth tokens and metadata:

```sql
CREATE TABLE xero_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Encrypted OAuth Tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,

  -- Critical: Track refresh token age (60-day Xero limit)
  refresh_token_issued_at TIMESTAMP NOT NULL,

  -- Xero Tenant Info
  tenant_id VARCHAR(255) NOT NULL,
  tenant_name VARCHAR(255),
  organisation_id VARCHAR(255),
  base_currency VARCHAR(3),
  organisation_type VARCHAR(50),
  scopes JSONB NOT NULL,
  authentication_event_id VARCHAR(255),

  -- Rate Limiting
  rate_limit_minute_remaining INTEGER,
  rate_limit_day_remaining INTEGER,
  rate_limit_reset_at TIMESTAMP,
  rate_limit_problem VARCHAR(50),

  -- Connection State
  is_active BOOLEAN NOT NULL DEFAULT true,
  connection_status VARCHAR(50) DEFAULT 'connected',
  last_error TEXT,

  -- Audit Trail
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_xero_connections_user_id ON xero_connections(user_id);
CREATE INDEX idx_xero_connections_tenant_id ON xero_connections(tenant_id);
CREATE INDEX idx_xero_connections_is_active ON xero_connections(is_active);
CREATE INDEX idx_xero_connections_expires_at ON xero_connections(expires_at);
```

### Step 2: Encryption Module

Implement AES-256-GCM encryption for token storage:

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.XERO_ENCRYPTION_KEY; // 32-byte hex string
  if (!key) {
    throw new Error("XERO_ENCRYPTION_KEY not set");
  }
  return Buffer.from(key, "hex");
}

export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

**Generate Encryption Key:**
```bash
# Generate 32-byte (256-bit) key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: JWT Parsing Utility

Extract expiry and metadata from Xero access tokens:

```typescript
// lib/jwt-parser.ts

export interface XeroJwtPayload {
  exp: number; // Unix timestamp (seconds)
  authentication_event_id?: string;
  nbf?: number; // Not before
  iat?: number; // Issued at
  xero_userid?: string;
  // ... other Xero-specific claims
}

export function parseXeroAccessToken(accessToken: string): {
  expiresAt: Date;
  authenticationEventId?: string;
} {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    // Decode base64url payload
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    ) as XeroJwtPayload;

    if (!payload.exp) {
      throw new Error("JWT missing required 'exp' claim");
    }

    // Convert Unix timestamp (seconds) to JavaScript Date (milliseconds)
    const expiresAt = new Date(payload.exp * 1000);

    return {
      expiresAt, // THIS IS THE AUTHORITATIVE SOURCE
      authenticationEventId: payload.authentication_event_id,
    };
  } catch (error) {
    throw new Error(`Failed to parse Xero access token: ${error.message}`);
  }
}
```

### Step 4: Token Refresh Logic

Implement the core refresh function with concurrency protection:

```typescript
// lib/token-refresh.ts

import { XeroClient } from "xero-node";
import { encryptToken, decryptToken } from "./encryption";
import { parseXeroAccessToken } from "./jwt-parser";

// In-memory lock to prevent concurrent refreshes
const tokenRefreshLocks = new Map<string, Promise<TokenRefreshResult>>();
const lastRefreshTimestamps = new Map<string, number>();

export interface TokenRefreshResult {
  success: boolean;
  connection?: XeroConnection;
  error?: string;
  isPermanentFailure?: boolean;
}

export async function refreshXeroToken(
  connectionId: string,
  retryWithOldToken = false
): Promise<TokenRefreshResult> {
  // Check for existing refresh in progress
  const existingRefresh = tokenRefreshLocks.get(connectionId);
  if (existingRefresh) {
    console.log(`🔒 Refresh in progress for ${connectionId}, waiting...`);
    return await existingRefresh;
  }

  // Safety check: Don't refresh if recently refreshed (<5 seconds)
  const lastRefresh = lastRefreshTimestamps.get(connectionId);
  if (lastRefresh && Date.now() - lastRefresh < 5000) {
    console.log(`⏭️ Recently refreshed, skipping`);
    const connection = await getConnectionById(connectionId);
    if (connection) {
      return { success: true, connection };
    }
  }

  // Create lock and execute refresh
  const refreshPromise = performTokenRefresh(connectionId, retryWithOldToken)
    .finally(() => {
      tokenRefreshLocks.delete(connectionId);
    });

  tokenRefreshLocks.set(connectionId, refreshPromise);
  return await refreshPromise;
}

async function performTokenRefresh(
  connectionId: string,
  retryWithOldToken = false
): Promise<TokenRefreshResult> {
  const connection = await getConnectionById(connectionId);
  if (!connection) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  try {
    // 1. Initialize Xero client
    const xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: connection.scopes,
    });
    await xeroClient.initialize();

    // 2. Decrypt stored tokens
    const decryptedAccessToken = decryptToken(connection.accessToken);
    const decryptedRefreshToken = decryptToken(connection.refreshToken);

    // 3. Set current token set
    await xeroClient.setTokenSet({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      token_type: "Bearer",
      expires_in: 1800, // Standard 30 minutes
    });

    // 4. Call Xero API to refresh
    console.log(`🔄 Calling Xero refresh API for ${connectionId}...`);
    const tokenSet = await xeroClient.refreshToken();

    if (!tokenSet.access_token || !tokenSet.refresh_token) {
      throw new Error("Invalid token response from Xero");
    }

    // 5. Extract expiry from JWT (CRITICAL!)
    const { expiresAt, authenticationEventId } = parseXeroAccessToken(
      tokenSet.access_token
    );

    console.log(`✅ Token refreshed, expires at: ${expiresAt.toISOString()}`);

    // 6. Update database with new tokens
    const updatedConnection = await updateXeroTokens({
      id: connectionId,
      accessToken: encryptToken(tokenSet.access_token),
      refreshToken: encryptToken(tokenSet.refresh_token),
      expiresAt,
      authenticationEventId,
      resetRefreshTokenIssuedAt: true, // Reset 60-day countdown
      expectedUpdatedAt: connection.updatedAt, // Optimistic locking
    });

    if (!updatedConnection) {
      // Optimistic lock failure - another process updated concurrently
      console.warn(`⚠️ Concurrent update detected for ${connectionId}`);
      const latest = await getConnectionById(connectionId);
      if (latest && latest.expiresAt > new Date()) {
        // Use the latest tokens (already refreshed by another process)
        return { success: true, connection: latest };
      }
      throw new Error("Failed to update tokens - concurrent modification");
    }

    // Track successful refresh
    lastRefreshTimestamps.set(connectionId, Date.now());

    return { success: true, connection: updatedConnection };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Token refresh failed: ${errorMessage}`);

    // Determine if permanent vs temporary failure
    const isPermanent =
      error instanceof Error &&
      (error.message.includes("invalid_grant") ||
        error.message.includes("refresh_token") ||
        error.message.toLowerCase().includes("expired"));

    // Implement 30-minute grace period retry
    if (!retryWithOldToken && !isPermanent) {
      const tokenAge = Date.now() - new Date(connection.updatedAt).getTime();
      const THIRTY_MINUTES = 30 * 60 * 1000;

      if (tokenAge < THIRTY_MINUTES) {
        console.log(`🔁 Retrying with old token (within grace period)...`);
        return await performTokenRefresh(connectionId, true);
      }
    }

    // For permanent failures, deactivate connection
    if (isPermanent) {
      console.error(`🔴 Permanent failure - deactivating connection`);
      await deactivateConnection(connectionId);
    }

    return {
      success: false,
      error: errorMessage,
      isPermanentFailure: isPermanent,
    };
  }
}
```

### Step 5: Connection Manager

Integrate refresh into connection retrieval:

```typescript
// lib/connection-manager.ts

export interface DecryptedXeroConnection extends XeroConnection {
  accessToken: string; // Decrypted
  refreshToken: string; // Decrypted
}

export async function getDecryptedConnection(
  userId: string,
  tenantId?: string
): Promise<DecryptedXeroConnection | null> {
  // 1. Fetch connection from database
  const connection = await getActiveConnection(userId, tenantId);
  if (!connection) {
    return null;
  }

  // 2. Check refresh token age (Xero limit: 60 days)
  const refreshTokenAge =
    Date.now() - new Date(connection.refreshTokenIssuedAt).getTime();
  const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
  const FIFTY_FIVE_DAYS = 55 * 24 * 60 * 60 * 1000;

  if (refreshTokenAge >= SIXTY_DAYS) {
    // Hard stop - refresh token definitely expired
    console.error(`🔴 Refresh token expired (${Math.floor(refreshTokenAge / (24*60*60*1000))} days old)`);
    await deactivateConnection(connection.id);
    throw new Error(
      "Xero refresh token expired. Please reconnect your Xero account."
    );
  }

  if (refreshTokenAge > FIFTY_FIVE_DAYS) {
    // Warning - approaching expiry
    const daysRemaining = 60 - Math.floor(refreshTokenAge / (24*60*60*1000));
    console.warn(`⚠️ Refresh token expires in ${daysRemaining} days`);
  }

  // 3. Check if access token needs refresh (within 5 minutes of expiry)
  const expiresAt = new Date(connection.expiresAt);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log(`🔄 Access token expiring soon, triggering refresh...`);

    const refreshResult = await refreshXeroToken(connection.id);

    if (refreshResult.success && refreshResult.connection) {
      // Return with decrypted tokens
      return {
        ...refreshResult.connection,
        accessToken: decryptToken(refreshResult.connection.accessToken),
        refreshToken: decryptToken(refreshResult.connection.refreshToken),
      };
    }

    if (refreshResult.isPermanentFailure) {
      // Refresh token expired - deactivate
      await deactivateConnection(connection.id);
      throw new Error("Xero refresh token expired. Please reconnect.");
    }

    // Temporary failure - throw to retry later
    throw new Error(`Token refresh failed: ${refreshResult.error}`);
  }

  // 4. Token still valid - return with decrypted tokens
  return {
    ...connection,
    accessToken: decryptToken(connection.accessToken),
    refreshToken: decryptToken(connection.refreshToken),
  };
}
```

### Step 6: Database Update with Optimistic Locking

Prevent race conditions when updating tokens:

```typescript
// lib/database.ts

export async function updateXeroTokens({
  id,
  accessToken,
  refreshToken,
  expiresAt,
  authenticationEventId,
  resetRefreshTokenIssuedAt = true,
  expectedUpdatedAt,
}: {
  id: string;
  accessToken: string; // Encrypted
  refreshToken: string; // Encrypted
  expiresAt: Date;
  authenticationEventId?: string;
  resetRefreshTokenIssuedAt?: boolean;
  expectedUpdatedAt?: Date; // For optimistic locking
}): Promise<XeroConnection | null> {
  const now = new Date();

  const updates = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    authentication_event_id: authenticationEventId,
    updated_at: now,
    ...(resetRefreshTokenIssuedAt && { refresh_token_issued_at: now }),
  };

  // Build WHERE clause with optimistic lock
  const whereClause = expectedUpdatedAt
    ? `WHERE id = $1 AND updated_at = $2` // LOCK: Only update if not changed
    : `WHERE id = $1`;

  const params = expectedUpdatedAt
    ? [id, expectedUpdatedAt]
    : [id];

  const result = await db.query(
    `UPDATE xero_connections
     SET ${Object.keys(updates).map((k, i) => `${k} = $${i + params.length + 1}`).join(', ')}
     ${whereClause}
     RETURNING *`,
    [...params, ...Object.values(updates)]
  );

  if (result.rows.length === 0) {
    // No rows updated
    if (expectedUpdatedAt) {
      console.warn(`⚠️ Optimistic lock failure - concurrent update detected`);
      return null; // Signal lock failure to caller
    }
    throw new Error("Connection not found");
  }

  return result.rows[0];
}

export async function deactivateConnection(connectionId: string): Promise<void> {
  await db.query(
    `UPDATE xero_connections
     SET is_active = false,
         connection_status = 'disconnected',
         updated_at = NOW()
     WHERE id = $1`,
    [connectionId]
  );
}
```

### Step 7: Client Helper Integration

Wrap API calls with automatic token management:

```typescript
// lib/api-client.ts

export async function getXeroClient(
  userId: string,
  tenantId?: string
): Promise<{ client: XeroClient; connection: DecryptedXeroConnection }> {
  // This automatically triggers refresh if needed
  const connection = await getDecryptedConnection(userId, tenantId);

  if (!connection) {
    throw new Error("No active Xero connection. Please connect to Xero.");
  }

  // Initialize Xero client
  const client = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: connection.scopes,
  });

  await client.initialize();

  // Calculate actual remaining time (don't assume 30 minutes)
  const expiresAt = new Date(connection.expiresAt);
  const now = new Date();
  const actualSecondsRemaining = Math.floor(
    (expiresAt.getTime() - now.getTime()) / 1000
  );

  // If expiring within 60 seconds, set to 1 to trigger immediate refresh
  const secondsRemaining = actualSecondsRemaining <= 60 ? 1 : actualSecondsRemaining;

  await client.setTokenSet({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    token_type: "Bearer",
    expires_in: secondsRemaining,
  });

  return { client, connection };
}

// Example API call wrapper
export async function getXeroInvoices(
  userId: string,
  options?: { status?: string }
): Promise<Invoice[]> {
  const { client, connection } = await getXeroClient(userId);

  try {
    const response = await client.accountingApi.getInvoices(
      connection.tenantId,
      undefined, // ifModifiedSince
      options?.status ? `Status=="${options.status}"` : undefined
    );

    // Persist any token changes
    await persistTokenSetIfChanged(client, connection);

    return response.body.invoices || [];
  } catch (error) {
    await handleApiError(error, connection);
    throw error;
  }
}

async function persistTokenSetIfChanged(
  client: XeroClient,
  connection: DecryptedXeroConnection
): Promise<void> {
  const tokenSet = client.readTokenSet();

  if (!tokenSet?.access_token || !tokenSet?.refresh_token) {
    return;
  }

  // Check if tokens changed
  const hasChanged =
    tokenSet.access_token !== connection.accessToken ||
    tokenSet.refresh_token !== connection.refreshToken;

  if (!hasChanged) {
    return;
  }

  console.log(`💾 Persisting token changes for ${connection.id}...`);

  const { expiresAt, authenticationEventId } = parseXeroAccessToken(
    tokenSet.access_token
  );

  await updateXeroTokens({
    id: connection.id,
    accessToken: encryptToken(tokenSet.access_token),
    refreshToken: encryptToken(tokenSet.refresh_token),
    expiresAt,
    authenticationEventId,
    resetRefreshTokenIssuedAt: true,
    expectedUpdatedAt: connection.updatedAt,
  });
}
```

### Step 8: Rate Limiting (Optional but Recommended)

Track Xero API rate limits:

```typescript
// lib/rate-limiter.ts

export interface RateLimitInfo {
  minuteRemaining?: number;
  dayRemaining?: number;
  retryAfter?: number;
  problem?: "minute" | "day";
  resetAt?: Date;
}

export function extractRateLimits(responseHeaders: Headers): RateLimitInfo {
  const info: RateLimitInfo = {};

  const minuteRemaining = responseHeaders.get("X-MinLimit-Remaining");
  const dayRemaining = responseHeaders.get("X-DayLimit-Remaining");
  const problem = responseHeaders.get("X-Rate-Limit-Problem");
  const retryAfter = responseHeaders.get("Retry-After");

  if (minuteRemaining) {
    info.minuteRemaining = Number.parseInt(minuteRemaining, 10);
  }
  if (dayRemaining) {
    info.dayRemaining = Number.parseInt(dayRemaining, 10);
  }
  if (problem) {
    info.problem = problem as "minute" | "day";
  }
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    info.retryAfter = seconds;
    info.resetAt = new Date(Date.now() + seconds * 1000);
  }

  return info;
}

export async function updateRateLimits(
  connectionId: string,
  rateLimits: RateLimitInfo
): Promise<void> {
  await db.query(
    `UPDATE xero_connections
     SET rate_limit_minute_remaining = $2,
         rate_limit_day_remaining = $3,
         rate_limit_reset_at = $4,
         rate_limit_problem = $5,
         updated_at = NOW()
     WHERE id = $1`,
    [
      connectionId,
      rateLimits.minuteRemaining,
      rateLimits.dayRemaining,
      rateLimits.resetAt,
      rateLimits.problem,
    ]
  );
}

export function shouldThrottle(connection: XeroConnection): {
  wait: boolean;
  waitMs?: number;
  reason?: string;
} {
  // Check active rate limit
  if (connection.rateLimitResetAt) {
    const now = new Date();
    if (connection.rateLimitResetAt > now) {
      const waitMs = connection.rateLimitResetAt.getTime() - now.getTime();
      return {
        wait: true,
        waitMs,
        reason: `Rate limit active (${connection.rateLimitProblem})`,
      };
    }
  }

  // Proactive throttling
  if (
    connection.rateLimitMinuteRemaining !== null &&
    connection.rateLimitMinuteRemaining <= 2
  ) {
    return {
      wait: true,
      waitMs: 60_000,
      reason: "Approaching minute rate limit",
    };
  }

  if (
    connection.rateLimitDayRemaining !== null &&
    connection.rateLimitDayRemaining <= 50
  ) {
    return {
      wait: true,
      waitMs: 300_000,
      reason: "Approaching daily rate limit",
    };
  }

  return { wait: false };
}
```

---

## Environment Variables

```bash
# Xero OAuth Credentials
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=https://yourapp.com/api/xero/callback

# Token Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
XERO_ENCRYPTION_KEY=64_character_hex_string

# Database Connection
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

---

## Testing Considerations

### Unit Tests

```typescript
// __tests__/token-refresh.test.ts

describe("Token Refresh", () => {
  it("should refresh token when expiring within 5 minutes", async () => {
    const connection = createMockConnection({
      expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes from now
    });

    const result = await getDecryptedConnection(connection.userId);

    expect(result.expiresAt).toBeGreaterThan(new Date(Date.now() + 25 * 60 * 1000));
  });

  it("should detect expired refresh token (60 days)", async () => {
    const connection = createMockConnection({
      refreshTokenIssuedAt: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000),
    });

    await expect(getDecryptedConnection(connection.userId)).rejects.toThrow(
      "refresh token expired"
    );
  });

  it("should prevent concurrent refresh", async () => {
    const connection = createMockConnection();

    // Trigger two refreshes simultaneously
    const [result1, result2] = await Promise.all([
      refreshXeroToken(connection.id),
      refreshXeroToken(connection.id),
    ]);

    // Both should succeed with same tokens
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.connection?.accessToken).toBe(result2.connection?.accessToken);
  });

  it("should handle optimistic locking failures", async () => {
    const connection = createMockConnection();

    // Simulate concurrent update by another process
    await db.query(
      `UPDATE xero_connections SET updated_at = NOW() WHERE id = $1`,
      [connection.id]
    );

    const result = await updateXeroTokens({
      id: connection.id,
      accessToken: "new_token",
      refreshToken: "new_refresh",
      expiresAt: new Date(),
      expectedUpdatedAt: connection.updatedAt, // Stale timestamp
    });

    expect(result).toBeNull(); // Should fail due to lock
  });
});
```

### Integration Tests

```typescript
// __tests__/xero-api.integration.test.ts

describe("Xero API Integration", () => {
  it("should automatically refresh expired token during API call", async () => {
    const user = await createTestUser();
    const connection = await createTestXeroConnection(user.id, {
      expiresAt: new Date(Date.now() - 1000), // Already expired
    });

    // Should trigger automatic refresh
    const invoices = await getXeroInvoices(user.id);

    // Verify token was refreshed
    const updated = await getConnectionById(connection.id);
    expect(updated.expiresAt).toBeGreaterThan(new Date());
    expect(updated.accessToken).not.toBe(connection.accessToken);
  });

  it("should retry with old token within grace period", async () => {
    const connection = createMockConnection({
      updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    });

    // Mock Xero API to fail first refresh, succeed on retry
    mockXeroClient.refreshToken
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce(createMockTokenSet());

    const result = await refreshXeroToken(connection.id);

    expect(result.success).toBe(true);
    expect(mockXeroClient.refreshToken).toHaveBeenCalledTimes(2);
  });
});
```

---

## Best Practices & Gotchas

### ✅ DO:

1. **Always use JWT `exp` claim** as the authoritative source for token expiry, not `expires_in` parameter
2. **Implement optimistic locking** to prevent race conditions in high-concurrency environments
3. **Track `refreshTokenIssuedAt`** separately to enforce Xero's 60-day limit
4. **Encrypt tokens at rest** using AES-256-GCM (not just hashing)
5. **Refresh proactively** (5 minutes before expiry) to avoid failures during API calls
6. **Use in-memory locks** to prevent multiple concurrent refreshes of the same connection
7. **Implement 30-minute grace period** for retry with old token
8. **Distinguish permanent vs temporary failures** to avoid deactivating connections unnecessarily
9. **Log all refresh attempts** with correlation IDs for debugging

### ❌ DON'T:

1. **Don't calculate expiry from `expires_in`** - JWT `exp` claim is the truth
2. **Don't refresh on every API call** - check if token is still valid first
3. **Don't store tokens in plain text** - always encrypt
4. **Don't ignore refresh token age** - Xero enforces 60-day hard limit
5. **Don't assume refresh always succeeds** - handle failures gracefully
6. **Don't deactivate on first failure** - implement retry logic first
7. **Don't refresh multiple times concurrently** - use locking mechanisms
8. **Don't trust `expires_in` alone** - tokens may expire earlier than expected
9. **Don't forget to update `refreshTokenIssuedAt`** when tokens are refreshed

### 🔐 Security Notes:

- **Encryption key rotation**: Plan for periodic key rotation with dual-key support
- **Connection deactivation**: Always deactivate on permanent OAuth failures
- **Audit logging**: Log all token refreshes and failures for security monitoring
- **CSRF protection**: Use state parameter in OAuth flow to prevent CSRF attacks

### ⚡ Performance Tips:

- **Connection pooling**: Reuse database connections for token updates
- **Cache connections**: Cache decrypted connections for 60 seconds (shorter than token validity)
- **Batch API calls**: Minimize refreshes by batching operations
- **Rate limit awareness**: Track and respect Xero's per-minute and per-day limits

---

## Critical Files Summary

| File | Purpose |
|------|---------|
| `lib/encryption.ts` | AES-256-GCM token encryption/decryption |
| `lib/jwt-parser.ts` | Extract expiry and metadata from JWT |
| `lib/token-refresh.ts` | Core refresh logic with locking |
| `lib/connection-manager.ts` | Integration point for API calls |
| `lib/database.ts` | Token persistence with optimistic locking |
| `lib/rate-limiter.ts` | Rate limit tracking and throttling |

---

## Next Steps for Implementation

1. **Create database schema** with all required fields
2. **Set up encryption** with secure key generation
3. **Implement JWT parsing** for accurate expiry detection
4. **Build refresh logic** with concurrency protection
5. **Integrate into API client** for automatic refresh
6. **Add rate limiting** (optional but recommended)
7. **Write comprehensive tests** for edge cases
8. **Set up monitoring** for refresh failures and token expiry

---

## References

- **Xero OAuth2 Documentation**: https://developer.xero.com/documentation/guides/oauth2/overview
- **Token Lifetimes**: Access tokens (30 min), Refresh tokens (60 days)
- **Rate Limits**: 60 calls/minute per tenant, 5000 calls/day per tenant
- **JWT Standard**: RFC 7519 (https://datatracker.ietf.org/doc/html/rfc7519)
- **AES-GCM**: NIST SP 800-38D (https://csrc.nist.gov/publications/detail/sp/800-38d/final)

---

**Last Updated**: January 2026
**Source**: LedgerBot codebase (Next.js 16 + PostgreSQL + Drizzle ORM)
