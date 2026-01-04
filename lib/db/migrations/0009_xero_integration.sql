CREATE TABLE IF NOT EXISTS "integration_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(32) NOT NULL,
  "clerk_org_id" text NOT NULL,
  "created_by_clerk_user_id" text NOT NULL,
  "external_account_id" text NOT NULL,
  "external_account_name" text,
  "access_token_encrypted" text NOT NULL,
  "refresh_token_encrypted" text NOT NULL,
  "expires_at_utc" timestamp NOT NULL,
  "scopes" text,
  "state" varchar(32) DEFAULT 'connected' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_connections_provider_external_account_unique" ON "integration_connections" ("provider", "external_account_id");

CREATE TABLE IF NOT EXISTS "integration_sync_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(32) NOT NULL,
  "tenant_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_sync_jobs_dedupe_unique" ON "integration_sync_jobs" ("provider", "tenant_id", "entity_type", "resource_id");

CREATE TABLE IF NOT EXISTS "xero_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "event_category" text NOT NULL,
  "event_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "event_date_utc" timestamp NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "xero_webhook_events_tenant_event_unique" ON "xero_webhook_events" ("tenant_id", "event_category", "event_type", "resource_id", "event_date_utc");

CREATE TABLE IF NOT EXISTS "xero_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "xero_resource_id" text NOT NULL,
  "data" json NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "xero_invoices_tenant_resource_unique" ON "xero_invoices" ("tenant_id", "xero_resource_id");

CREATE TABLE IF NOT EXISTS "xero_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "xero_resource_id" text NOT NULL,
  "data" json NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "xero_contacts_tenant_resource_unique" ON "xero_contacts" ("tenant_id", "xero_resource_id");

CREATE TABLE IF NOT EXISTS "xero_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "xero_resource_id" text NOT NULL,
  "data" json NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "xero_payments_tenant_resource_unique" ON "xero_payments" ("tenant_id", "xero_resource_id");
