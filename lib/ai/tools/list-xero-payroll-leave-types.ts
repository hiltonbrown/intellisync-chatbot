import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroPayrollLeaveTypes = tool({
	description: "Lists leave types from Xero Payroll.",
	inputSchema: z.object({}),
	execute: async () => {
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
					const response = await client.fetch("/PayItems");
					if (!response.ok) return { error: await response.text() };

					const data = await response.json();
					return {
						success: true,
						leaveTypes: data.PayItems?.LeaveTypes || [],
					};
				},
				"https://api.xero.com/payroll.xro/1.0"
			);
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroPayrollLeaveTypes", operation: "fetching leave types" });
		}
	},
});
