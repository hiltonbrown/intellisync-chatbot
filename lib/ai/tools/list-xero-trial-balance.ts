import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroTrialBalance = tool({
	description: "Retrieves a Trial Balance report from Xero.",
	inputSchema: z.object({
		date: z.string().optional().describe("Date (YYYY-MM-DD)"),
		paymentsOnly: z.boolean().optional(),
	}),
	execute: async ({ date, paymentsOnly }) => {
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

			return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
				const params = new URLSearchParams();
				if (date) params.append("date", date);
				if (paymentsOnly) params.append("paymentsOnly", paymentsOnly.toString());

				const response = await client.fetch(`/Reports/TrialBalance?${params.toString()}`);
				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					report: data.Reports?.[0],
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroTrialBalance", operation: "fetching trial balance" });
		}
	},
});
