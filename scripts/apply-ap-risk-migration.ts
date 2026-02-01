import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

if (!process.env.POSTGRES_URL) {
	console.error("❌ POSTGRES_URL not defined");
	process.exit(1);
}

const sql = neon(process.env.POSTGRES_URL);

async function applyMigration() {
	console.log("⏳ Applying AP Risk Scoring migration...");

	try {
		await sql`ALTER TABLE "xero_bills" ADD COLUMN IF NOT EXISTS "invoice_number" text`;
		console.log("✓ Added invoice_number to xero_bills");

		await sql`ALTER TABLE "xero_bills" ADD COLUMN IF NOT EXISTS "bill_bank_account_number" text`;
		console.log("✓ Added bill_bank_account_number to xero_bills");

		await sql`ALTER TABLE "xero_bills" ADD COLUMN IF NOT EXISTS "bill_bank_account_name" text`;
		console.log("✓ Added bill_bank_account_name to xero_bills");

		await sql`ALTER TABLE "xero_suppliers" ADD COLUMN IF NOT EXISTS "tax_number" text`;
		console.log("✓ Added tax_number to xero_suppliers");

		await sql`ALTER TABLE "xero_suppliers" ADD COLUMN IF NOT EXISTS "contact_status" varchar(50)`;
		console.log("✓ Added contact_status to xero_suppliers");

		await sql`ALTER TABLE "xero_suppliers" ADD COLUMN IF NOT EXISTS "bank_account_number" text`;
		console.log("✓ Added bank_account_number to xero_suppliers");

		await sql`ALTER TABLE "xero_suppliers" ADD COLUMN IF NOT EXISTS "bank_account_name" text`;
		console.log("✓ Added bank_account_name to xero_suppliers");

		await sql`CREATE INDEX IF NOT EXISTS "xero_bills_invoice_number_idx" ON "xero_bills" USING btree ("invoice_number")`;
		console.log("✓ Created index on invoice_number");

		await sql`CREATE INDEX IF NOT EXISTS "xero_suppliers_status_idx" ON "xero_suppliers" USING btree ("contact_status")`;
		console.log("✓ Created index on contact_status");

		console.log("✅ Migration completed successfully!");
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	}
}

applyMigration();
