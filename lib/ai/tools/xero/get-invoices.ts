import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { z } from "zod";
import { TokenService } from "@/lib/integrations/token-service";
import { getInvoices } from "@/lib/integrations/xero/operations";
import { getActiveTenantBinding } from "@/lib/db/queries";

export const getXeroInvoices = tool({
	description:
		"Retrieve invoices from Xero accounting system. Can filter by status, contact, or search criteria. Returns sales invoices (ACCREC) and purchase invoices/bills (ACCPAY).",
	inputSchema: z.object({
		status: z
			.enum(["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "VOIDED", "DELETED"])
			.optional()
			.describe("Filter by invoice status"),
		contactID: z.string().optional().describe("Filter by Xero Contact ID"),
		page: z
			.number()
			.optional()
			.describe("Page number for pagination (default 1)"),
		invoiceNumber: z
			.string()
			.optional()
			.describe("Search by specific invoice number"),
	}),
	needsApproval: false, // Read-only operation
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

			// 4. Build filter
			const filters: {
				page?: number;
				where?: string;
				statuses?: string[];
				contactIDs?: string[];
				invoiceNumbers?: string[];
			} = {};

			if (input.page) {
				filters.page = input.page;
			}

			if (input.status) {
				filters.statuses = [input.status];
			}

			if (input.contactID) {
				filters.contactIDs = [input.contactID];
			}

			if (input.invoiceNumber) {
				filters.invoiceNumbers = [input.invoiceNumber];
			}

			// 5. Call Xero API
			const invoices = await getInvoices(client, filters);

			return {
				success: true,
				tenantName: tenantBinding.externalTenantName,
				count: invoices.length,
				invoices: invoices.map((inv) => ({
					invoiceID: inv.InvoiceID,
					invoiceNumber: inv.InvoiceNumber,
					type: inv.Type,
					status: inv.Status,
					contact: {
						contactID:
							typeof inv.Contact === "object" && "ContactID" in inv.Contact
								? inv.Contact.ContactID
								: undefined,
						name:
							typeof inv.Contact === "object" && "Name" in inv.Contact
								? inv.Contact.Name
								: undefined,
					},
					date: inv.Date,
					dueDate: inv.DueDate,
					total: inv.Total,
					amountDue: inv.AmountDue,
					amountPaid: inv.AmountPaid,
					reference: inv.Reference,
					currencyCode: inv.CurrencyCode,
				})),
			};
		} catch (error: unknown) {
			console.error("Failed to fetch Xero invoices:", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			if (errorMessage.includes("401")) {
				return {
					error:
						"Xero authorization expired. Please reconnect in Settings > Integrations.",
				};
			}

			return { error: `Failed to retrieve invoices: ${errorMessage}` };
		}
	},
});
