-- Fix User.id and all userId foreign keys from UUID to TEXT to support Clerk authentication
-- Clerk provides user IDs as TEXT strings (format: "user_xxxxxxxxxxxx"), not UUIDs
--
-- IMPORTANT: Data Migration Notes
-- ================================
-- This migration converts User.id from UUID to TEXT type to support Clerk authentication.
--
-- For NEW deployments (empty database):
--   - This migration will run without issues
--   - Users will be created with Clerk's text-based IDs
--
-- For EXISTING deployments with data:
--   - UUID values will be converted to their text representations
--   - WARNING: These converted UUIDs will NOT match Clerk's "user_*" format
--   - Existing users will need to re-authenticate after migration
--   - Consider running a data cleanup script to remove old UUID-based users
--   - Alternatively, create a mapping table if you need to preserve user associations
--
-- RECOMMENDED: Backup your database before running this migration!

-- Step 1: Drop all foreign key constraints that reference User.id
DO $$ BEGIN
  ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_userId_User_id_fk";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_userId_User_id_fk";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "Suggestion" DROP CONSTRAINT IF EXISTS "Suggestion_userId_User_id_fk";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "DocumentChunk" DROP CONSTRAINT IF EXISTS "DocumentChunk_userId_User_id_fk";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint

-- Step 2: Remove default value from User.id (gen_random_uuid() only works for UUID type)
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint

-- Step 3: Convert User.id from UUID to TEXT
ALTER TABLE "User" ALTER COLUMN "id" TYPE text USING "id"::text;
--> statement-breakpoint

-- Step 4: Convert all userId foreign key columns from UUID to TEXT
ALTER TABLE "Chat" ALTER COLUMN "userId" TYPE text USING "userId"::text;
--> statement-breakpoint

ALTER TABLE "Document" ALTER COLUMN "userId" TYPE text USING "userId"::text;
--> statement-breakpoint

ALTER TABLE "Suggestion" ALTER COLUMN "userId" TYPE text USING "userId"::text;
--> statement-breakpoint

-- DocumentChunk.userId is already TEXT from migration 0009, no change needed

-- Step 5: Recreate foreign key constraints with correct TEXT types
DO $$ BEGIN
  ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
