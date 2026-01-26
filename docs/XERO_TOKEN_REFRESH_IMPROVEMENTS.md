# Xero Token Refresh System - Comprehensive Improvements

## Overview

This document describes the comprehensive improvements made to the Xero token refresh system to eliminate user-facing disconnections and ensure seamless integration experience.

## Problem Statement

Users were experiencing frequent disconnections from Xero requiring manual reconnection, particularly:
- After logging in after being away
- After idle periods
- When opening new or existing chat pages
- During long chat sessions

The original system was **reactive** - tokens were only checked and refreshed when Xero tools were called, leading to expired token errors before the refresh could occur.

## Solution Architecture

The improved system uses a **multi-layered proactive approach** to ensure tokens are always fresh:

### 1. Token Service Improvements

**File**: `lib/integrations/token-service.ts`

#### Changes:

1. **Increased Refresh Buffer** (Line 18)
   - Changed from 5 minutes to 10 minutes before expiry
   - Provides safer margin for network delays and processing time
   - Ensures tokens are refreshed well before expiration

2. **More Aggressive Refresh Token Rotation** (Line 71)
   - Changed from 50 days to 45 days threshold
   - Xero refresh tokens expire after 60 days if not used
   - More conservative threshold prevents hitting the 60-day limit
   - Ensures rolling refresh token expiry is properly maintained

3. **New Proactive Refresh Method** (Lines 27-126)
   - `proactiveRefreshForOrg(orgId)` - New method for background token checks
   - Checks all active Xero bindings for an organization
   - Refreshes tokens that are near expiry or have old refresh tokens
   - Returns detailed status and error information
   - Safe to call frequently - has built-in throttling

4. **Last Used Tracking** (Lines 205-211, 227-233)
   - Updates `lastUsedAt` timestamp whenever tokens are actually used
   - Fire-and-forget pattern (non-blocking)
   - Enables monitoring and debugging of token usage patterns
   - Helps identify inactive integrations

### 2. Proactive Refresh API Endpoint

**File**: `app/api/integrations/xero/refresh/route.ts` (NEW)

#### Features:

- **Endpoint**: `POST /api/integrations/xero/refresh`
- Calls `TokenService.proactiveRefreshForOrg()` for current organization
- Returns connection status, refresh count, and any errors
- Safe to call frequently - leverages service-level throttling
- Handles missing organization context gracefully
- Non-blocking - doesn't delay page rendering

#### Response Format:

```json
{
  "success": true,
  "hasActiveBindings": true,
  "refreshedCount": 1,
  "errors": [],
  "message": "Token refresh check completed successfully"
}
```

### 3. React Hook for Client-Side Integration

**File**: `hooks/use-xero-token-refresh.ts` (NEW)

#### Features:

1. **Auto-refresh on Mount** (Lines 122-128)
   - Automatically triggers token refresh when component mounts
   - Uses ref to prevent double-refresh in React strict mode
   - Non-blocking - runs in background

2. **Periodic Background Refresh** (Lines 130-156)
   - Refreshes tokens every 5 minutes while user is active
   - Ensures tokens stay fresh during long chat sessions
   - Automatically cleans up interval on unmount

3. **Throttling** (Lines 62-68)
   - Prevents excessive API calls (30-second minimum between refreshes)
   - Safe to call from multiple components

4. **Error Handling**
   - Captures and reports errors without disrupting user experience
   - Provides callbacks for success/error scenarios
   - Maintains error state for debugging

#### Usage Example:

```tsx
function ChatPage() {
  const { isRefreshing, error, refresh } = useXeroTokenRefresh({
    autoRefresh: true,
    enableBackgroundRefresh: true,
    onError: (error) => {
      console.warn('Token refresh failed:', error);
    }
  });

  return <Chat />;
}
```

### 4. Integration into Chat Component

**File**: `components/chat.tsx`

#### Changes:

1. **Import Hook** (Line 23)
   ```tsx
   import { useXeroTokenRefresh } from "@/hooks/use-xero-token-refresh";
   ```

2. **Use Hook** (Lines 60-68)
   ```tsx
   useXeroTokenRefresh({
     autoRefresh: true,
     onError: (error) => {
       console.warn("[Chat] Xero token refresh failed:", error.message);
     },
   });
   ```

#### Result:

- **Every chat page load** (new or existing) triggers token refresh
- Tokens are checked and refreshed proactively before user tries to use Xero tools
- Background refresh keeps tokens fresh during long sessions
- Silent operation - doesn't disrupt user experience

## Token Refresh Flow

### Before (Reactive):

```
User opens chat → User asks Xero question → AI calls tool →
Tool requests token → Token expired → 401 error → Force refresh →
Retry → May fail if refresh token also expired
```

### After (Proactive):

```
User opens chat → Background token refresh triggered →
Tokens checked and refreshed if needed → User asks Xero question →
AI calls tool → Fresh token ready → Success ✓

[Every 5 minutes: Background refresh keeps tokens fresh]
```

## Xero Best Practices Compliance

The implementation follows Xero's OAuth 2.0 best practices:

1. **Always use the latest refresh token** ✓
   - Each refresh returns new access + refresh tokens
   - Both are stored and old ones are never reused

2. **Never reuse old refresh tokens** ✓
   - Single-flight refresh prevents concurrent refresh attempts
   - Row-level locking ensures only one refresh per grant
   - Old refresh tokens are superseded, not reused

3. **Refresh tokens expire after 60 days if unused** ✓
   - Proactive refresh at 45 days (was 50 days)
   - Ensures rolling expiry is maintained
   - Prevents hitting the 60-day hard limit

4. **Access tokens expire after 30 minutes** ✓
   - Proactive refresh at 10 minutes before expiry (was 5 minutes)
   - Multiple safety layers prevent expiry during use

5. **Handle token rotation properly** ✓
   - Uses JWT `exp` claim as authoritative source
   - Tracks `refreshTokenIssuedAt` for age-based refresh
   - Updates both tokens atomically in transaction

## Monitoring and Debugging

### Logging

Comprehensive logging throughout the system:

- **Token Service**: Logs all refresh attempts, successes, and failures
- **API Endpoint**: Logs all proactive refresh operations
- **React Hook**: Logs mount, refresh, and background operations
- **Tool Usage**: Tracks when tokens are actually used via `lastUsedAt`

### Key Metrics

The system tracks:

1. `expiresAt` - When current access token expires
2. `refreshTokenIssuedAt` - When refresh token was last rotated
3. `lastUsedAt` - When token was last used by a tool
4. `updatedAt` - When grant was last modified
5. Token refresh count and error rate (via logs)

### Database Fields

The `integration_grants` table tracks:
- `status` - active | superseded | revoked | refresh_failed
- `expiresAt` - Access token expiration (from JWT claim)
- `refreshTokenIssuedAt` - Refresh token issue date
- `lastUsedAt` - Last time token was used by tool
- `updatedAt` - Last grant modification

## Testing Recommendations

### Manual Testing:

1. **Fresh Login**
   - Clear tokens, log in, open chat
   - Verify background refresh happens
   - Check console for refresh logs

2. **Idle Session**
   - Leave chat open for 15+ minutes
   - Verify background refresh every 5 minutes
   - Use Xero tool - should work without errors

3. **Long Session**
   - Keep chat open for 1+ hours
   - Verify periodic refreshes
   - Check token expiry doesn't cause issues

4. **Multiple Tabs**
   - Open chat in multiple tabs
   - Verify throttling prevents excessive refreshes
   - Check all tabs can use Xero tools

### Automated Testing:

Consider adding:
- Unit tests for `TokenService.proactiveRefreshForOrg()`
- Integration tests for refresh API endpoint
- E2E tests for chat page token refresh

## Performance Impact

### Minimal:

1. **Initial Page Load**
   - Adds one API call (proactive refresh)
   - Runs in background (non-blocking)
   - Only hits DB for orgs with Xero connected

2. **Background Refresh**
   - Runs every 5 minutes (very low frequency)
   - Has 30-second throttle to prevent spam
   - No-op if tokens are fresh

3. **Memory**
   - In-memory lock map (negligible)
   - Last refresh timestamp map (negligible)

## Security Considerations

1. **Token Encryption** ✓
   - All tokens encrypted at rest (AES-256-GCM)
   - No plaintext tokens in database

2. **Organization Context** ✓
   - All operations scoped to user's organization
   - No cross-organization token access

3. **Error Handling** ✓
   - Errors logged but don't expose sensitive data
   - Failed refreshes don't block system

4. **Rate Limiting** ✓
   - Throttling prevents excessive refresh attempts
   - Single-flight pattern prevents concurrent refreshes

## Migration Path

### Existing Users:

No migration needed - improvements are backward compatible:
- Existing tokens continue to work
- Refresh logic enhanced but compatible
- New fields (`lastUsedAt`) are optional
- Old grants work with new refresh logic

### New Users:

- Get full benefit of proactive refresh from first connection
- No manual reconnection needed during normal usage

## Future Enhancements

Potential improvements:

1. **User Notifications**
   - Toast notification when refresh fails
   - Settings page status indicator
   - Connection health dashboard

2. **Retry Logic**
   - Exponential backoff for transient failures
   - Auto-reconnect flow for expired refresh tokens

3. **Metrics Dashboard**
   - Token refresh success rate
   - Average token lifetime
   - Integration health score

4. **Preemptive Expiry Detection**
   - Alert admins before refresh tokens approach 60 days
   - Suggest reconnection before hard expiry

## Summary

The improved Xero token refresh system provides:

✅ **Proactive refresh** - Tokens checked on every page load
✅ **Background refresh** - Periodic checks during active sessions
✅ **Better timing** - 10-minute buffer + 45-day refresh token threshold
✅ **Comprehensive logging** - Full visibility into token lifecycle
✅ **Xero best practices** - Proper token rotation and expiry handling
✅ **Seamless UX** - No manual reconnection needed in normal usage
✅ **Performance** - Minimal overhead, non-blocking operations
✅ **Security** - Encrypted tokens, org-scoped access, proper error handling

**Result**: Users should never need to manually reconnect Xero unless there's an actual authorization issue (revoked tokens, expired refresh tokens beyond 60 days, etc.).
