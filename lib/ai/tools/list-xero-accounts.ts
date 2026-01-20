import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";

export const listXeroAccounts = tool({
	description:
		"Lists the chart of accounts from Xero. Shows all account codes used for categorizing transactions. Use this when creating invoices, categorizing expenses, or when the user asks about account codes, chart of accounts, or GL codes.",
	inputSchema: z.object({
		type: z
			.enum([
				"BANK",
				"CURRENT",
				"CURRLIAB",
				"DEPRECIATN",
				"DIRECTCOSTS",
				"EQUITY",
				"EXPENSE",
				"FIXED",
				"INVENTORY",
				"LIABILITY",
				"NONCURRENT",
				"OTHERINCOME",
				"OVERHEADS",
				"PREPAYMENT",
				"REVENUE",
				"SALES",
				"TERMLIAB",
			])
			.optional()
			.describe(
				"Filter by account type. Common types: REVENUE (income), EXPENSE (costs), BANK (bank accounts), FIXED (assets).",
			),
		taxType: z
			.string()
			.optional()
			.describe(
				"Filter by tax type (e.g., 'OUTPUT2' for GST on Income, 'INPUT2' for GST on Expenses).",
			),
	}),
	execute: async ({ type, taxType }) => {
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
				const whereClauses: string[] = [];

				if (type) {
					whereClauses.push(`Type=="${type}"`);
				}
				if (taxType) {
					whereClauses.push(`TaxType=="${taxType}"`);
				}

				if (whereClauses.length > 0) {
					params.append("where", whereClauses.join(" AND "));
				}

				const queryString = params.toString();
				const endpoint = `/Accounts${queryString ? `?${queryString}` : ""}`;

				// Fetch accounts from Xero
				const response = await client.fetch(endpoint);

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to fetch accounts from Xero: ${errorText}`,
					};
				}

				const data = await response.json();
				const accounts = data.Accounts || [];

				// Format accounts for better readability
				const formattedAccounts = accounts.map((account: any) => ({
					accountID: account.AccountID,
					code: account.Code,
					name: account.Name,
					type: account.Type,
					taxType: account.TaxType,
					description: account.Description,
					class: account.Class,
					status: account.Status,
					systemAccount: account.SystemAccount,
					enablePaymentsToAccount: account.EnablePaymentsToAccount,
					showInExpenseClaims: account.ShowInExpenseClaims,
					bankAccountNumber: account.BankAccountNumber,
					currencyCode: account.CurrencyCode,
					reportingCode: account.ReportingCode,
					reportingCodeName: account.ReportingCodeName,
					hasAttachments: account.HasAttachments,
				}));

				// Group accounts by type for easier browsing
				const accountsByType = formattedAccounts.reduce(
					(acc: any, account: any) => {
						const accountType = account.type || "OTHER";
						if (!acc[accountType]) {
							acc[accountType] = [];
						}
						acc[accountType].push(account);
						return acc;
					},
					{},
				);

				return {
					success: true,
					totalAccounts: formattedAccounts.length,
					accounts: formattedAccounts,
					accountsByType,
					summary: `Retrieved ${formattedAccounts.length} account${formattedAccounts.length === 1 ? "" : "s"} from the chart of accounts${type ? ` of type ${type}` : ""}.`,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, {
				toolName: "listXeroAccounts",
				operation: "fetching chart of accounts",
			});
		}
	},
});
