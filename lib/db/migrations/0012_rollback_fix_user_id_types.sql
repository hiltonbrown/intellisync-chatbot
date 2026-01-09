-- ROLLBACK script for 0012_fix_user_id_types.sql
-- ================================================
--
-- WARNING: This rollback script will LOSE DATA for any Clerk-based users.
-- Only use this if:
--   1. The migration was just applied and no Clerk users have been created yet
--   2. You need to revert to UUID-based user IDs for some reason
--   3. You have a backup of the database
--
-- This script converts User.id and all userId foreign keys back from TEXT to UUID.
-- Any existing Clerk user IDs (format: "user_*") will FAIL to convert to UUID.
--
-- RECOMMENDED: Do not run this script unless absolutely necessary.

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

-- Step 2: Convert all userId foreign key columns from TEXT back to UUID
-- WARNING: This will FAIL if any TEXT values cannot be cast to UUID
ALTER TABLE "Chat" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
--> statement-breakpoint

ALTER TABLE "Document" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
--> statement-breakpoint

ALTER TABLE "Suggestion" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
--> statement-breakpoint

-- DocumentChunk.userId: Convert from TEXT to UUID if needed
-- Check your migration 0009 to determine if this was already TEXT
-- ALTER TABLE "DocumentChunk" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
--> statement-breakpoint

-- Step 3: Convert User.id from TEXT back to UUID
-- WARNING: This will FAIL if any TEXT values cannot be cast to UUID
ALTER TABLE "User" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
--> statement-breakpoint

-- Step 4: Restore default value for User.id (gen_random_uuid())
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint

-- Step 5: Recreate foreign key constraints with UUID types
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

-- IMPORTANT NOTES:
-- ================
-- 1. This rollback will FAIL if any Clerk user IDs exist (they cannot be cast to UUID)
-- 2. You will need to delete all Clerk-based users before running this rollback
-- 3. Consider using this query first to check for Clerk users:
--    SELECT id FROM "User" WHERE id LIKE 'user_%';
-- 4. If Clerk users exist, you must delete them and all their associated data first
-- 5. This is a destructive operation - ensure you have a database backup
