import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { z } from "zod";
import { TokenService } from "@/lib/integrations/token-service";
import { getAccounts } from "@/lib/integrations/xero/operations";
import { getActiveTenantBinding } from "@/lib/db/queries";

export const getXeroAccounts = tool({
	description:
		"Retrieve chart of accounts from Xero accounting system. Returns all active accounts including bank accounts, expense accounts, revenue accounts, etc.",
	inputSchema: z.object({
		accountType: z
			.enum([
				"BANK",
				"CURRENT",
				"EXPENSE",
				"REVENUE",
				"FIXED",
				"LIABILITY",
				"EQUITY",
			])
			.optional()
			.describe("Filter by account type"),
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
			const filters: { where?: string } = {};

			if (input.accountType) {
				const safeAccountType = input.accountType.replace(/"/g, '\\"');
				filters.where = `Type=="${safeAccountType}"`;
			}

			// 5. Call Xero API
			const accounts = await getAccounts(client, filters);

			return {
				success: true,
				tenantName: tenantBinding.externalTenantName,
				count: accounts.length,
				accounts: accounts.map((acc) => ({
					accountID: acc.AccountID,
					code: acc.Code,
					name: acc.Name,
					type: acc.Type,
					taxType: acc.TaxType,
					description: acc.Description,
					class: acc.Class,
					status: acc.Status,
					bankAccountNumber: acc.BankAccountNumber,
				})),
			};
		} catch (error: unknown) {
			console.error("Failed to fetch Xero accounts:", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			if (errorMessage.includes("401")) {
				return {
					error:
						"Xero authorization expired. Please reconnect in Settings > Integrations.",
				};
			}

			return { error: `Failed to retrieve accounts: ${errorMessage}` };
		}
	},
});
