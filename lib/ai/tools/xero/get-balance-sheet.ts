import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { z } from "zod";
import { TokenService } from "@/lib/integrations/token-service";
import { getBalanceSheet } from "@/lib/integrations/xero/operations";
import { getActiveTenantBinding } from "@/lib/db/queries";

export const getXeroBalanceSheet = tool({
	description:
		"Get Balance Sheet report from Xero accounting system. Shows assets, liabilities, and equity at a specific date.",
	inputSchema: z.object({
		date: z
			.string()
			.optional()
			.describe("Balance sheet date in YYYY-MM-DD format (default: today)"),
		periods: z
			.number()
			.optional()
			.describe("Number of periods to compare"),
		timeframe: z
			.enum(["MONTH", "QUARTER", "YEAR"])
			.optional()
			.describe("Timeframe for period comparison"),
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

			// 4. Build options
			const options: {
				date?: string;
				periods?: number;
				timeframe?: "MONTH" | "QUARTER" | "YEAR";
			} = {};

			if (input.date) options.date = input.date;
			if (input.periods) options.periods = input.periods;
			if (input.timeframe) options.timeframe = input.timeframe;

			// 5. Call Xero API
			const report = await getBalanceSheet(client, options);

			return {
				success: true,
				tenantName: tenantBinding.externalTenantName,
				report: {
					reportID: report.ReportID,
					reportName: report.ReportName,
					reportDate: report.ReportDate,
					reportTitles: report.ReportTitles,
					rows: report.Rows,
				},
			};
		} catch (error: unknown) {
			console.error("Failed to fetch Xero Balance Sheet:", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			if (errorMessage.includes("401")) {
				return {
					error:
						"Xero authorization expired. Please reconnect in Settings > Integrations.",
				};
			}

			return { error: `Failed to retrieve Balance Sheet: ${errorMessage}` };
		}
	},
});
