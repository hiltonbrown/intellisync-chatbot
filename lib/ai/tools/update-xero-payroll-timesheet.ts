import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const updateXeroPayrollTimesheet = tool({
	description: "Updates a payroll timesheet in Xero (status, lines).",
	inputSchema: z.object({
		timesheetID: z.string(),
		status: z.enum(["DRAFT", "PROCESSED", "APPROVED", "REJECTED"]).optional(),
		timesheetLines: z.array(z.object({
			earningsRateID: z.string().optional(),
			trackingItemID: z.string().optional(),
			numberOfUnits: z.array(z.number()).describe("Array of units (hours) for each day"),
		})).optional(),
	}),
	execute: async ({ timesheetID, status, timesheetLines }) => {
		try {
			const { userId, orgId } = await auth();
			if (!userId || !orgId) return { error: "Unauthorized" };

			const binding = await db.query.integrationTenantBindings.findFirst({
				where: and(
					eq(integrationTenantBindings.clerkOrgId, orgId),
					eq(integrationTenantBindings.provider, "xero"),
					eq(integrationTenantBindings.status, "active"),
				),
			});
			if (!binding) return { error: "Xero not connected" };

			return await withTokenRefreshRetry(
				binding.id,
				orgId,
				async (client) => {
					const timesheetData: any = {
						TimesheetID: timesheetID,
						Status: status,
					};

					if (timesheetLines) {
						timesheetData.TimesheetLines = timesheetLines.map(line => ({
							EarningsRateID: line.earningsRateID,
							TrackingItemID: line.trackingItemID,
							NumberOfUnits: line.numberOfUnits,
						}));
					}

					const response = await client.fetch(`/Timesheets/${timesheetID}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify([timesheetData]),
					});

					if (!response.ok) return { error: await response.text() };

					const data = await response.json();
					return {
						success: true,
						timesheet: data.Timesheets?.[0],
					};
				},
				"https://api.xero.com/payroll.xro/1.0"
			);
		} catch (error) {
			return handleXeroToolError(error, { toolName: "updateXeroPayrollTimesheet", operation: "updating timesheet" });
		}
	},
});
