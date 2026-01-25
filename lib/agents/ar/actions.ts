"use server";

import { generateText } from "ai";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { collectionEmailPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { integrationTenantBindings, xeroContacts, xeroInvoices } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function generateCollectionEmail(
	contactName: string,
	companyName: string,
	overdueInvoices: Array<{
		date: string;
		dueDate: string;
		amount: string;
		number: string;
	}>,
) {
	const model = getLanguageModel(DEFAULT_CHAT_MODEL);

	const { text } = await generateText({
		model,
		prompt: collectionEmailPrompt(contactName, companyName, overdueInvoices),
		temperature: 0.7,
	});

	return text;
}

export async function getCustomerDetails(contactId: string) {
	const { orgId } = await auth();
	if (!orgId) return null;

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (t, { and, eq }) =>
			and(
				eq(t.clerkOrgId, orgId),
				eq(t.status, "active"),
				eq(t.provider, "xero"),
			),
	});
	if (!binding) return null;

	const contact = await db.query.xeroContacts.findFirst({
		where: (t, { and, eq }) =>
			and(eq(t.id, contactId), eq(t.xeroTenantId, binding.externalTenantId)),
	});

	if (!contact) return null;

	const invoices = await db.query.xeroInvoices.findMany({
		where: (t, { and, eq }) =>
			and(
				eq(t.contactId, contactId),
				eq(t.xeroTenantId, binding.externalTenantId),
			),
		orderBy: (t, { desc }) => [desc(t.date)],
	});

	// Calculate Risk Rating
	const now = new Date();
	let risk = "Low";

	for (const inv of invoices) {
		const due = Number(inv.amountDue);
		if (due > 0 && inv.dueDate) {
			const diffTime = now.getTime() - inv.dueDate.getTime();
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

			// If now > dueDate (diffTime > 0)
			if (diffTime > 0) {
				if (diffDays > 60) {
					risk = "High";
					break;
				} else if (diffDays > 30 && risk !== "High") {
					risk = "Medium";
				}
			}
		}
	}

	return {
		contact,
		invoices: invoices.map((i) => ({
			...i,
			amountDue: Number(i.amountDue),
			amountPaid: Number(i.amountPaid),
			total: Number(i.total),
		})),
		risk,
	};
}
