import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const createXeroInvoice = tool({
	description:
		"Creates a new invoice in Xero. Can create sales invoices (for customers) or purchase bills (for suppliers). Use this when the user wants to create, draft, or generate an invoice. Requires approval before execution.",
	inputSchema: z.object({
		contactID: z
			.string()
			.describe(
				"Contact ID of the customer or supplier (get this from list-xero-contacts tool first).",
			),
		type: z
			.enum(["ACCREC", "ACCPAY"])
			.describe(
				"Invoice type: ACCREC for sales invoices (to customers), ACCPAY for purchase bills (from suppliers).",
			),
		lineItems: z
			.array(
				z.object({
					description: z.string().describe("Line item description."),
					quantity: z.number().min(0).describe("Quantity (default: 1)."),
					unitAmount: z.number().describe("Unit price/amount."),
					accountCode: z
						.string()
						.describe(
							"Account code from chart of accounts (use list-xero-accounts to find).",
						),
					taxType: z
						.string()
						.optional()
						.describe(
							"Tax type code (e.g., 'OUTPUT2' for GST on Income, 'INPUT2' for GST on Expenses). Leave empty to use account default.",
						),
					itemCode: z
						.string()
						.optional()
						.describe("Item code if using Xero inventory items."),
				}),
			)
			.min(1)
			.describe("Array of line items for the invoice."),
		date: z
			.string()
			.optional()
			.describe(
				"Invoice date in YYYY-MM-DD format. If not provided, uses today's date.",
			),
		dueDate: z
			.string()
			.optional()
			.describe(
				"Due date in YYYY-MM-DD format. If not provided, uses contact's default payment terms.",
			),
		reference: z
			.string()
			.optional()
			.describe("Optional reference number or code."),
		status: z
			.enum(["DRAFT", "SUBMITTED", "AUTHORISED"])
			.optional()
			.describe(
				"Invoice status: DRAFT (save as draft), SUBMITTED (send for approval), AUTHORISED (approve immediately). Default is DRAFT.",
			),
	}),
	needsApproval: true, // Requires user approval before creating invoices
	execute: async ({
		contactID,
		type,
		lineItems,
		date,
		dueDate,
		reference,
		status = "DRAFT",
	}) => {
		try {
			// Get current organization context from Clerk
			const { userId, orgId } = await auth();

			if (!userId || !orgId) {
				return {
					error: "User must be logged in with an organization context",
				};
			}

			// Check if Xero is connected for this organization
			const binding = await db.query.integrationTenantBindings.findFirst({
				where: and(
					eq(integrationTenantBindings.clerkOrgId, orgId),
					eq(integrationTenantBindings.provider, "xero"),
					eq(integrationTenantBindings.status, "active"),
				),
			});

			if (!binding) {
				return {
					error:
						"Xero is not connected. Please connect Xero in Settings > Integrations first.",
					hint: "Visit /settings/integrations to connect your Xero account",
				};
			}

			// Use retry helper to handle token refresh on 401 errors
			return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
				// Build invoice payload
				const invoicePayload = {
					Type: type,
					Contact: {
						ContactID: contactID,
					},
					LineItems: lineItems.map((item) => ({
						Description: item.description,
						Quantity: item.quantity,
						UnitAmount: item.unitAmount,
						AccountCode: item.accountCode,
						...(item.taxType ? { TaxType: item.taxType } : {}),
						...(item.itemCode ? { ItemCode: item.itemCode } : {}),
					})),
					...(date ? { Date: date } : {}),
					...(dueDate ? { DueDate: dueDate } : {}),
					...(reference ? { Reference: reference } : {}),
					Status: status,
				};

				// Create invoice in Xero
				const response = await client.fetch("/Invoices", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						Invoices: [invoicePayload],
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to create invoice in Xero: ${errorText}`,
					};
				}

				const data = await response.json();
				const invoice = data.Invoices?.[0];

				if (!invoice) {
					return {
						error: "No invoice data returned from Xero",
					};
				}

				// Check for validation errors
				if (invoice.ValidationErrors && invoice.ValidationErrors.length > 0) {
					const errors = invoice.ValidationErrors.map(
						(err: any) => err.Message,
					).join(", ");
					return {
						error: `Invoice validation failed: ${errors}`,
						validationErrors: invoice.ValidationErrors,
					};
				}

				return {
					success: true,
					invoiceID: invoice.InvoiceID,
					invoiceNumber: invoice.InvoiceNumber,
					type: invoice.Type,
					status: invoice.Status,
					contact: invoice.Contact?.Name,
					date: invoice.Date,
					dueDate: invoice.DueDate,
					total: invoice.Total,
					subTotal: invoice.SubTotal,
					totalTax: invoice.TotalTax,
					currencyCode: invoice.CurrencyCode,
					reference: invoice.Reference,
					xeroLink: `https://go.xero.com/AccountsReceivable/Edit.aspx?InvoiceID=${invoice.InvoiceID}`,
					summary: `Invoice ${invoice.InvoiceNumber} created successfully in Xero with status ${invoice.Status}. Total: ${invoice.CurrencyCode} ${invoice.Total}`,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, {
				toolName: "createXeroInvoice",
				operation: "creating invoice",
			});
		}
	},
});
