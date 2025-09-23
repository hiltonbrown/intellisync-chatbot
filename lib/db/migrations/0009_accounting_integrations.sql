CREATE TABLE IF NOT EXISTS "AccountingIntegration" (
  "userId" varchar(255) NOT NULL,
  "provider" varchar(64) NOT NULL,
  "status" varchar(32) DEFAULT 'disconnected' NOT NULL,
  "connectedAt" timestamp,
  "lastSyncedAt" timestamp,
  "tokens" jsonb DEFAULT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "AccountingIntegration_userId_provider_pk" PRIMARY KEY ("userId", "provider")
);
