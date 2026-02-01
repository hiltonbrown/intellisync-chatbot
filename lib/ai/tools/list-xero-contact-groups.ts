import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroContactGroups = tool({
	description: "Lists contact groups from Xero.",
	inputSchema: z.object({
		page: z.number().int().min(1).optional(),
		name: z.string().optional().describe("Filter by group name"),
	}),
	execute: async ({ page = 1, name }) => {
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
				params.append("page", page.toString());
				if (name) params.append("where", `Name=="${name}"`);

				const response = await client.fetch(`/ContactGroups?${params.toString()}`);
				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					contactGroups: data.ContactGroups,
					page,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroContactGroups", operation: "fetching contact groups" });
		}
	},
});
