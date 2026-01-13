-- Migration: Add UserSettings table for Intellisync context
-- This table stores user preferences for the Australian business assistant

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "companyName" varchar(256),
  "timezone" varchar(64) DEFAULT 'Australia/Sydney',
  "baseCurrency" varchar(3) DEFAULT 'AUD',
  "dateFormat" varchar(20) DEFAULT 'DD/MM/YYYY',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE("userId")
);

-- Create index for faster lookups by userId
CREATE INDEX IF NOT EXISTS "UserSettings_userId_idx" ON "UserSettings"("userId");
