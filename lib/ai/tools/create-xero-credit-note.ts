import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const createXeroCreditNote = tool({
	description: "Creates a new credit note in Xero.",
	inputSchema: z.object({
		type: z.enum(["ACCRECCREDIT", "ACCPAYCREDIT"]).describe("ACCRECCREDIT for sales, ACCPAYCREDIT for bills"),
		contactID: z.string(),
		date: z.string().optional(),
		reference: z.string().optional(),
		lineItems: z.array(z.object({
			description: z.string(),
			quantity: z.number(),
			unitAmount: z.number(),
			accountCode: z.string().optional(),
			itemCode: z.string().optional(),
			taxType: z.string().optional(),
		})),
		status: z.enum(["DRAFT", "SUBMITTED", "AUTHORISED"]).optional(),
	}),
	execute: async ({ type, contactID, date, reference, lineItems, status = "DRAFT" }) => {
		try {
			const { userId, orgId } = await auth();
			if (!userId || !orgId) return { error: "Unauthorized" };

			const binding = await db.query.integrationTenantBindings.findFirst({
				where: and(
					eq(integrationTenantBindings.clerkOrgId, orgId),
					eq(integrationTenantBindings.provider, "xero"),
					eq(integrationTenantBindings.status, "active"),
				),
			});
			if (!binding) return { error: "Xero not connected" };

			return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
				const creditNoteData = {
					Type: type,
					Contact: { ContactID: contactID },
					Date: date,
					Reference: reference,
					LineItems: lineItems.map(item => ({
						Description: item.description,
						Quantity: item.quantity,
						UnitAmount: item.unitAmount,
						AccountCode: item.accountCode,
						ItemCode: item.itemCode,
						TaxType: item.taxType,
					})),
					Status: status,
				};

				const response = await client.fetch("/CreditNotes", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(creditNoteData),
				});

				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					creditNote: data.CreditNotes?.[0],
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "createXeroCreditNote", operation: "creating credit note" });
		}
	},
});
