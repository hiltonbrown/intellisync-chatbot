import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { z } from "zod";
import { TokenService } from "@/lib/integrations/token-service";
import { createInvoice } from "@/lib/integrations/xero/operations";
import { getActiveTenantBinding } from "@/lib/db/queries";

export const createXeroInvoice = tool({
	description:
		"Create a new invoice in Xero accounting system. Can create sales invoices (ACCREC) or purchase invoices/bills (ACCPAY). Requires user approval before execution.",
	inputSchema: z.object({
		type: z
			.enum(["ACCREC", "ACCPAY"])
			.describe("Invoice type: ACCREC for sales invoice, ACCPAY for bill"),
		contactID: z.string().describe("Xero Contact ID for the customer/supplier"),
		lineItems: z
			.array(
				z.object({
					description: z.string().describe("Line item description"),
					quantity: z.number().describe("Quantity"),
					unitAmount: z.number().describe("Unit price"),
					accountCode: z.string().optional().describe("Account code"),
					taxType: z.string().optional().describe("Tax type (e.g., OUTPUT2, INPUT2)"),
				}),
			)
			.describe("Invoice line items"),
		date: z
			.string()
			.optional()
			.describe("Invoice date in YYYY-MM-DD format (default: today)"),
		dueDate: z
			.string()
			.optional()
			.describe("Due date in YYYY-MM-DD format"),
		reference: z.string().optional().describe("Reference or PO number"),
		status: z
			.enum(["DRAFT", "SUBMITTED", "AUTHORISED"])
			.optional()
			.describe("Invoice status (default: DRAFT)"),
	}),
	needsApproval: true, // ⚠️ Write operation - requires user approval
	execute: async (input) => {
		try {
			// 1. Get current organization context
			const { userId, orgId } = await auth();

			if (!userId || !orgId) {
				return {
					error: "User must be authenticated with organization context",
				};
			}

			// 2. Check if Xero integration is active
			const tenantBinding = await getActiveTenantBinding({
				clerkOrgId: orgId,
				provider: "xero",
			});

			if (!tenantBinding) {
				return {
					error:
						"Xero integration not connected. Please connect Xero in Settings > Integrations.",
				};
			}

			// 3. Get authenticated client
			const client = await TokenService.getClientForTenantBinding(
				tenantBinding.id,
			);

			// 4. Build invoice object
			const invoiceData = {
				Type: input.type,
				Contact: { ContactID: input.contactID },
				LineItems: input.lineItems.map((item) => ({
					Description: item.description,
					Quantity: item.quantity,
					UnitAmount: item.unitAmount,
					AccountCode: item.accountCode,
					TaxType: item.taxType,
				})),
				Date: input.date,
				DueDate: input.dueDate,
				Reference: input.reference,
				Status: input.status || "DRAFT",
				LineAmountTypes: "Exclusive" as const,
			};

			// 5. Call Xero API
			const invoice = await createInvoice(client, invoiceData);

			return {
				success: true,
				tenantName: tenantBinding.externalTenantName,
				invoice: {
					invoiceID: invoice.InvoiceID,
					invoiceNumber: invoice.InvoiceNumber,
					type: invoice.Type,
					status: invoice.Status,
					total: invoice.Total,
					amountDue: invoice.AmountDue,
					date: invoice.Date,
					dueDate: invoice.DueDate,
					reference: invoice.Reference,
				},
				message: `Invoice ${invoice.InvoiceNumber} created successfully in Xero`,
			};
		} catch (error: unknown) {
			console.error("Failed to create Xero invoice:", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			if (errorMessage.includes("401")) {
				return {
					error:
						"Xero authorization expired. Please reconnect in Settings > Integrations.",
				};
			}

			return { error: `Failed to create invoice: ${errorMessage}` };
		}
	},
});
