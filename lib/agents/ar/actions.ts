"use server";

import "server-only";

import { generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { collectionEmailPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
	integrationTenantBindings,
	userSettings,
	xeroContacts,
	xeroInvoices,
} from "@/lib/db/schema";
import { ExternalAPIError } from "@/lib/integrations/errors";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

const uuidSchema = z.string().uuid();

// Helper to fetch history from Xero
async function fetchXeroHistory(
	orgId: string,
	relatedId: string,
): Promise<string[]> {
	const binding = await db.query.integrationTenantBindings.findFirst({
		where: and(
			eq(integrationTenantBindings.clerkOrgId, orgId),
			eq(integrationTenantBindings.provider, "xero"),
			eq(integrationTenantBindings.status, "active"),
		),
	});

	if (!binding) return [];

	try {
		return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
			const response = await client.fetch(
				`/HistoryAndNotes?RelatedID=${relatedId}`,
			);

			if (!response.ok) return [];

			const data = await response.json();
			// Xero returns { HistoryAndNotes: [ ... ] }
			// Each item has { DateUTC, Details, User, Notes, Type }
			return (data.HistoryAndNotes || [])
				.sort(
					(a: any, b: any) =>
						new Date(b.DateUTC).getTime() - new Date(a.DateUTC).getTime(),
				)
				.slice(0, 5) // Last 5 entries
				.map((item: any) => {
					const date = new Date(item.DateUTC).toLocaleDateString("en-AU");
					return `[${date}] ${item.Details || item.Notes || "No details"}`;
				});
		});
	} catch (error) {
		// 404 means no history found or invalid ID, which is fine
		if (
			error instanceof ExternalAPIError &&
			error.statusCode === 404
		) {
			return [];
		}
		console.warn(`Failed to fetch history for ${relatedId}`, error);
		return [];
	}
}

export async function generateCollectionEmail(
	contactName: string,
	contactId: string,
	overdueInvoices: Array<{
		id: string;
		date: string;
		dueDate: string;
		amount: string;
		number: string;
	}>,
) {
	const { userId, orgId } = await auth();
	const user = await currentUser();

	if (!userId || !user || !orgId) throw new Error("Not authenticated");

	// Fetch company name from user settings
	const [settings] = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, userId));

	let companyName = settings?.companyName || "Your Company";
	const userLocation = settings?.timezone?.split("/")[1]?.replace(/_/g, " ");

	// Override with Clerk Organization name if available
	if (orgId) {
		try {
			const client = await clerkClient();
			const org = await client.organizations.getOrganization({
				organizationId: orgId,
			});
			companyName = org.name;
		} catch (error) {
			console.warn("Failed to fetch organization name:", error);
		}
	}

	// Fetch history for Contact and Invoices
	const historyPromises = [
		fetchXeroHistory(orgId, contactId).then((notes) =>
			notes.length ? `Contact History:\n${notes.join("\n")}` : "",
		),
		...overdueInvoices.map((inv) =>
			fetchXeroHistory(orgId, inv.id).then((notes) =>
				notes.length
					? `Invoice ${inv.number} History:\n${notes.join("\n")}`
					: "",
			),
		),
	];

	const historyResults = await Promise.all(historyPromises);
	const historyContext = historyResults.filter(Boolean).join("\n\n");

	const model = getLanguageModel(DEFAULT_CHAT_MODEL);

	const { text } = await generateText({
		model,
		prompt: collectionEmailPrompt({
			contactName,
			companyName,
			userFirstName: user.firstName || "Accounts",
			userLastName: user.lastName || "Team",
			userLocation,
			overdueInvoices,
			historyContext,
		}),
		temperature: 0.7,
	});

	return text;
}

export async function getCustomerDetails(contactId: string) {
	const { orgId } = await auth();
	if (!orgId) return null;

	const validation = uuidSchema.safeParse(contactId);
	if (!validation.success) {
		throw new Error("Invalid contact ID format");
	}

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