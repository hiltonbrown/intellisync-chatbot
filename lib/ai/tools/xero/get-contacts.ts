import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { z } from "zod";
import { TokenService } from "@/lib/integrations/token-service";
import { getContacts } from "@/lib/integrations/xero/operations";
import { getActiveTenantBinding } from "@/lib/db/queries";

export const getXeroContacts = tool({
	description:
		"Retrieve contacts (customers and suppliers) from Xero accounting system. Can filter by search term, page number, or archived status.",
	inputSchema: z.object({
		searchTerm: z
			.string()
			.optional()
			.describe("Search contacts by name or email address"),
		page: z
			.number()
			.optional()
			.describe("Page number for pagination (default 1)"),
		includeArchived: z
			.boolean()
			.optional()
			.describe("Include archived/deleted contacts"),
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

			// 3. Get authenticated client (handles token refresh automatically)
			const client = await TokenService.getClientForTenantBinding(
				tenantBinding.id,
			);

			// 4. Build filter
			const filters: { page?: number; where?: string; includeArchived?: boolean } = {};

			if (input.page) {
				filters.page = input.page;
			}

			if (input.searchTerm) {
				// Xero API uses OData-style filtering
				filters.where = `Name.Contains("${input.searchTerm}") OR EmailAddress.Contains("${input.searchTerm}")`;
			}

			if (input.includeArchived !== undefined) {
				filters.includeArchived = input.includeArchived;
			}

			// 5. Call Xero API
			const contacts = await getContacts(client, filters);

			return {
				success: true,
				tenantName: tenantBinding.externalTenantName,
				count: contacts.length,
				contacts: contacts.map((c) => ({
					contactID: c.ContactID,
					name: c.Name,
					email: c.EmailAddress,
					status: c.ContactStatus,
					isCustomer: c.IsCustomer,
					isSupplier: c.IsSupplier,
					accountNumber: c.AccountNumber,
					taxNumber: c.TaxNumber,
				})),
			};
		} catch (error: unknown) {
			console.error("Failed to fetch Xero contacts:", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			// Handle specific error cases
			if (errorMessage.includes("401")) {
				return {
					error:
						"Xero authorization expired. Please reconnect in Settings > Integrations.",
				};
			}

			return { error: `Failed to retrieve contacts: ${errorMessage}` };
		}
	},
});
