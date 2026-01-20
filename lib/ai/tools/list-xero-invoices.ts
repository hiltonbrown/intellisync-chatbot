import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";

export const listXeroInvoices = tool({
	description:
		"Lists invoices from Xero with optional filtering. Returns both sales invoices (ACCREC) and purchase bills (ACCPAY). Use this when the user asks about invoices, bills, sales, or accounts receivable/payable.",
	inputSchema: z.object({
		page: z
			.number()
			.int()
			.min(1)
			.optional()
			.describe(
				"Page number for pagination (default: 1). Each page returns up to 100 invoices.",
			),
		invoiceNumbers: z
			.array(z.string())
			.optional()
			.describe(
				"Filter by specific invoice numbers (e.g., ['INV-0001', 'INV-0002']). Returns detailed line items when specified.",
			),
		contactIDs: z
			.array(z.string())
			.optional()
			.describe(
				"Filter by contact IDs (from list-xero-contacts). Returns only invoices for these customers/suppliers.",
			),
		statuses: z
			.array(
				z.enum([
					"DRAFT",
					"SUBMITTED",
					"DELETED",
					"AUTHORISED",
					"PAID",
					"VOIDED",
				]),
			)
			.optional()
			.describe(
				"Filter by invoice status. Common statuses: DRAFT (not sent), SUBMITTED (awaiting approval), AUTHORISED (approved), PAID (fully paid).",
			),
		type: z
			.enum(["ACCREC", "ACCPAY"])
			.optional()
			.describe(
				"Invoice type: ACCREC for sales invoices (accounts receivable), ACCPAY for purchase bills (accounts payable).",
			),
		fromDate: z
			.string()
			.optional()
			.describe(
				"Filter invoices modified after this date in YYYY-MM-DD format.",
			),
		toDate: z
			.string()
			.optional()
			.describe(
				"Filter invoices modified before this date in YYYY-MM-DD format.",
			),
	}),
	execute: async ({
		page = 1,
		invoiceNumbers,
		contactIDs,
		statuses,
		type,
		fromDate,
		toDate,
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
				// Build query parameters
				const params = new URLSearchParams();
				params.append("page", page.toString());

				if (invoiceNumbers && invoiceNumbers.length > 0) {
					params.append("InvoiceNumbers", invoiceNumbers.join(","));
				}
				if (contactIDs && contactIDs.length > 0) {
					params.append("ContactIDs", contactIDs.join(","));
				}
				if (statuses && statuses.length > 0) {
					params.append("Statuses", statuses.join(","));
				}
				if (type) {
					params.append("Type", type);
				}

				// Date filtering requires Where clause
				const whereClauses: string[] = [];
				if (fromDate) {
					whereClauses.push(`Date >= DateTime(${fromDate})`);
				}
				if (toDate) {
					whereClauses.push(`Date <= DateTime(${toDate})`);
				}
				if (whereClauses.length > 0) {
					params.append("where", whereClauses.join(" AND "));
				}

				const queryString = params.toString();
				const endpoint = `/Invoices${queryString ? `?${queryString}` : ""}`;

				// Fetch invoices from Xero
				const response = await client.fetch(endpoint);

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to fetch invoices from Xero: ${errorText}`,
					};
				}

				const data = await response.json();
				const invoices = data.Invoices || [];

				// Format invoices for better readability
				const formattedInvoices = invoices.map((invoice: any) => ({
					invoiceID: invoice.InvoiceID,
					invoiceNumber: invoice.InvoiceNumber,
					type: invoice.Type,
					status: invoice.Status,
					contact: {
						contactID: invoice.Contact?.ContactID,
						name: invoice.Contact?.Name,
					},
					date: invoice.Date,
					dueDate: invoice.DueDate,
					lineAmountTypes: invoice.LineAmountTypes,
					subTotal: invoice.SubTotal,
					totalTax: invoice.TotalTax,
					total: invoice.Total,
					amountDue: invoice.AmountDue,
					amountPaid: invoice.AmountPaid,
					amountCredited: invoice.AmountCredited,
					currencyCode: invoice.CurrencyCode,
					currencyRate: invoice.CurrencyRate,
					reference: invoice.Reference,
					brandingThemeID: invoice.BrandingThemeID,
					hasAttachments: invoice.HasAttachments,
					isDiscounted: invoice.IsDiscounted,
					sentToContact: invoice.SentToContact,
					...(invoiceNumbers && invoiceNumbers.length > 0
						? {
								lineItems: invoice.LineItems?.map((line: any) => ({
									lineItemID: line.LineItemID,
									description: line.Description,
									quantity: line.Quantity,
									unitAmount: line.UnitAmount,
									accountCode: line.AccountCode,
									taxType: line.TaxType,
									taxAmount: line.TaxAmount,
									lineAmount: line.LineAmount,
									itemCode: line.ItemCode,
								})),
							}
						: {}),
				}));

				return {
					success: true,
					totalInvoices: formattedInvoices.length,
					page,
					invoices: formattedInvoices,
					hasMore: formattedInvoices.length === 100,
					summary: `Retrieved ${formattedInvoices.length} invoice${formattedInvoices.length === 1 ? "" : "s"}${type ? ` of type ${type}` : ""}. ${formattedInvoices.length === 100 ? "There may be more invoices - use page parameter to get the next page." : ""}`,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, {
				toolName: "listXeroInvoices",
				operation: "fetching invoices",
			});
		}
	},
});
