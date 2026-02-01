import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const getXeroPayrollTimesheet = tool({
	description: "Retrieves a specific payroll timesheet from Xero.",
	inputSchema: z.object({
		timesheetID: z.string(),
	}),
	execute: async ({ timesheetID }) => {
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
					const response = await client.fetch(`/Timesheets/${timesheetID}`);
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
			return handleXeroToolError(error, { toolName: "getXeroPayrollTimesheet", operation: "fetching timesheet" });
		}
	},
});
