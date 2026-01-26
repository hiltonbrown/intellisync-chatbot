"use server";

import "server-only";

import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { and, desc, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { cashflowSuggestionPrompt } from "@/lib/ai/prompts-cashflow";
import { getLanguageModel } from "@/lib/ai/providers";
import { db } from "@/lib/db";
import {
	cashflowAdjustments,
	xeroTransactions,
} from "@/lib/db/schema";

export async function generateCashflowSuggestions() {
	const { orgId } = await auth();
	if (!orgId) return [];

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (t, { and, eq }) =>
			and(
				eq(t.clerkOrgId, orgId),
				eq(t.status, "active"),
				eq(t.provider, "xero"),
			),
	});
	if (!binding) return [];

	// Fetch last 60 days of transactions to find patterns
	const sixtyDaysAgo = new Date();
	sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

	const transactions = await db.query.xeroTransactions.findMany({
		where: and(
			eq(xeroTransactions.xeroTenantId, binding.externalTenantId),
			gte(xeroTransactions.date, sixtyDaysAgo),
		),
		orderBy: [desc(xeroTransactions.date)],
		limit: 50, // Analyze last 50 for MVP speed
	});

	const context = transactions
		.map(
			(t) =>
				`${t.description}: $${t.amount} on ${t.date?.toISOString().split("T")[0]}`,
		)
		.join("\n");

	const model = getLanguageModel(DEFAULT_CHAT_MODEL);
	const { text } = await generateText({
		model,
		prompt: cashflowSuggestionPrompt(context),
		temperature: 0.2,
	});

	try {
		// Safely extract JSON array from the model output
		const jsonStart = text.indexOf("[");
		const jsonEnd = text.lastIndexOf("]");

		if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
			console.error("[generateCashflowSuggestions] No valid JSON array found in response");
			return [];
		}

		const jsonString = text.slice(jsonStart, jsonEnd + 1);
		const parsed = JSON.parse(jsonString);

		// Basic structural validation: expect an array of plain objects
		if (!Array.isArray(parsed)) {
			console.error("[generateCashflowSuggestions] Parsed result is not an array");
			return [];
		}

		const suggestions = parsed.filter(
			(item) => item !== null && typeof item === "object" && !Array.isArray(item),
		);

		return suggestions;
	} catch (e) {
		console.error("[generateCashflowSuggestions] Failed to parse AI suggestions", e);
		return [];
	}
}

export async function addCashflowAdjustment(data: {
	description: string;
	amount: number;
	date: Date;
	type: "IN" | "OUT";
}) {
	const { orgId, userId } = await auth();
	if (!orgId || !userId) throw new Error("Unauthorized");

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (t, { and, eq }) =>
			and(
				eq(t.clerkOrgId, orgId),
				eq(t.status, "active"),
				eq(t.provider, "xero"),
			),
	});
	if (!binding) throw new Error("No active binding");

	await db.insert(cashflowAdjustments).values({
		userId,
		xeroTenantId: binding.externalTenantId,
		description: data.description,
		amount: data.amount.toString(),
		date: data.date,
		type: data.type,
		status: "CONFIRMED",
	});

	revalidatePath("/agents/cashflow");
}
