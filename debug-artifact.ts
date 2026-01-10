import * as dotenv from "dotenv";
import { asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chat, document, message } from "./lib/db/schema";

dotenv.config({ path: ".env.local" });

if (!process.env.POSTGRES_URL) {
	console.error("POSTGRES_URL is not set");
	process.exit(1);
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

async function checkDoc() {
	// Check specific document
	const docId = "3959d6a2-0b28-4281-8c5e-afa0097d0f92";
	const chatId = "c51f9949-abeb-42e2-85cb-6bcbfed1d068";

	console.log(`Inspecting chat: ${chatId}`);

	console.log(`Checking Document ID: ${docId}`);
	try {
		const docs = await db
			.select()
			.from(document)
			.where(eq(document.id, docId))
			.orderBy(asc(document.createdAt));

		if (docs.length === 0) {
			console.log(`\nDocument ${docId} MISSING from DB.`);
		} else {
			console.log(`\nFound ${docs.length} versions for Document ${docId}.`);
			docs.forEach((d, i) => {
				console.log(`\nVersion ${i + 1}:`);
				console.log(`Created At: ${d.createdAt}`);
				console.log(`Content Len: ${d.content?.length}`);
				console.log(`Content Preview: ${d.content?.substring(0, 50)}...`);
			});
		}
	} catch (e) {
		console.error("Query failed:", e);
	}
}

checkDoc()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
