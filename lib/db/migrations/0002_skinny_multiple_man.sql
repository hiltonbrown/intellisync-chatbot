-- AP Risk Scoring Fields Migration
ALTER TABLE "xero_bills" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "xero_bills" ADD COLUMN "bill_bank_account_number" text;--> statement-breakpoint
ALTER TABLE "xero_bills" ADD COLUMN "bill_bank_account_name" text;--> statement-breakpoint
ALTER TABLE "xero_suppliers" ADD COLUMN "tax_number" text;--> statement-breakpoint
ALTER TABLE "xero_suppliers" ADD COLUMN "contact_status" varchar(50);--> statement-breakpoint
ALTER TABLE "xero_suppliers" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "xero_suppliers" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
CREATE INDEX "xero_bills_invoice_number_idx" ON "xero_bills" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "xero_suppliers_status_idx" ON "xero_suppliers" USING btree ("contact_status");