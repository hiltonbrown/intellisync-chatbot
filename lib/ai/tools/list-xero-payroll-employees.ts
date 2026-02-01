import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroPayrollEmployees = tool({
	description: "Lists payroll employees from Xero.",
	inputSchema: z.object({
		page: z.number().int().min(1).optional(),
		status: z.enum(["ACTIVE", "TERMINATED"]).optional(),
	}),
	execute: async ({ page = 1, status }) => {
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
					const params = new URLSearchParams();
					params.append("page", page.toString());
					if (status) params.append("where", `Status=="${status}"`);

					const response = await client.fetch(`/Employees?${params.toString()}`);
					if (!response.ok) return { error: await response.text() };

					const data = await response.json();
					return {
						success: true,
						employees: data.Employees,
						page,
					};
				},
				"https://api.xero.com/payroll.xro/1.0"
			);
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroPayrollEmployees", operation: "fetching employees" });
		}
	},
});
