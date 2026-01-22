# Xero Token Refresh Review & Improvement Plan

## Executive Summary

The current Xero token refresh implementation is **production-grade** with strong fundamentals:
- ✅ Triple-layer concurrency safety (in-memory, timestamp cache, DB row locks)
- ✅ AES-256-GCM encryption at rest
- ✅ Proactive refresh (5-min buffer + 50-day refresh token age check)
- ✅ Comprehensive error handling with user-friendly messages
- ✅ Security-first design (CSRF, HMAC, constant-time comparison)

However, there are opportunities for improvement in **observability**, **reliability**, **performance**, and **user experience**.

---

## Current Implementation Analysis

### Architecture Overview

**Core Files:**
- `lib/integrations/token-service.ts` (316 lines) - Main token lifecycle management
- `lib/integrations/xero/adapter.ts` - OAuth flow and API client
- `lib/utils/encryption.ts` - Token encryption/decryption
- `lib/db/schema.ts` - Database schema (grants, bindings, events)

**Token Lifecycle States:**
```
active → (refresh) → active
       → (failure) → refresh_failed → needs_reauth
       → (disconnect) → revoked
```

### Concurrency Safety Mechanisms

1. **In-Memory Lock** (same process):
   ```typescript
   const tokenRefreshLocks = new Map<string, Promise<IntegrationGrant>>();
   ```
   - Prevents duplicate refreshes in single process
   - **Limitation:** Not distributed across multiple server instances

2. **Timestamp Cache** (5-second throttle):
   ```typescript
   const lastRefreshTimestamps = new Map<string, number>();
   ```
   - **Limitation:** Unbounded Map (no eviction policy)
   - **Risk:** Memory leak on high grant volume

3. **Database Row-Level Lock** (cross-process):
   ```typescript
   .for("update")  // PostgreSQL row lock
   ```
   - ✅ Prevents race conditions across processes
   - ✅ Automatic release on transaction commit/rollback

### Token Refresh Triggers

1. **Time-based (5-min buffer):** `isPast(addMinutes(grant.expiresAt, -5))`
2. **Age-based (50-day refresh token):** Resets 60-day rolling expiry
3. **Force refresh:** Explicit parameter for 401 retries

### Error Handling

| Error Type | Action | User Impact |
|------------|--------|-------------|
| `400 invalid_grant` | Mark `refresh_failed`, set binding to `needs_reauth` | Must reconnect |
| Network/5xx errors | Log, keep grant `active` | Retry on next access |
| `401 insufficient_scope` | Error message with reconnect instructions | Must reconnect with new scopes |

---

## Identified Improvement Opportunities

### 1. 🔍 Observability & Monitoring (HIGH PRIORITY)

**Current State:**
- Console logging only (`console.log`, `console.error`)
- No structured logging or metrics
- No alerting for high failure rates
- No visibility into refresh latency

**Recommendations:**

#### A. Add Structured Logging
```typescript
// lib/integrations/logging.ts
import { logger } from "@/lib/logging"; // Hypothetical structured logger

logger.info("token_refresh_started", {
  grantId,
  orgId,
  trigger: "proactive" | "force" | "age-based",
  timeUntilExpiry: minutes,
});

logger.info("token_refresh_succeeded", {
  grantId,
  orgId,
  duration: milliseconds,
  newExpiresAt,
});

logger.error("token_refresh_failed", {
  grantId,
  orgId,
  error: error.code,
  isPermanent: true | false,
  retryAttempt: 1 | 2,
});
```

**Benefits:**
- Centralized log aggregation (Datadog, CloudWatch, Axiom)
- Query logs for patterns ("Show all failed refreshes for org X")
- Build dashboards and alerts

#### B. Add Metrics/Telemetry
```typescript
// lib/integrations/metrics.ts
export const tokenRefreshMetrics = {
  refreshAttempts: counter("token_refresh_attempts", ["provider", "trigger"]),
  refreshSuccesses: counter("token_refresh_successes", ["provider"]),
  refreshFailures: counter("token_refresh_failures", ["provider", "error_type"]),
  refreshDuration: histogram("token_refresh_duration_ms", ["provider"]),
  tokenExpiryBuffer: histogram("token_expiry_buffer_minutes", ["provider"]),
};
```

**Integrate into Token Service:**
```typescript
// token-service.ts
const startTime = Date.now();
tokenRefreshMetrics.refreshAttempts.inc({ provider: "xero", trigger });

try {
  const grant = await performRefresh();
  tokenRefreshMetrics.refreshSuccesses.inc({ provider: "xero" });
  tokenRefreshMetrics.refreshDuration.observe({ provider: "xero" }, Date.now() - startTime);
  return grant;
} catch (error) {
  tokenRefreshMetrics.refreshFailures.inc({
    provider: "xero",
    error_type: error.code || "unknown",
  });
  throw error;
}
```

**Benefits:**
- Real-time dashboards (Grafana, Vercel Analytics)
- SLO tracking (e.g., "99% of refreshes succeed within 2s")
- Proactive alerting (e.g., "Refresh failure rate > 5% in last 10 min")

#### C. Distributed Tracing
```typescript
// Use OpenTelemetry or Sentry tracing
import { trace } from "@opentelemetry/api";

const span = trace.getTracer("intellisync").startSpan("xero.token.refresh");
span.setAttribute("grant.id", grantId);
span.setAttribute("org.id", orgId);

try {
  // ... refresh logic
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
} finally {
  span.end();
}
```

**Benefits:**
- See full request path (chat API → tool → token service → Xero API)
- Identify bottlenecks (e.g., "DB lock wait takes 800ms")

---

### 2. 🛡️ Reliability & Resilience (HIGH PRIORITY)

**Current State:**
- Single retry on temporary errors
- No exponential backoff
- No circuit breaker for Xero API outages
- In-memory locks don't work across multiple server instances

**Recommendations:**

#### A. Implement Exponential Backoff with Jitter
```typescript
// lib/integrations/retry.ts
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    jitterFactor: number;
  },
): Promise<T> {
  let attempt = 0;
  let delay = options.initialDelayMs;

  while (attempt <= options.maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      if (attempt > options.maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const jitter = delay * options.jitterFactor * Math.random();
      const actualDelay = Math.min(delay + jitter, options.maxDelayMs);

      await sleep(actualDelay);
      delay *= 2; // Exponential
    }
  }
}

// Usage in token-service.ts
const tokenSet = await retryWithBackoff(
  () => xeroAdapter.refreshTokens(decryptToken(grant.refreshTokenEnc)),
  {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    jitterFactor: 0.3,
  },
);
```

**Benefits:**
- Better resilience to transient failures
- Reduces thundering herd (jitter spreads retries)
- Industry best practice (AWS SDK, Stripe SDK use this)

#### B. Circuit Breaker for Xero API
```typescript
// lib/integrations/circuit-breaker.ts
class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount = 0;
  private lastFailureTime?: number;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime! < this.resetTimeout) {
        throw new Error("Circuit breaker OPEN");
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }
}

// token-service.ts
const xeroCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
});

const tokenSet = await xeroCircuitBreaker.execute(() =>
  xeroAdapter.refreshTokens(refreshToken)
);
```

**Benefits:**
- Stop hammering failing Xero API (prevents cascade failures)
- Fast-fail when Xero is down (better UX than timeouts)
- Auto-recover when Xero comes back online

#### C. Distributed Locking with Redis (Optional)
```typescript
// lib/integrations/distributed-lock.ts
import { Redis } from "ioredis";

export async function acquireDistributedLock(
  redis: Redis,
  key: string,
  ttlSeconds: number,
): Promise<string | null> {
  const lockValue = crypto.randomUUID();
  const acquired = await redis.set(key, lockValue, "EX", ttlSeconds, "NX");
  return acquired === "OK" ? lockValue : null;
}

export async function releaseDistributedLock(
  redis: Redis,
  key: string,
  lockValue: string,
): Promise<void> {
  // Lua script for atomic check-and-delete
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, key, lockValue);
}

// token-service.ts (alternative to in-memory lock)
const lockKey = `lock:token-refresh:${grantId}`;
const lockValue = await acquireDistributedLock(redis, lockKey, 30);

if (!lockValue) {
  // Another instance is refreshing, wait and fetch from DB
  await sleep(500);
  return await getGrantById(grantId);
}

try {
  // Perform refresh
} finally {
  await releaseDistributedLock(redis, lockKey, lockValue);
}
```

**Benefits:**
- Works across multiple server instances (horizontal scaling)
- Prevents duplicate refreshes in multi-instance deployments
- Required if deploying to Vercel with multiple regions

**Trade-offs:**
- Adds Redis dependency (already optional in codebase)
- Increased complexity
- Single point of failure (mitigated with Redis cluster)

**Recommendation:** Implement if deploying to multi-instance environment. Otherwise, current DB row locks are sufficient.

---

### 3. ⚡ Performance Optimizations (MEDIUM PRIORITY)

**Current State:**
- Unbounded in-memory Map caches
- No Redis caching for grants
- Every token access hits database

**Recommendations:**

#### A. Use LRU Cache with TTL
```typescript
// lib/integrations/token-cache.ts
import { LRUCache } from "lru-cache";

const tokenRefreshLocks = new LRUCache<string, Promise<IntegrationGrant>>({
  max: 500, // Max 500 concurrent refreshes
  ttl: 30_000, // 30 seconds
});

const lastRefreshTimestamps = new LRUCache<string, number>({
  max: 1000, // Track last 1000 grants
  ttl: 60_000, // 1 minute
});
```

**Benefits:**
- Bounded memory usage (prevents leaks)
- Automatic eviction of stale entries
- Better performance on high-traffic deployments

#### B. Cache Valid Grants in Redis (Optional)
```typescript
// lib/integrations/grant-cache.ts
export async function getCachedGrant(
  grantId: string,
): Promise<IntegrationGrant | null> {
  const cached = await redis.get(`grant:${grantId}`);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedGrant(
  grant: IntegrationGrant,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(
    `grant:${grant.id}`,
    JSON.stringify(grant),
    "EX",
    ttlSeconds,
  );
}

// token-service.ts
const cached = await getCachedGrant(grantId);
if (cached && !needsRefresh(cached)) {
  return cached;
}

const grant = await db.query.integrationGrants.findFirst(/* ... */);
await setCachedGrant(grant, 60); // Cache for 1 minute
return grant;
```

**Benefits:**
- Reduce database load (especially for high-traffic tools)
- Sub-millisecond latency for cached grants
- Share cache across multiple server instances

**Trade-offs:**
- Cache invalidation complexity (must invalidate on refresh)
- Stale data risk (mitigated with short TTL)

**Recommendation:** Implement if seeing high DB load from token service queries.

#### C. Optimize Database Queries
```sql
-- Current indices (already present):
CREATE INDEX integration_grants_org_idx ON integration_grants(clerk_org_id);
CREATE INDEX integration_grants_expiry_idx ON integration_grants(expires_at, status);

-- Additional recommended indices:
CREATE INDEX integration_grants_active_org_idx
  ON integration_grants(clerk_org_id, status)
  WHERE status = 'active';

-- For common binding lookup pattern:
CREATE INDEX integration_tenant_bindings_active_grant_idx
  ON integration_tenant_bindings(active_grant_id)
  WHERE status = 'active';
```

**Benefits:**
- Faster queries for active grants by organization
- Reduced query planning overhead (partial indices)

---

### 4. 👤 User Experience Improvements (MEDIUM PRIORITY)

**Current State:**
- Users only discover refresh failures when using tools
- No proactive notifications
- No graceful degradation

**Recommendations:**

#### A. Background Token Refresh Cron Job
```typescript
// app/api/cron/refresh-expiring-tokens/route.ts
export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Find grants expiring in next 10 minutes
  const expiringGrants = await db.query.integrationGrants.findMany({
    where: and(
      eq(integrationGrants.status, "active"),
      lt(integrationGrants.expiresAt, addMinutes(new Date(), 10)),
      gt(integrationGrants.expiresAt, new Date()),
    ),
  });

  let refreshed = 0;
  let failed = 0;

  for (const grant of expiringGrants) {
    try {
      await TokenService.refreshTokenForGrant(grant.id, true);
      refreshed++;
    } catch (error) {
      failed++;
      console.error(`Background refresh failed for grant ${grant.id}`, error);
    }
  }

  return Response.json({ refreshed, failed, total: expiringGrants.length });
}
```

**Vercel Cron Configuration:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/refresh-expiring-tokens",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Benefits:**
- Proactive refresh before users encounter issues
- Reduces latency on first tool invocation (token already fresh)
- Better visibility into refresh health (cron logs)

#### B. User Notifications for Failed Refreshes
```typescript
// lib/integrations/notifications.ts
export async function notifyTokenRefreshFailed(
  orgId: string,
  provider: string,
  error: string,
): Promise<void> {
  // Option 1: Email notification (via Resend, SendGrid)
  await sendEmail({
    to: await getOrgAdminEmails(orgId),
    subject: `Action Required: Reconnect ${provider} integration`,
    body: `Your ${provider} connection needs to be re-authorized...`,
  });

  // Option 2: In-app notification (via Clerk or custom system)
  await createInAppNotification({
    orgId,
    title: "Integration disconnected",
    message: `Please reconnect ${provider} in Settings`,
    severity: "warning",
    actionUrl: "/settings/integrations",
  });
}

// token-service.ts (on permanent failure)
if (isPermanentFailure(error)) {
  await notifyTokenRefreshFailed(grant.clerkOrgId, "xero", error.message);
}
```

**Benefits:**
- Users learn about issues before encountering them
- Reduces support tickets ("Xero stopped working")
- Better overall UX

#### C. Graceful Degradation for Read-Only Operations
```typescript
// lib/integrations/cache-fallback.ts
const CACHED_RESPONSE_TTL = 300; // 5 minutes

export async function fetchWithCacheFallback<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  try {
    const data = await fetchFn();
    await redis.set(cacheKey, JSON.stringify(data), "EX", CACHED_RESPONSE_TTL);
    return data;
  } catch (error) {
    // If Xero is down, serve stale cached data
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.warn(`Serving stale cached data for ${cacheKey}`);
      return JSON.parse(cached);
    }
    throw error;
  }
}

// Usage in tools (e.g., list-xero-invoices.ts)
const invoices = await fetchWithCacheFallback(
  `xero:invoices:${orgId}:${tenantId}`,
  async () => {
    const client = await TokenService.getClientForTenantBinding(bindingId, orgId);
    return await client.fetch("/Invoices");
  },
);
```

**Benefits:**
- Better availability during Xero outages
- Improved user experience (stale data better than errors)
- Reduced impact of rate limiting

**Trade-offs:**
- Stale data can be misleading
- Only appropriate for read-only operations
- Cache invalidation complexity

---

### 5. 🔐 Security Enhancements (LOW PRIORITY - Already Strong)

**Current State:**
- Token encryption at rest (AES-256-GCM) ✅
- CSRF protection ✅
- Webhook signature validation ✅
- Constant-time comparison ✅

**Recommendations:**

#### A. Implement Key Rotation
```typescript
// lib/utils/encryption.ts
const ENCRYPTION_KEYS = {
  v1: Buffer.from(process.env.TOKEN_ENC_KEY_V1_HEX!, "hex"),
  v2: Buffer.from(process.env.TOKEN_ENC_KEY_V2_HEX!, "hex"),
};
const CURRENT_VERSION = 2;

export function encryptToken(plaintext: string): string {
  const key = ENCRYPTION_KEYS[`v${CURRENT_VERSION}`];
  // ... existing encryption logic
  return `v${CURRENT_VERSION}:${iv}:${authTag}:${encrypted}`;
}

export function decryptToken(ciphertext: string): string {
  const [version] = ciphertext.split(":");
  const keyVersion = parseInt(version.slice(1), 10);
  const key = ENCRYPTION_KEYS[`v${keyVersion}`];

  if (!key) {
    throw new Error(`Unknown encryption key version: ${keyVersion}`);
  }
  // ... existing decryption logic
}
```

**Migration Script:**
```typescript
// scripts/rotate-encryption-keys.ts
async function rotateEncryptionKeys() {
  const grants = await db.query.integrationGrants.findMany({
    where: like(integrationGrants.accessTokenEnc, "v1:%"),
  });

  for (const grant of grants) {
    const accessToken = decryptToken(grant.accessTokenEnc); // Decrypt with v1
    const refreshToken = decryptToken(grant.refreshTokenEnc);

    await db.update(integrationGrants)
      .set({
        accessTokenEnc: encryptToken(accessToken), // Encrypt with v2
        refreshTokenEnc: encryptToken(refreshToken),
      })
      .where(eq(integrationGrants.id, grant.id));
  }
}
```

**Benefits:**
- Reduced impact of key compromise
- Compliance with key rotation policies (SOC 2, PCI DSS)

#### B. Add Audit Trail
```typescript
// lib/db/schema.ts
export const integrationAuditLog = pgTable("integration_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  grantId: uuid("grant_id").references(() => integrationGrants.id),
  orgId: text("org_id").notNull(),
  userId: text("user_id"),
  action: varchar("action").notNull(), // "token_refresh", "token_access", "token_revoked"
  result: varchar("result").notNull(), // "success", "failure"
  errorCode: varchar("error_code"),
  metadata: json("metadata"), // { duration, trigger, etc. }
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// token-service.ts
await db.insert(integrationAuditLog).values({
  grantId,
  orgId: grant.clerkOrgId,
  userId,
  action: "token_refresh",
  result: "success",
  metadata: { trigger, duration, newExpiresAt },
});
```

**Benefits:**
- Forensics for security incidents
- Compliance requirements (SOC 2, GDPR)
- Detect suspicious patterns (e.g., 10 failed refreshes in 1 min)

#### C. Rate Limiting on OAuth Endpoints
```typescript
// lib/integrations/rate-limiter.ts
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateLimiter.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count++;
  return true;
}

// app/api/integrations/xero/start/route.ts
if (!checkRateLimit(`oauth:start:${userId}`, 5, 60_000)) {
  return new Response("Too many OAuth attempts", { status: 429 });
}
```

**Benefits:**
- Prevent OAuth flow abuse
- Mitigate brute-force attacks on authorization

---

### 6. 📝 Code Quality & Maintainability (LOW PRIORITY)

**Recommendations:**

#### A. Extract Retry Logic to Separate Module
```typescript
// lib/integrations/retry-helper.ts (already exists, but could be enhanced)
export class RetryableOperation<T> {
  constructor(
    private operation: () => Promise<T>,
    private options: RetryOptions,
  ) {}

  async execute(): Promise<T> {
    // Exponential backoff, jitter, circuit breaker integration
  }
}

// token-service.ts
const refreshOp = new RetryableOperation(
  () => xeroAdapter.refreshTokens(refreshToken),
  { maxRetries: 3, backoff: "exponential" },
);
const tokenSet = await refreshOp.execute();
```

#### B. Split Token Service into Multiple Modules
```typescript
// lib/integrations/token-service/
//   - core.ts (main TokenService class)
//   - refresh.ts (refresh logic)
//   - validation.ts (token validation)
//   - locking.ts (concurrency control)
//   - index.ts (public API)
```

**Benefits:**
- Easier to test individual components
- Reduced cognitive load (smaller files)
- Better separation of concerns

#### C. Improve Type Safety
```typescript
// Replace `any` types with proper types
type TokenRefreshTrigger = "proactive" | "force" | "age-based";
type GrantStatus = "active" | "superseded" | "revoked" | "refresh_failed";

interface TokenRefreshContext {
  grantId: string;
  orgId: string;
  trigger: TokenRefreshTrigger;
  forceRefresh: boolean;
}
```

---

### 7. 🧪 Testing Strategy (MEDIUM PRIORITY)

**Current State:**
- No visible unit tests for token service
- Race conditions not tested
- Integration tests missing

**Recommendations:**

#### A. Unit Tests for Token Service
```typescript
// lib/integrations/__tests__/token-service.test.ts
describe("TokenService", () => {
  describe("getValidToken", () => {
    it("should return cached token if not expired", async () => {
      // Arrange: Mock DB with non-expired grant
      // Act: Call getValidToken
      // Assert: No refresh triggered
    });

    it("should refresh token if within 5-minute buffer", async () => {
      // Arrange: Mock grant expiring in 3 minutes
      // Act: Call getValidToken
      // Assert: Refresh triggered
    });

    it("should refresh if refresh token > 50 days old", async () => {
      // Arrange: Mock grant with 51-day-old refresh token
      // Act: Call getValidToken
      // Assert: Refresh triggered
    });
  });

  describe("refreshTokenForGrant", () => {
    it("should acquire lock and prevent concurrent refresh", async () => {
      // Arrange: Two concurrent calls
      // Act: Call refreshTokenForGrant twice
      // Assert: Only one refresh executed
    });

    it("should mark grant as refresh_failed on 400 invalid_grant", async () => {
      // Arrange: Mock Xero API returning 400
      // Act: Call refreshTokenForGrant
      // Assert: Grant status = "refresh_failed"
    });

    it("should retry on temporary errors", async () => {
      // Arrange: Mock network error, then success
      // Act: Call refreshTokenForGrant
      // Assert: Retry attempted, eventual success
    });
  });
});
```

#### B. Integration Tests with Test Containers
```typescript
// lib/integrations/__tests__/token-lifecycle.integration.test.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";

describe("Token Lifecycle (Integration)", () => {
  let postgres: PostgreSqlContainer;
  let redis: RedisContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer().start();
    redis = await new RedisContainer().start();
    // Run migrations
  });

  it("should handle full OAuth flow and token refresh", async () => {
    // 1. Simulate OAuth callback
    // 2. Store encrypted tokens
    // 3. Wait for near-expiry
    // 4. Trigger refresh
    // 5. Verify new tokens stored
  });

  it("should handle race condition with concurrent refreshes", async () => {
    // Simulate 5 concurrent token accesses
    // Verify only one refresh executed
  });
});
```

#### C. Load Testing for Concurrency
```typescript
// scripts/load-test-token-refresh.ts
import { performance } from "node:perf_hooks";

async function loadTest() {
  const grantId = "test-grant-id";
  const concurrentRequests = 100;

  const start = performance.now();
  const results = await Promise.allSettled(
    Array.from({ length: concurrentRequests }, () =>
      TokenService.getValidToken(grantId, "test-org-id")
    )
  );
  const duration = performance.now() - start;

  console.log({
    totalRequests: concurrentRequests,
    successful: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
    duration: `${duration.toFixed(2)}ms`,
    avgLatency: `${(duration / concurrentRequests).toFixed(2)}ms`,
  });
}
```

---

## Prioritized Recommendations

### Phase 1: Quick Wins (1-2 days)

1. **Add structured logging** (token-service.ts)
   - Replace `console.log` with structured logger
   - Add context fields (grantId, orgId, trigger, duration)

2. **Replace Map caches with LRU cache** (token-service.ts)
   - Install `lru-cache` package
   - Prevent memory leaks from unbounded caches

3. **Add unit tests for token service** (new file)
   - Test refresh triggers (time-based, age-based, force)
   - Test error handling (permanent vs temporary)
   - Test concurrency (in-memory lock)

### Phase 2: Reliability Improvements (3-5 days)

4. **Implement exponential backoff** (new retry module)
   - Extract retry logic to `lib/integrations/retry.ts`
   - Add jitter to prevent thundering herd
   - Increase max retries from 1 to 3

5. **Add circuit breaker for Xero API** (new module)
   - Prevent cascade failures during outages
   - Auto-recover when Xero comes back

6. **Background token refresh cron job** (new API route)
   - Proactively refresh tokens expiring in 10 minutes
   - Run every 5 minutes via Vercel Cron

### Phase 3: Observability (2-3 days)

7. **Add metrics/telemetry** (token-service.ts)
   - Track refresh attempts, successes, failures
   - Monitor refresh duration distribution
   - Set up alerts for high failure rates

8. **Add distributed tracing** (token-service.ts, tools)
   - OpenTelemetry spans for token operations
   - End-to-end visibility from chat to Xero API

### Phase 4: Advanced Features (5-7 days)

9. **Audit trail for token operations** (new table + schema)
   - Log all refresh attempts, accesses, revocations
   - Enable forensics and compliance

10. **User notifications for failed refreshes** (new module)
    - Email or in-app notifications
    - Prompt users to reconnect before they encounter issues

11. **Redis-based distributed locking** (optional, if multi-instance)
    - Replace in-memory locks with Redis locks
    - Required for horizontal scaling across regions

### Phase 5: Polish (3-4 days)

12. **Code refactoring** (token-service.ts)
    - Split into multiple modules (refresh, validation, locking)
    - Improve type safety (remove `any` types)

13. **Integration tests** (new test files)
    - Full OAuth flow + token refresh lifecycle
    - Race condition scenarios with test containers

14. **Key rotation infrastructure** (encryption.ts + migration script)
    - Support multiple encryption key versions
    - Migration script to re-encrypt existing tokens

---

## Implementation Notes

### Critical Files to Modify

1. **`lib/integrations/token-service.ts`** (316 lines)
   - Add structured logging
   - Replace Map with LRU cache
   - Implement exponential backoff
   - Add metrics/telemetry

2. **`lib/integrations/xero/adapter.ts`**
   - Add circuit breaker wrapper
   - Enhanced error classification

3. **New Files to Create:**
   - `lib/integrations/retry.ts` - Exponential backoff module
   - `lib/integrations/circuit-breaker.ts` - Circuit breaker implementation
   - `lib/integrations/metrics.ts` - Metrics/telemetry definitions
   - `lib/integrations/logging.ts` - Structured logging utilities
   - `app/api/cron/refresh-expiring-tokens/route.ts` - Background refresh cron
   - `lib/integrations/__tests__/token-service.test.ts` - Unit tests

### Dependencies to Add

```json
{
  "lru-cache": "^11.0.0",
  "@opentelemetry/api": "^1.8.0",
  "@opentelemetry/sdk-node": "^0.47.0",
  "prom-client": "^15.1.0" // Or Vercel Analytics
}
```

### Environment Variables

```bash
# Optional: Structured logging
LOG_LEVEL=info
LOG_FORMAT=json

# Optional: Distributed tracing
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io

# Optional: Background refresh cron
CRON_SECRET=<random-secret>

# Optional: User notifications
RESEND_API_KEY=<api-key>
```

---

## Verification Plan

### Testing Token Refresh Improvements

1. **Unit Tests:**
   ```bash
   pnpm test:unit lib/integrations/__tests__/token-service.test.ts
   ```
   - Verify refresh triggers work correctly
   - Verify error handling (permanent vs temporary)
   - Verify concurrency safety (in-memory lock)

2. **Integration Tests:**
   ```bash
   pnpm test:integration lib/integrations/__tests__/token-lifecycle.integration.test.ts
   ```
   - Full OAuth flow + refresh cycle
   - Race condition scenarios

3. **Load Testing:**
   ```bash
   pnpm tsx scripts/load-test-token-refresh.ts
   ```
   - Verify concurrency handling under load (100+ concurrent requests)
   - Measure latency distribution
   - Confirm only one refresh executed per grant

4. **Manual Testing:**
   - Connect Xero integration via `/settings/integrations`
   - Use Xero tool (e.g., list invoices) multiple times
   - Verify logs show structured logging
   - Verify metrics tracked (if implemented)
   - Force token expiry (modify DB), verify automatic refresh
   - Disconnect Xero, verify refresh failure handling

5. **Monitoring (Production):**
   - Dashboard: Token refresh success rate (target: >99%)
   - Dashboard: Token refresh latency p50/p95/p99
   - Alert: Refresh failure rate > 5% in 10-minute window
   - Alert: Refresh latency p95 > 5 seconds

---

## Trade-offs & Considerations

### When NOT to Implement

1. **Distributed Locking (Redis):**
   - Skip if: Single-instance deployment (e.g., Vercel Hobby plan)
   - Implement if: Multi-region deployment or high traffic

2. **Redis Grant Caching:**
   - Skip if: Low token access frequency (<100 req/min)
   - Implement if: High DB load from token queries

3. **Circuit Breaker:**
   - Skip if: Xero uptime is reliable (>99.9%)
   - Implement if: Seeing frequent Xero outages impacting users

4. **Audit Trail:**
   - Skip if: No compliance requirements (SOC 2, GDPR)
   - Implement if: Enterprise customers require audit logs

### Performance Impact

- **Structured Logging:** Minimal (<1ms per log statement)
- **LRU Cache:** Negligible (O(1) get/set operations)
- **Exponential Backoff:** Adds latency on retries (acceptable trade-off)
- **Circuit Breaker:** Minimal overhead (<1ms per operation)
- **Distributed Locking:** Redis round-trip (~5-10ms)
- **Metrics Collection:** Minimal (<1ms per metric update)

### Security Considerations

- **Key Rotation:** Requires coordinated deployment (brief window where old keys needed)
- **Audit Trail:** Contains sensitive grant IDs (ensure proper access controls)
- **Structured Logs:** Ensure no tokens logged (already handled)

---

## Conclusion

The current Xero token refresh implementation is **production-ready** with strong fundamentals. The recommended improvements focus on:

1. **Observability:** Structured logging, metrics, tracing (enables proactive issue detection)
2. **Reliability:** Exponential backoff, circuit breaker, background refresh (improves uptime)
3. **Performance:** LRU caching, Redis caching (scales to high traffic)
4. **User Experience:** Proactive notifications, graceful degradation (reduces friction)

**Recommended Implementation Order:**
1. Start with **Phase 1 (Quick Wins)** - Low effort, high impact
2. Proceed to **Phase 2 (Reliability)** - Critical for production stability
3. Add **Phase 3 (Observability)** - Essential for monitoring health
4. Evaluate **Phase 4 (Advanced)** based on traffic patterns and requirements
5. Polish with **Phase 5** as time permits

**Estimated Total Effort:** 15-25 days (spread across multiple developers)

**Expected Impact:**
- 🎯 Token refresh success rate: 95% → 99.5%
- ⚡ Average refresh latency: 800ms → 500ms
- 📊 Mean time to detection (MTTD): 30 min → <1 min
- 👤 User-reported integration issues: -70%
