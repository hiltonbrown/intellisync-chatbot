import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroProfitAndLoss = tool({
	description:
		"Retrieves a Profit and Loss (P&L) report from Xero. This provides a summary of revenue, expenses, and profit or loss over a specified period of time. Use this when the user asks for financial performance, income statement, or P&L data.",
	inputSchema: z.object({
		fromDate: z
			.string()
			.optional()
			.describe(
				"Start date for the report in YYYY-MM-DD format (e.g., '2024-01-01'). If not provided, uses the start of the current financial year.",
			),
		toDate: z
			.string()
			.optional()
			.describe(
				"End date for the report in YYYY-MM-DD format (e.g., '2024-12-31'). If not provided, uses today's date.",
			),
		periods: z
			.number()
			.int()
			.min(1)
			.max(12)
			.optional()
			.describe(
				"Number of periods to compare (e.g., 3 for quarterly comparison). Creates columns for each period.",
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
		fromDate,
		toDate,
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
			return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
				// Build query parameters
				const params = new URLSearchParams();
				if (fromDate) params.append("fromDate", fromDate);
				if (toDate) params.append("toDate", toDate);
				if (periods) params.append("periods", periods.toString());
				if (timeframe) params.append("timeframe", timeframe);
				if (standardLayout !== undefined)
					params.append("standardLayout", standardLayout.toString());
				if (paymentsOnly !== undefined)
					params.append("paymentsOnly", paymentsOnly.toString());

				const queryString = params.toString();
				const endpoint = `/Reports/ProfitAndLoss${queryString ? `?${queryString}` : ""}`;

				// Fetch P&L report from Xero
				const response = await client.fetch(endpoint);

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to fetch Profit and Loss report from Xero: ${errorText}`,
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
				const formattedRows = formatProfitAndLossRows(report.Rows || []);

				return {
					success: true,
					reportName: report.ReportName,
					reportType: report.ReportType,
					reportDate: report.ReportDate,
					reportTitles: report.ReportTitles || [],
					updatedDateUTC: report.UpdatedDateUTC,
					dateRange: `${fromDate || "Start of FY"} to ${toDate || "Today"}`,
					currency: binding.externalTenantName
						? `Report for: ${binding.externalTenantName}`
						: undefined,
					data: formattedRows,
					summary:
						"Profit and Loss report retrieved successfully. The report shows revenue, cost of sales, expenses, and net profit/loss.",
				};
			});
		} catch (error) {
			return handleXeroToolError(error, {
				toolName: "listXeroProfitAndLoss",
				operation: "fetching Profit and Loss report",
			});
		}
	},
});

// Helper function to format P&L rows for better readability
function formatProfitAndLossRows(rows: any[]): any[] {
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
				rows: formatProfitAndLossRows(row.Rows || []),
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
