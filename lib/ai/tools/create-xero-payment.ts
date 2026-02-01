import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const createXeroPayment = tool({
	description: "Creates a new payment in Xero (for an invoice or credit note).",
	inputSchema: z.object({
		invoiceID: z.string().optional().describe("ID of the invoice to pay"),
		creditNoteID: z.string().optional().describe("ID of the credit note to apply"),
		accountID: z.string().optional().describe("ID of the bank account"),
		date: z.string().optional().describe("Payment date (YYYY-MM-DD)"),
		amount: z.number().describe("Amount to pay"),
		reference: z.string().optional(),
	}),
	execute: async ({ invoiceID, creditNoteID, accountID, date, amount, reference }) => {
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
				const paymentData: any = {
					Date: date,
					Amount: amount,
					Reference: reference,
				};
				
				if (invoiceID) paymentData.Invoice = { InvoiceID: invoiceID };
				if (creditNoteID) paymentData.CreditNote = { CreditNoteID: creditNoteID };
				if (accountID) paymentData.Account = { AccountID: accountID };

				const response = await client.fetch("/Payments", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(paymentData),
				});

				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					payment: data.Payments?.[0],
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "createXeroPayment", operation: "creating payment" });
		}
	},
});
