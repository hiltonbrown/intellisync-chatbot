# Alternative Xero Token Refresh Process

## Current System Analysis

**Current Implementation:**
- Token refresh is **on-demand** (just-in-time) triggered by AI tool execution
- The existing cron job (`/api/cron/process-queue`) is for **data sync**, NOT token refresh
- Tokens refresh automatically when:
  - Within 5 minutes of expiry during tool calls
  - After receiving 401 Unauthorized from Xero API
- Single-flight locking (PostgreSQL `FOR UPDATE`) prevents concurrent refresh races
- **No proactive/scheduled token refresh exists today**

**Current Files:**
- `lib/integrations/token-service.ts` - On-demand token refresh with single-flight locking
- `/app/api/cron/process-queue/route.ts` - Data sync queue processor (NOT token refresh)
- `lib/integrations/sync/queue.ts` - Redis queue for webhook-triggered sync jobs
- `lib/integrations/xero/adapter.ts` - OAuth token exchange and refresh API calls

**Key Limitations:**
1. Tokens only refresh when actively used (dormant integrations may expire)
2. No proactive refresh for tokens nearing expiry
3. No retry mechanism for failed refreshes
4. Redis queue is not durable (lost on restart)

---

## Proposed Alternative Approaches

### **Option 1: Database-Triggered Refresh (PostgreSQL Job Scheduler)**

**Architecture:**
- Use PostgreSQL's `pg_cron` extension or custom trigger-based system
- Database job runs every 15 minutes, queries for expiring tokens
- Calls Node.js webhook endpoint to perform refresh

**Implementation:**
```sql
-- Example pg_cron job
SELECT cron.schedule(
  'refresh-xero-tokens',
  '*/15 * * * *',  -- Every 15 minutes
  $$SELECT http_post(
    'https://yourdomain.com/api/internal/refresh-tokens',
    'application/json',
    '{"secret":"YOUR_INTERNAL_SECRET"}'
  )$$
);
```

**New Files:**
- `/app/api/internal/refresh-tokens/route.ts` - Internal endpoint called by database
- `lib/integrations/token-refresh-batch.ts` - Batch refresh logic

**Pros:**
- No external scheduler dependency
- Server-side execution (secure)
- Simple implementation

**Cons:**
- Requires `pg_cron` extension (may not work with managed databases like Neon)
- Couples token refresh to database infrastructure
- Limited error handling and observability

**Effort:** Low-Medium

---

### **Option 2: Background Worker Process**

**Architecture:**
- Separate Node.js worker process (Docker container or background service)
- Polls database every 10 minutes for tokens expiring within 15 minutes
- Refreshes tokens using `TokenService.refreshGrantSingleFlight()`

**Implementation:**
```typescript
// worker/token-refresh-worker.ts
while (true) {
  const expiringGrants = await db.query.integrationGrants.findMany({
    where: and(
      eq(integrationGrants.status, 'active'),
      lte(integrationGrants.expiresAt, new Date(Date.now() + 15 * 60 * 1000))
    )
  });

  for (const grant of expiringGrants) {
    await TokenService.refreshGrantSingleFlight(grant.id);
  }

  await sleep(10 * 60 * 1000); // 10 minutes
}
```

**New Files:**
- `worker/token-refresh-worker.ts` - Standalone worker process
- `worker/Dockerfile` - Container definition for worker
- `scripts/start-worker.sh` - Worker startup script

**Pros:**
- Independent of web server lifecycle
- Easy to scale horizontally (multiple workers use single-flight locking)
- Can add sophisticated retry logic and metrics
- Works with any database provider

**Cons:**
- Additional infrastructure to manage
- Requires process orchestration (Docker, systemd, etc.)
- More complex deployment

**Effort:** Medium

---

### **Option 3: Event-Driven with PostgreSQL NOTIFY/LISTEN**

**Architecture:**
- PostgreSQL trigger on `integration_grants` table emits `NOTIFY` when token near expiry
- Background listener process receives notifications
- Immediately triggers refresh for that specific token

**Implementation:**
```sql
-- PostgreSQL trigger function
CREATE OR REPLACE FUNCTION notify_token_expiring()
RETURNS trigger AS $$
BEGIN
  IF NEW.expires_at <= NOW() + INTERVAL '15 minutes' AND NEW.status = 'active' THEN
    PERFORM pg_notify('token_expiring', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER token_expiring_trigger
AFTER UPDATE ON integration_grants
FOR EACH ROW EXECUTE FUNCTION notify_token_expiring();
```

```typescript
// listener/token-notify-listener.ts
const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();
await client.query('LISTEN token_expiring');

client.on('notification', async (msg) => {
  if (msg.channel === 'token_expiring') {
    await TokenService.refreshGrantSingleFlight(msg.payload);
  }
});
```

**New Files:**
- `listener/token-notify-listener.ts` - Persistent NOTIFY listener
- `lib/db/migrations/0xxx_token_expiry_trigger.sql` - Trigger migration

**Pros:**
- Real-time refresh (no polling delay)
- Efficient (only refreshes when needed)
- Elegant event-driven architecture

**Cons:**
- Requires persistent database connection
- Complex error recovery (connection drops, missed notifications)
- Limited support in serverless environments
- Trigger maintenance overhead

**Effort:** High

---

### **Option 4: Enhanced Dedicated Cron Endpoint**

**Architecture:**
- New dedicated endpoint `/api/cron/refresh-tokens/route.ts`
- External scheduler (Vercel Cron, AWS EventBridge, GitHub Actions) calls every 10 minutes
- Queries for tokens expiring within 15 minutes
- Batch refreshes with concurrency control

**Implementation:**
```typescript
// /app/api/cron/refresh-tokens/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Find expiring tokens
  const expiringGrants = await db.query.integrationGrants.findMany({
    where: and(
      eq(integrationGrants.status, 'active'),
      lte(
        integrationGrants.expiresAt,
        new Date(Date.now() + 15 * 60 * 1000)
      )
    ),
    limit: 50 // Process max 50 per run
  });

  // Refresh in parallel with concurrency limit
  const results = await Promise.allSettled(
    expiringGrants.map(grant =>
      TokenService.refreshGrantSingleFlight(grant.id)
    )
  );

  return Response.json({
    total: expiringGrants.length,
    success: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length
  });
}
```

**Vercel Cron Configuration:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/refresh-tokens",
    "schedule": "*/10 * * * *"  // Every 10 minutes
  }]
}
```

**New Files:**
- `/app/api/cron/refresh-tokens/route.ts` - Dedicated refresh endpoint
- Update `vercel.json` - Add cron configuration

**Pros:**
- Simple, familiar pattern (similar to existing sync cron)
- Uses existing infrastructure
- Works in serverless environments
- Easy to test and monitor
- Platform-agnostic (works with any cron service)

**Cons:**
- Still relies on external scheduler
- Cold start latency in serverless
- Limited to cron schedule granularity

**Effort:** Low

---

### **Option 5: Queue-Based with BullMQ/Inngest**

**Architecture:**
- Add token refresh jobs to durable queue (BullMQ or Inngest)
- Jobs scheduled with delay matching token expiry
- Worker processes queue continuously with retries

**Implementation:**
```typescript
// Using Inngest (serverless job queue)
import { Inngest } from 'inngest';

const inngest = new Inngest({ name: 'IntelliSync' });

// Function to schedule refresh
export const scheduleTokenRefresh = inngest.createFunction(
  { name: 'Schedule Token Refresh' },
  { event: 'xero/token.created' },
  async ({ event, step }) => {
    const { grantId, expiresAt } = event.data;

    // Schedule refresh 10 minutes before expiry
    await step.sleepUntil('wait-until-refresh',
      new Date(expiresAt.getTime() - 10 * 60 * 1000)
    );

    await step.run('refresh-token', async () => {
      await TokenService.refreshGrantSingleFlight(grantId);
    });
  }
);

// Trigger when token is created/refreshed
await inngest.send({
  name: 'xero/token.created',
  data: { grantId: newGrant.id, expiresAt: newGrant.expiresAt }
});
```

**New Files:**
- `lib/integrations/jobs/token-refresh.ts` - Job definitions
- `inngest.config.ts` or `bullmq.config.ts` - Queue configuration
- `/app/api/inngest/route.ts` - Inngest webhook endpoint (if using Inngest)

**Pros:**
- Durable (jobs persist across restarts)
- Built-in retries and error handling
- Distributed execution support
- Excellent observability (job dashboards)
- Precise timing (refresh exactly when needed)

**Cons:**
- Additional service dependency (BullMQ requires Redis, Inngest is third-party SaaS)
- Increased complexity
- Cost (Inngest has pricing tiers, BullMQ infrastructure costs)
- Need to trigger job creation on every token refresh

**Effort:** Medium-High

---

### **Option 6: Hybrid Approach (Recommended)**

**Architecture:**
- **Primary**: Keep existing on-demand refresh (during tool execution)
- **Safety Net**: Add lightweight scheduled job for proactive refresh
- Scheduled job only catches "dormant" integrations that haven't been used

**Implementation:**
```typescript
// /app/api/cron/refresh-tokens/route.ts (runs every 30 minutes)
export async function GET(request: Request) {
  // Find tokens:
  // 1. Expiring within 20 minutes
  // 2. Not used in last 24 hours (dormant integrations)
  const dormantExpiringGrants = await db.query.integrationGrants.findMany({
    where: and(
      eq(integrationGrants.status, 'active'),
      lte(integrationGrants.expiresAt, new Date(Date.now() + 20 * 60 * 1000)),
      or(
        isNull(integrationGrants.lastUsedAt),
        lte(integrationGrants.lastUsedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    )
  });

  // Refresh only dormant tokens (active ones refresh on-demand)
  const results = await Promise.allSettled(
    dormantExpiringGrants.map(grant =>
      TokenService.refreshGrantSingleFlight(grant.id)
    )
  );

  return Response.json({
    dormantTokensRefreshed: results.filter(r => r.status === 'fulfilled').length
  });
}
```

**Modified Files:**
- Create `/app/api/cron/refresh-tokens/route.ts` - Safety net refresh
- Update `lib/db/schema.ts` - Ensure `lastUsedAt` is tracked in `integration_grants`
- Update `lib/integrations/token-service.ts` - Update `lastUsedAt` when token is used
- Update `vercel.json` - Add cron schedule (every 30 minutes)

**Pros:**
- Minimal changes to existing architecture
- Best of both worlds (on-demand + proactive)
- Low overhead (only refreshes dormant tokens)
- No new infrastructure dependencies
- Backwards compatible

**Cons:**
- Still uses external scheduler (but less critical)
- Slight complexity increase

**Effort:** Low

---

## Comparison Matrix

| Approach | Complexity | Infrastructure | Reliability | Cost | Recommended For |
|----------|-----------|----------------|-------------|------|----------------|
| **Database-Triggered** | Low | Database extension | Medium | Low | Single-server deployments |
| **Background Worker** | Medium | Docker/Process | High | Medium | Large-scale, multi-tenant |
| **Event-Driven (NOTIFY)** | High | Persistent connection | Medium | Low | Real-time requirements |
| **Enhanced Cron** | Low | External scheduler | High | Low | Serverless, simple setups |
| **Queue-Based (BullMQ/Inngest)** | High | Queue service | Very High | Medium-High | Enterprise, mission-critical |
| **Hybrid (Recommended)** | Low | External scheduler | High | Low | Most use cases |

---

## Recommended Implementation: On-Demand Only (Current System Enhanced)

**Based on your requirements:**
- ✅ Infrastructure complexity concern → Keep it simple
- ✅ Dormant tokens can expire → On-demand is acceptable
- ✅ Large scale (500+ orgs) → Current system already scales well
- ✅ Redis available → Can add optional monitoring/queue features later

**Why the current on-demand approach is already optimal:**
1. **No external scheduler dependency**: Tokens refresh automatically when used by AI tools
2. **Simple architecture**: No cron jobs, no background workers, no additional infrastructure
3. **Scales naturally**: Each org's tokens refresh independently when needed
4. **Battle-tested**: Single-flight locking prevents race conditions
5. **Cost-effective**: Only refreshes when tokens are actually used (no unnecessary API calls)
6. **Reliable**: 401 errors trigger automatic retry with force refresh

**The "cron job" you mentioned is NOT for token refresh:**
- `/api/cron/process-queue` is for **data sync queue processing** (webhook events)
- It does NOT proactively refresh tokens
- Token refresh happens **on-demand** within `TokenService.getClientForTenantBinding()`

**Recommended action: No changes needed, but optional enhancements below**

---

## Optional Enhancement 1: Token Refresh Monitoring Dashboard

**If you want better visibility into token refresh health at scale:**

**Implementation:**
1. Add metrics tracking to `TokenService.refreshGrantSingleFlight()`:
   ```typescript
   // After successful refresh
   await logMetric({
     event: 'token_refresh_success',
     grantId,
     orgId,
     provider: 'xero',
     timeSinceExpiry: expiresAt.getTime() - Date.now(),
     duration: refreshDuration
   });
   ```

2. Create monitoring endpoint `/api/internal/token-health/route.ts`:
   ```typescript
   // Returns health metrics for all active grants
   {
     totalGrants: 523,
     expiringWithin1Hour: 12,
     expiringWithin1Day: 45,
     failedRefreshes: 2,
     needsReauth: 1
   }
   ```

3. Optional: Integrate with Vercel Analytics, Datadog, or custom dashboard

**Files:**
- `lib/integrations/metrics.ts` (NEW) - Metrics logging
- `/app/api/internal/token-health/route.ts` (NEW) - Health endpoint
- `lib/integrations/token-service.ts` (MODIFY) - Add metric calls

**Benefit:** Proactive monitoring at scale without changing core architecture

---

## Optional Enhancement 2: Graceful Degradation Improvements

**If you want better UX when tokens expire:**

**Current behavior:**
- Token expires → AI tool call fails → Returns error to user
- User must manually reconnect Xero

**Enhanced behavior:**
1. Detect `needs_reauth` status in AI tools
2. Return user-friendly message: "Your Xero connection needs to be refreshed. Please reconnect at /settings/integrations"
3. Add webhook to Clerk to notify org admins when integration needs reauth

**Files:**
- `lib/ai/tools/list-xero-*.ts` (MODIFY) - Enhance error messages
- `/app/api/webhooks/clerk/route.ts` (NEW) - Clerk webhook handler for org admin notifications
- `lib/integrations/notifications.ts` (NEW) - Email/notification service

**Benefit:** Better user experience when refresh failures occur

---

## Alternative Implementation (If You Want to Remove Cron Entirely)

**If you still want to eliminate the `/api/cron/process-queue` endpoint for webhook processing:**

### Recommended: Vercel Queue (Beta) or Inngest

**Architecture:**
- Replace Redis FIFO queue with durable job queue
- Webhook events trigger background jobs directly
- No cron scheduler needed

**Implementation with Inngest (simpler, managed service):**

1. Install Inngest:
   ```bash
   pnpm add inngest
   ```

2. Replace webhook enqueueing in `/api/webhooks/xero/route.ts`:
   ```typescript
   // OLD: SyncQueue.enqueue(job)
   // NEW:
   await inngest.send({
     name: 'xero/webhook.received',
     data: {
       tenantBindingId: binding.id,
       eventId: externalEventId,
       resourceType: event.eventCategory
     }
   });
   ```

3. Create Inngest function `inngest/xero-sync.ts`:
   ```typescript
   export const xeroWebhookSync = inngest.createFunction(
     { name: 'Xero Webhook Sync', retries: 3 },
     { event: 'xero/webhook.received' },
     async ({ event, step }) => {
       const { tenantBindingId } = event.data;

       // Automatic token refresh via TokenService
       await step.run('sync-data', async () => {
         await SyncWorker.runTenantSyncOnce(tenantBindingId);
       });
     }
   );
   ```

4. Remove `/api/cron/process-queue/route.ts` entirely

**Files:**
- `inngest/xero-sync.ts` (NEW) - Inngest function definition
- `inngest/client.ts` (NEW) - Inngest client config
- `/app/api/inngest/route.ts` (NEW) - Inngest webhook endpoint
- `/app/api/webhooks/xero/route.ts` (MODIFY) - Replace Redis queue with Inngest
- `/app/api/cron/process-queue/route.ts` (DELETE) - No longer needed
- `lib/integrations/sync/queue.ts` (DELETE or DEPRECATE) - Redis queue no longer needed

**Trade-offs:**
- ✅ No cron dependency
- ✅ Durable jobs (survive restarts)
- ✅ Built-in retries
- ✅ Better observability (Inngest dashboard)
- ❌ Third-party service dependency (Inngest)
- ❌ Additional cost (free tier: 1M events/month, then $20/month)

**Alternative: Vercel Queue (Beta, Vercel-only)**
- Similar to Inngest but Vercel-native
- Currently in beta, limited availability
- Tighter integration with Vercel infrastructure

---

## Summary of Recommendations

**Primary recommendation: Keep current on-demand token refresh (no changes)**

**Reasoning:**
1. Your current system already handles token refresh correctly via on-demand pattern
2. The cron job you mentioned (`/api/cron/process-queue`) is for data sync, NOT token refresh
3. On-demand refresh scales to 500+ orgs without additional infrastructure
4. You're okay with dormant tokens expiring (on-demand is acceptable)
5. Reduces infrastructure complexity (your stated concern)

**Optional enhancements (if needed):**
- **Enhancement 1**: Add monitoring dashboard for 500+ orgs
- **Enhancement 2**: Improve UX for expired tokens
- **Alternative**: Replace webhook sync cron with Inngest/Vercel Queue (eliminates cron entirely)

**What needs clarification:**
If you still want to change the token refresh mechanism (despite current system being optimal for your needs), please clarify:
1. What specific problem are you trying to solve with token refresh?
2. Is the issue actually with webhook sync processing, not token refresh?
3. Are you seeing token refresh failures in production?

---

## Verification Plan

**Testing Current On-Demand Token Refresh (No Changes Needed):**

1. **Verify automatic refresh on tool execution:**
   - Connect Xero integration via `/settings/integrations`
   - Manually expire the access token in database:
     ```sql
     UPDATE integration_grants
     SET expires_at = NOW() + INTERVAL '3 minutes'
     WHERE id = 'your-grant-id';
     ```
   - Ask AI: "List my recent invoices from Xero"
   - Expected: Token automatically refreshes before API call
   - Verify in logs: See token refresh event
   - Verify in database: `expiresAt` updated to ~30 minutes from now

2. **Verify 401 retry mechanism:**
   - Manually invalidate token by setting `accessTokenEnc` to garbage value
   - Ask AI: "Show me my Xero organization details"
   - Expected: First call fails with 401, automatic force refresh, retry succeeds
   - Verify in logs: See 401 error → force refresh → retry flow

3. **Verify single-flight locking:**
   - Use database transaction to manually hold lock:
     ```sql
     BEGIN;
     SELECT * FROM integration_grants WHERE id = 'your-grant-id' FOR UPDATE;
     -- Leave transaction open
     ```
   - In another session, trigger AI tool that needs token
   - Expected: Second request waits for lock, then uses already-refreshed token
   - Complete first transaction
   - Verify: Only one refresh occurred (check `updatedAt` timestamp)

4. **Verify refresh failure handling:**
   - Disconnect Xero integration (revokes tokens server-side)
   - Try to use AI tool that needs Xero data
   - Expected: Token refresh fails, grant marked `refresh_failed`, binding marked `needs_reauth`
   - Verify error message suggests reconnecting at `/settings/integrations`

**Testing Optional Enhancement 1 (Monitoring Dashboard):**

If implementing the monitoring endpoint:

1. **Verify health metrics endpoint:**
   - Call `/api/internal/token-health` with internal auth
   - Expected response:
     ```json
     {
       "totalGrants": 5,
       "expiringWithin1Hour": 1,
       "expiringWithin1Day": 2,
       "failedRefreshes": 0,
       "needsReauth": 0
     }
     ```
   - Manually expire some tokens and verify counts update

2. **Verify metrics logging:**
   - Trigger token refresh via AI tool
   - Check logs for structured metric event:
     ```json
     {
       "event": "token_refresh_success",
       "grantId": "...",
       "orgId": "...",
       "provider": "xero",
       "duration": 234
     }
     ```

**Testing Alternative Implementation (Inngest for Webhook Sync):**

If replacing cron with Inngest:

1. **Verify webhook triggers job:**
   - Trigger Xero webhook (create test invoice in Xero)
   - Verify job appears in Inngest dashboard
   - Verify job executes sync worker
   - Check logs for sync completion

2. **Verify retry on failure:**
   - Introduce temporary error in sync worker
   - Trigger webhook
   - Verify Inngest retries job 3 times
   - Verify error logged in Inngest dashboard

3. **Verify no duplicate processing:**
   - Send same webhook event twice (same `externalEventId`)
   - Verify only one job created (deduplication works)
   - Check `integration_webhook_events` table for single entry

---

## Implementation Checklist

**For Current System (No Changes):**
- [ ] Verify on-demand refresh works in production
- [ ] Monitor logs for token refresh failures
- [ ] Document token refresh flow for team

**For Optional Enhancement 1 (Monitoring):**
- [ ] Create `lib/integrations/metrics.ts` with logging functions
- [ ] Add metric calls to `TokenService.refreshGrantSingleFlight()`
- [ ] Create `/app/api/internal/token-health/route.ts` endpoint
- [ ] Add internal auth using `INTERNAL_API_SECRET` env var
- [ ] Test health endpoint returns correct counts
- [ ] Set up alerting for failed refreshes (optional)

**For Optional Enhancement 2 (Better UX):**
- [ ] Update all Xero tool error handlers to detect `needs_reauth`
- [ ] Create user-friendly error messages with reconnect link
- [ ] Test error message appears in chat UI
- [ ] Optional: Set up Clerk webhook for org admin notifications

**For Alternative Implementation (Inngest):**
- [ ] Install Inngest: `pnpm add inngest`
- [ ] Create `inngest/client.ts` with Inngest config
- [ ] Create `inngest/xero-sync.ts` function
- [ ] Create `/app/api/inngest/route.ts` webhook endpoint
- [ ] Update `/app/api/webhooks/xero/route.ts` to use Inngest
- [ ] Test webhook → Inngest → sync flow end-to-end
- [ ] Deploy Inngest function to production
- [ ] Remove `/api/cron/process-queue/route.ts` and cron config
- [ ] Verify Redis queue is no longer used (optional: deprecate `lib/integrations/sync/queue.ts`)

---

## Next Steps

Based on the plan review, please confirm which approach you'd like to implement:

1. **Keep current system** (no changes, just verify it works correctly)
2. **Add monitoring dashboard** (Enhancement 1 for better observability at scale)
3. **Improve error UX** (Enhancement 2 for better user experience on failures)
4. **Replace cron with Inngest** (Alternative implementation to eliminate cron dependency)
5. **Combination** (e.g., monitoring + Inngest for both observability and no-cron architecture)

Or if you have a different concern about token refresh that wasn't addressed, please clarify so I can adjust the plan.
