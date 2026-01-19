import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";

export const listXeroBalanceSheet = tool({
	description:
		"Retrieves a Balance Sheet report from Xero. Shows the financial position of the business including assets, liabilities, and equity at a specific point in time. Use this when the user asks about the balance sheet, financial position, assets, liabilities, or equity.",
	inputSchema: z.object({
		date: z
			.string()
			.optional()
			.describe(
				"Report date in YYYY-MM-DD format (e.g., '2024-12-31'). If not provided, uses today's date.",
			),
		periods: z
			.number()
			.int()
			.min(1)
			.max(12)
			.optional()
			.describe(
				"Number of periods to compare (e.g., 2 for two-period comparison). Creates columns for each period.",
			),
		timeframe: z
			.enum(["MONTH", "QUARTER", "YEAR"])
			.optional()
			.describe(
				"Timeframe for period comparison. MONTH shows monthly columns, QUARTER shows quarterly, YEAR shows annual. Only used when periods is specified.",
			),
		standardLayout: z
			.boolean()
			.optional()
			.describe(
				"Use standard chart of accounts layout instead of custom layout. Default is false.",
			),
		paymentsOnly: z
			.boolean()
			.optional()
			.describe(
				"Show only accounts with payments/transactions. Hides zero-balance accounts. Default is false.",
			),
	}),
	execute: async ({
		date,
		periods,
		timeframe,
		standardLayout,
		paymentsOnly,
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
			return await withTokenRefreshRetry(binding.id, async (client) => {
				// Build query parameters
				const params = new URLSearchParams();
				if (date) params.append("date", date);
				if (periods) params.append("periods", periods.toString());
				if (timeframe) params.append("timeframe", timeframe);
				if (standardLayout !== undefined)
					params.append("standardLayout", standardLayout.toString());
				if (paymentsOnly !== undefined)
					params.append("paymentsOnly", paymentsOnly.toString());

				const queryString = params.toString();
				const endpoint = `/Reports/BalanceSheet${queryString ? `?${queryString}` : ""}`;

				// Fetch Balance Sheet report from Xero
				const response = await client.fetch(endpoint);

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to fetch Balance Sheet report from Xero: ${errorText}`,
					};
				}

				const data = await response.json();
				const report = data.Reports?.[0];

				if (!report) {
					return {
						error: "No report data returned from Xero",
					};
				}

				// Parse and format the report data
				const formattedRows = formatBalanceSheetRows(report.Rows || []);

				return {
					success: true,
					reportName: report.ReportName,
					reportType: report.ReportType,
					reportDate: report.ReportDate,
					reportTitles: report.ReportTitles || [],
					updatedDateUTC: report.UpdatedDateUTC,
					asOfDate: date || "Today",
					currency: binding.externalTenantName
						? `Report for: ${binding.externalTenantName}`
						: undefined,
					data: formattedRows,
					summary:
						"Balance Sheet report retrieved successfully. The report shows assets, liabilities, and equity at a specific point in time.",
				};
			});
		} catch (error) {
			return handleXeroToolError(error, {
				toolName: "listXeroBalanceSheet",
				operation: "fetching Balance Sheet report",
			});
		}
	},
});

// Helper function to format Balance Sheet rows for better readability
function formatBalanceSheetRows(rows: any[]): any[] {
	return rows.map((row) => {
		if (row.RowType === "Header") {
			return {
				type: "Header",
				cells: row.Cells?.map((cell: any) => cell.Value) || [],
			};
		}

		if (row.RowType === "Section") {
			return {
				type: "Section",
				title: row.Title,
				rows: formatBalanceSheetRows(row.Rows || []),
			};
		}

		if (row.RowType === "Row") {
			return {
				type: "Row",
				cells:
					row.Cells?.map((cell: any) => ({
						value: cell.Value,
						attributes:
							cell.Attributes?.map((attr: any) => ({
								id: attr.Id,
								value: attr.Value,
							})) || [],
					})) || [],
			};
		}

		if (row.RowType === "SummaryRow") {
			return {
				type: "Summary",
				cells: row.Cells?.map((cell: any) => cell.Value) || [],
			};
		}

		return row;
	});
}
