import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroTaxRates = tool({
	description: "Lists tax rates from Xero.",
	inputSchema: z.object({
		taxType: z.string().optional().describe("Filter by tax type (e.g. OUTPUT2)"),
	}),
	execute: async ({ taxType }) => {
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
				if (taxType) whereClauses.push(`TaxType=="${taxType}"`);

				const params = new URLSearchParams();
				if (whereClauses.length > 0) {
					params.append("where", whereClauses.join(" AND "));
				}

				const response = await client.fetch(`/TaxRates?${params.toString()}`);
				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					taxRates: data.TaxRates,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroTaxRates", operation: "fetching tax rates" });
		}
	},
});
