import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroItems = tool({
	description: "Lists items (products/services) from Xero.",
	inputSchema: z.object({
		code: z.string().optional().describe("Filter by item code"),
	}),
	execute: async ({ code }) => {
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
				const whereClauses: string[] = [];
				if (code) whereClauses.push(`Code=="${code}"`);

				const params = new URLSearchParams();
				if (whereClauses.length > 0) {
					params.append("where", whereClauses.join(" AND "));
				}

				const response = await client.fetch(`/Items?${params.toString()}`);
				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					items: data.Items,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroItems", operation: "fetching items" });
		}
	},
});
