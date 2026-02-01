import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const createXeroPayrollTimesheet = tool({
	description: "Creates a new payroll timesheet in Xero.",
	inputSchema: z.object({
		employeeID: z.string(),
		startDate: z.string().describe("YYYY-MM-DD"),
		endDate: z.string().describe("YYYY-MM-DD"),
		status: z.enum(["DRAFT", "PROCESSED", "APPROVED", "REJECTED"]).optional(),
		timesheetLines: z.array(z.object({
			earningsRateID: z.string().optional(),
			trackingItemID: z.string().optional(),
			numberOfUnits: z.array(z.number()).describe("Array of units (hours) for each day in the period"),
		})).optional(),
	}),
	execute: async ({ employeeID, startDate, endDate, status = "DRAFT", timesheetLines }) => {
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
					const timesheetData = {
						EmployeeID: employeeID,
						StartDate: startDate,
						EndDate: endDate,
						Status: status,
						TimesheetLines: timesheetLines?.map(line => ({
							EarningsRateID: line.earningsRateID,
							TrackingItemID: line.trackingItemID,
							NumberOfUnits: line.numberOfUnits,
						})),
					};

					const response = await client.fetch("/Timesheets", {
						method: "POST", // Xero Payroll uses POST for creation
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify([timesheetData]), // Often expects an array
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
			return handleXeroToolError(error, { toolName: "createXeroPayrollTimesheet", operation: "creating timesheet" });
		}
	},
});
