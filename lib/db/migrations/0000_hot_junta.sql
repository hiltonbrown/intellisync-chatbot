CREATE TABLE "cashflow_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"xero_tenant_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"description" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'SUGGESTED',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" text NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Document" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"textContent" text,
	"summary" text,
	"blobUrl" text,
	"text" varchar DEFAULT 'text' NOT NULL,
	"userId" text NOT NULL,
	"chatId" uuid NOT NULL,
	CONSTRAINT "Document_id_createdAt_pk" PRIMARY KEY("id","createdAt")
);
--> statement-breakpoint
CREATE TABLE "DocumentChunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifactId" uuid NOT NULL,
	"userId" text NOT NULL,
	"chatId" uuid NOT NULL,
	"chunkIndex" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorised_by_clerk_user_id" text NOT NULL,
	"clerk_org_id" text NOT NULL,
	"provider" varchar(50) DEFAULT 'xero' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"refresh_token_issued_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "integration_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_binding_id" uuid NOT NULL,
	"data_type" varchar(50) NOT NULL,
	"cursor" text,
	"last_sync_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_sync_state_tenant_binding_id_unique" UNIQUE("tenant_binding_id")
);
--> statement-breakpoint
CREATE TABLE "integration_tenant_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"provider" varchar(50) DEFAULT 'xero' NOT NULL,
	"external_tenant_id" text NOT NULL,
	"external_tenant_name" text,
	"active_grant_id" uuid NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_tenant_bindings_provider_external_tenant_id_unique" UNIQUE("provider","external_tenant_id")
);
--> statement-breakpoint
CREATE TABLE "integration_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) DEFAULT 'xero' NOT NULL,
	"external_event_id" text NOT NULL,
	"payload" json NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_webhook_events_external_event_id_unique" UNIQUE("external_event_id")
);
--> statement-breakpoint
CREATE TABLE "Message_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"content" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Stream" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Stream_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "Suggestion" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentCreatedAt" timestamp NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Suggestion_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(64) NOT NULL,
	"systemPrompt" text
);
--> statement-breakpoint
CREATE TABLE "UserSettings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"companyName" varchar(256),
	"timezone" varchar(64) DEFAULT 'Australia/Brisbane',
	"baseCurrency" varchar(3) DEFAULT 'AUD',
	"dateFormat" varchar(20) DEFAULT 'DD/MM/YYYY',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserSettings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "Vote_v2" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_v2_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
CREATE TABLE "Vote" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
CREATE TABLE "xero_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"xero_tenant_id" text NOT NULL,
	"xero_bill_id" text NOT NULL,
	"supplier_id" uuid,
	"type" varchar(50),
	"status" varchar(50),
	"date" timestamp,
	"due_date" timestamp,
	"amount_due" numeric(19, 4),
	"amount_paid" numeric(19, 4),
	"total" numeric(19, 4),
	"currency_code" varchar(10),
	"line_items_summary" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xero_bills_xero_tenant_id_xero_bill_id_unique" UNIQUE("xero_tenant_id","xero_bill_id")
);
--> statement-breakpoint
CREATE TABLE "xero_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"xero_tenant_id" text NOT NULL,
	"xero_contact_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xero_contacts_xero_tenant_id_xero_contact_id_unique" UNIQUE("xero_tenant_id","xero_contact_id")
);
--> statement-breakpoint
CREATE TABLE "xero_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"xero_tenant_id" text NOT NULL,
	"xero_invoice_id" text NOT NULL,
	"contact_id" uuid,
	"type" varchar(50),
	"status" varchar(50),
	"date" timestamp,
	"due_date" timestamp,
	"amount_due" numeric(19, 4),
	"amount_paid" numeric(19, 4),
	"total" numeric(19, 4),
	"currency_code" varchar(10),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xero_invoices_xero_tenant_id_xero_invoice_id_unique" UNIQUE("xero_tenant_id","xero_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "xero_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"xero_tenant_id" text NOT NULL,
	"xero_contact_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xero_suppliers_xero_tenant_id_xero_contact_id_unique" UNIQUE("xero_tenant_id","xero_contact_id")
);
--> statement-breakpoint
CREATE TABLE "xero_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"xero_tenant_id" text NOT NULL,
	"xero_id" text NOT NULL,
	"type" varchar(50),
	"amount" numeric(19, 4),
	"date" timestamp,
	"description" text,
	"source" varchar(50),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "xero_transactions_xero_tenant_id_xero_id_unique" UNIQUE("xero_tenant_id","xero_id")
);
--> statement-breakpoint
ALTER TABLE "cashflow_adjustments" ADD CONSTRAINT "cashflow_adjustments_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_state" ADD CONSTRAINT "integration_sync_state_tenant_binding_id_integration_tenant_bindings_id_fk" FOREIGN KEY ("tenant_binding_id") REFERENCES "public"."integration_tenant_bindings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_tenant_bindings" ADD CONSTRAINT "integration_tenant_bindings_active_grant_id_integration_grants_id_fk" FOREIGN KEY ("active_grant_id") REFERENCES "public"."integration_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk" FOREIGN KEY ("documentId","documentCreatedAt") REFERENCES "public"."Document"("id","createdAt") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_bills" ADD CONSTRAINT "xero_bills_supplier_id_xero_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."xero_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_invoices" ADD CONSTRAINT "xero_invoices_contact_id_xero_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."xero_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cashflow_adjustments_tenant_date_idx" ON "cashflow_adjustments" USING btree ("xero_tenant_id","date");--> statement-breakpoint
CREATE INDEX "integration_grants_org_idx" ON "integration_grants" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "integration_grants_expiry_idx" ON "integration_grants" USING btree ("expires_at","status");--> statement-breakpoint
CREATE INDEX "integration_tenant_bindings_org_idx" ON "integration_tenant_bindings" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "integration_tenant_bindings_grant_status_idx" ON "integration_tenant_bindings" USING btree ("active_grant_id","status");--> statement-breakpoint
CREATE INDEX "xero_bills_tenant_idx" ON "xero_bills" USING btree ("xero_tenant_id");--> statement-breakpoint
CREATE INDEX "xero_bills_supplier_idx" ON "xero_bills" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "xero_bills_due_date_idx" ON "xero_bills" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "xero_contacts_tenant_idx" ON "xero_contacts" USING btree ("xero_tenant_id");--> statement-breakpoint
CREATE INDEX "xero_invoices_tenant_idx" ON "xero_invoices" USING btree ("xero_tenant_id");--> statement-breakpoint
CREATE INDEX "xero_invoices_contact_idx" ON "xero_invoices" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "xero_invoices_due_date_idx" ON "xero_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "xero_suppliers_tenant_idx" ON "xero_suppliers" USING btree ("xero_tenant_id");--> statement-breakpoint
CREATE INDEX "xero_transactions_tenant_idx" ON "xero_transactions" USING btree ("xero_tenant_id");--> statement-breakpoint
CREATE INDEX "xero_transactions_date_idx" ON "xero_transactions" USING btree ("date");