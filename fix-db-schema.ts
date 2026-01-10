import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

if (!process.env.POSTGRES_URL) {
	console.error("POSTGRES_URL is not set");
	process.exit(1);
}

const sql_client = postgres(process.env.POSTGRES_URL);

async function fixSchema() {
	console.log("Checking Document table row count...");
	const countResult = await sql_client`SELECT count(*) FROM "Document"`;
	const count = parseInt(countResult[0].count);
	console.log(`Row count: ${count}`);

	console.log("Adding chatId column...");
	try {
		// If table is empty, we can add NOT NULL
		if (count === 0) {
			await sql_client`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "chatId" uuid NOT NULL REFERENCES "Chat"("id")`;
		} else {
			// If not empty, add nullable first
			await sql_client`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "chatId" uuid REFERENCES "Chat"("id")`;
			// We can't easily backfill without more logic, but user only cares about NEW usage fix likely
			// Or we warn
			console.warn(
				"Table not empty, added nullable chatId. Existing rows will have NULL chatId which violates schema expectation, but allows migration.",
			);
		}
		console.log("Success: Added chatId column.");
	} catch (e) {
		console.error("Failed to add column:", e);
	}
}

fixSchema()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
