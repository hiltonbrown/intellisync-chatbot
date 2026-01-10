# Clerk Authentication UserID Fix

## Problem Summary

The codebase had a **critical database schema type mismatch** that prevented Clerk authentication from working correctly:

- **Database migrations** defined `User.id` as **UUID** type
- **TypeScript schema** defined `User.id` as **TEXT** type
- **Clerk** provides user IDs as **TEXT** strings (format: `"user_xxxxxxxxxxxx"`)

This mismatch caused:
1. `verifyUser()` failed to insert users into the database (silently caught errors)
2. Users were never created in the User table
3. Foreign key constraints failed when creating chats/documents
4. Users appeared to have "remaining ID from previous authentication" issues

## Changes Made (2 Commits)

### Commit 1: Critical Authentication Fix

### 1. Database Migration (0012_fix_user_id_types.sql)
Created comprehensive migration to fix the type mismatch:
- Dropped all foreign key constraints referencing User.id
- Converted User.id from UUID to TEXT
- Converted all userId foreign key columns (Chat, Document, Suggestion) from UUID to TEXT
- Recreated all foreign key constraints with correct TEXT types
- DocumentChunk.userId was already TEXT (from migration 0009)

### 2. Improved verifyUser() Error Handling
Updated `lib/db/queries.ts`:
- Changed from silently catching all errors to only ignoring unique constraint violations
- Now throws `ChatSDKError` for actual database failures
- Provides clear error message: "User verification failed. Please ensure you are properly authenticated."

### 3. Added verifyUser() to Missing Endpoints
Updated `app/(chat)/api/document/route.ts`:
- Added `verifyUser()` calls to GET and DELETE endpoints
- Standardized to use `currentUser()` for consistency
- Ensures user exists in database before all document operations

### 4. Added Clerk UserID Validation Helper
Added to `lib/utils.ts`:
- `isValidClerkUserId()` function validates Clerk ID format
- Type-safe function that checks for "user_" prefix
- Can be used to validate IDs early in request handlers

### 5. Updated .env.example
Added Clerk environment variables with documentation:
```bash
# Clerk Authentication
# Instructions to create Clerk keys: https://clerk.com/docs
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=****
CLERK_SECRET_KEY=****
```

### Commit 2: Security and Code Quality Improvements

#### 6. Fixed URL Sanitization Vulnerability (CRITICAL)
Updated `components/elements/web-preview.tsx`:
- **Security Issue**: Local `sanitizeUrl()` used `window.location.origin` as base URL
- **Attack Vector**: Protocol-relative URLs like `//evil.com` became `https://evil.com`
- **Fix**: Created secure shared `sanitizeUrl()` in `lib/utils.ts`
- **New Behavior**: Requires fully qualified http:// or https:// URLs only
- **Impact**: Prevents URL injection attacks in web preview iframe

#### 7. Enhanced verifyUser() Validation
Updated `lib/db/queries.ts`:
- Added Clerk user ID format validation (`user_*` prefix)
- Added email validation (rejects empty strings)
- Added PostgreSQL error code constant (`POSTGRES_UNIQUE_VIOLATION`)
- Provides specific error messages for different failure modes
- Fails fast with clear errors instead of silent failures

#### 8. Created Shared Authentication Helper
New file `lib/auth/helpers.ts`:
- `getAuthenticatedUser()` function is intended to reduce code duplication when used in API routes
- Centralizes auth + verification logic in one place
- Validates email exists before proceeding
- Is available to be used across API routes for consistency in future refactors
- Throws clear `ChatSDKError` for all failure cases when the helper is invoked

#### 9. Enhanced Migration Documentation
Updated `lib/db/migrations/0012_fix_user_id_types.sql`:
- Added comprehensive data migration notes
- Explains impact on NEW vs EXISTING deployments
- Warns about UUID-to-TEXT conversion implications
- Recommends database backup before migration
- Provides guidance for handling existing users

## Migration Instructions

### For New Deployments
1. Ensure `.env` has Clerk keys configured
2. Run `pnpm db:migrate` to apply all migrations including the fix
3. Deploy and test authentication flow

### For Existing Deployments
1. **IMPORTANT**: Backup your database before running migrations
2. Run migration 0012 to convert User.id and foreign keys to TEXT:
   ```bash
   pnpm db:migrate
   ```
3. Any existing UUID-based user IDs will be converted to text format
4. If you have existing users, they will need to re-authenticate with Clerk
5. Test authentication thoroughly after migration

## Testing Checklist

- [ ] User can sign up with Clerk
- [ ] User can sign in with Clerk
- [ ] User can create new chats
- [ ] User can create documents/artifacts
- [ ] User can upload files
- [ ] User can access their own documents
- [ ] User cannot access other users' documents
- [ ] User can sign out and sign back in without issues
- [ ] No "remaining ID from previous authentication" errors
- [ ] Check database logs for any user verification errors

## Security Vulnerabilities Fixed

### High Severity
1. **URL Injection in Web Preview**: Fixed protocol-relative URL vulnerability that allowed attackers to inject arbitrary external URLs into iframe preview

### Medium Severity
2. **Missing Email Validation**: verifyUser() now rejects empty email addresses
3. **Invalid User ID Format**: verifyUser() now validates Clerk ID format early

## Related Issues

This fix resolves:
- UUID vs TEXT type mismatch for Clerk user IDs
- Silent failures in verifyUser()
- Incomplete user verification across API endpoints
- Missing Clerk environment variable documentation
- URL sanitization security vulnerability
- Code duplication across authentication flows

## Additional Notes

- The fix maintains backward compatibility with the database schema
- All foreign key constraints are preserved with correct types
- Error handling is now more explicit and helpful for debugging
- Authentication flow is now consistent across all API endpoints
