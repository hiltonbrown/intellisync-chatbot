import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroBankTransactions = tool({
	description: "Lists bank transactions from Xero.",
	inputSchema: z.object({
		page: z.number().int().min(1).optional(),
		type: z.enum(["RECEIVE", "SPEND"]).optional(),
		fromDate: z.string().optional(),
		toDate: z.string().optional(),
	}),
	execute: async ({ page = 1, type, fromDate, toDate }) => {
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
				if (type) whereClauses.push(`Type=="${type}"`);
				if (fromDate) whereClauses.push(`Date >= DateTime(${fromDate})`);
				if (toDate) whereClauses.push(`Date <= DateTime(${toDate})`);

				const params = new URLSearchParams();
				params.append("page", page.toString());
				if (whereClauses.length > 0) {
					params.append("where", whereClauses.join(" AND "));
				}

				const response = await client.fetch(`/BankTransactions?${params.toString()}`);
				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					transactions: data.BankTransactions,
					page,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroBankTransactions", operation: "fetching transactions" });
		}
	},
});
