import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroAgedPayables = tool({
	description: "Retrieves Aged Payables by Contact report from Xero.",
	inputSchema: z.object({
		contactId: z.string().optional(),
		date: z.string().optional().describe("YYYY-MM-DD"),
		fromDate: z.string().optional().describe("YYYY-MM-DD"),
		toDate: z.string().optional().describe("YYYY-MM-DD"),
	}),
	execute: async ({ contactId, date, fromDate, toDate }) => {
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
				if (contactId) params.append("contactId", contactId);
				if (date) params.append("date", date);
				if (fromDate) params.append("fromDate", fromDate);
				if (toDate) params.append("toDate", toDate);

				const response = await client.fetch(`/Reports/AgedPayablesByContact?${params.toString()}`);

				const data = await response.json();
				return {
					success: true,
					report: data.Reports?.[0],
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroAgedPayables", operation: "fetching aged payables" });
		}
	},
});
