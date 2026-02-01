import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const updateXeroInvoice = tool({
	description: "Updates an existing invoice in Xero.",
	inputSchema: z.object({
		invoiceID: z.string(),
		contactID: z.string().optional(),
		date: z.string().optional(),
		dueDate: z.string().optional(),
		reference: z.string().optional(),
		lineItems: z.array(z.object({
			lineItemID: z.string().optional(),
			description: z.string(),
			quantity: z.number(),
			unitAmount: z.number(),
			accountCode: z.string().optional(),
			itemCode: z.string().optional(),
			taxType: z.string().optional(),
		})).optional(),
		status: z.enum(["DRAFT", "SUBMITTED", "AUTHORISED", "VOIDED", "DELETED"]).optional(),
	}),
	execute: async ({ invoiceID, contactID, date, dueDate, reference, lineItems, status }) => {
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
				const invoiceData: any = {
					InvoiceID: invoiceID,
					Status: status,
				};
				
				if (contactID) invoiceData.Contact = { ContactID: contactID };
				if (date) invoiceData.Date = date;
				if (dueDate) invoiceData.DueDate = dueDate;
				if (reference) invoiceData.Reference = reference;
				if (lineItems) {
					invoiceData.LineItems = lineItems.map(item => ({
						LineItemID: item.lineItemID,
						Description: item.description,
						Quantity: item.quantity,
						UnitAmount: item.unitAmount,
						AccountCode: item.accountCode,
						ItemCode: item.itemCode,
						TaxType: item.taxType,
					}));
				}

				const response = await client.fetch(`/Invoices/${invoiceID}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(invoiceData),
				});

				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					invoice: data.Invoices?.[0],
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "updateXeroInvoice", operation: "updating invoice" });
		}
	},
});
