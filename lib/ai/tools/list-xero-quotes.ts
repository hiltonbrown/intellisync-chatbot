import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroQuotes = tool({
	description: "Lists quotes from Xero. Use this when the user asks about quotes.",
	inputSchema: z.object({
		page: z.number().int().min(1).optional().describe("Page number (default: 1)"),
		contactID: z.string().optional().describe("Filter by specific Contact ID"),
		status: z
			.enum(["DRAFT", "SENT", "DECLINED", "ACCEPTED", "INVOICED", "DELETED"])
			.optional()
			.describe("Filter by quote status"),
		dateFrom: z.string().optional().describe("Filter by date from (YYYY-MM-DD)"),
		dateTo: z.string().optional().describe("Filter by date to (YYYY-MM-DD)"),
	}),
	execute: async ({ page = 1, contactID, status, dateFrom, dateTo }) => {
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
				if (contactID) whereClauses.push(`Contact.ContactID==GUID("${contactID}")`);
				if (status) whereClauses.push(`Status=="${status}"`);
				if (dateFrom) whereClauses.push(`Date >= DateTime(${dateFrom})`);
				if (dateTo) whereClauses.push(`Date <= DateTime(${dateTo})`);

				const params = new URLSearchParams();
				params.append("page", page.toString());
				if (whereClauses.length > 0) {
					params.append("where", whereClauses.join(" AND "));
				}

				const response = await client.fetch(`/Quotes?${params.toString()}`);
				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					quotes: data.Quotes,
					page,
					count: data.Quotes?.length || 0,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "listXeroQuotes", operation: "fetching quotes" });
		}
	},
});
