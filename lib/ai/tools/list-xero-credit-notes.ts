import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroCreditNotes = tool({
	description:
		"Lists credit notes from Xero. Use this when the user asks about credit notes.",
	inputSchema: z.object({
		page: z
			.number()
			.int()
			.min(1)
			.optional()
			.describe(
				"Page number for pagination (default: 1). Each page returns up to 100 credit notes.",
			),
		contactIDs: z
			.array(z.string())
			.optional()
			.describe(
				"Filter by contact IDs. Returns only credit notes for these customers/suppliers.",
			),
		statuses: z
			.array(
				z.enum([
					"DRAFT",
					"SUBMITTED",
					"DELETED",
					"AUTHORISED",
					"PAID",
					"VOIDED",
				]),
			)
			.optional()
			.describe(
				"Filter by credit note status. Common statuses: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED.",
			),
		fromDate: z
			.string()
			.optional()
			.describe(
				"Filter credit notes modified after this date in YYYY-MM-DD format.",
			),
		toDate: z
			.string()
			.optional()
			.describe(
				"Filter credit notes modified before this date in YYYY-MM-DD format.",
			),
	}),
	execute: async ({ page = 1, contactIDs, statuses, fromDate, toDate }) => {
		try {
			const { userId, orgId } = await auth();

			if (!userId || !orgId) {
				return {
					error: "User must be logged in with an organization context",
				};
			}

			const binding = await db.query.integrationTenantBindings.findFirst({
				where: and(
					eq(integrationTenantBindings.clerkOrgId, orgId),
					eq(integrationTenantBindings.provider, "xero"),
					eq(integrationTenantBindings.status, "active"),
				),
			});

			if (!binding) {
				return {
					error:
						"Xero is not connected. Please connect Xero in Settings > Integrations first.",
				};
			}

			return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
				const params = new URLSearchParams();
				params.append("page", page.toString());

				if (contactIDs && contactIDs.length > 0) {
					params.append("ContactIDs", contactIDs.join(","));
				}
				if (statuses && statuses.length > 0) {
					params.append("Statuses", statuses.join(","));
				}

				const whereClauses: string[] = [];
				if (fromDate) {
					whereClauses.push(`Date >= DateTime(${fromDate})`);
				}
				if (toDate) {
					whereClauses.push(`Date <= DateTime(${toDate})`);
				}
				if (whereClauses.length > 0) {
					params.append("where", whereClauses.join(" AND "));
				}

				const queryString = params.toString();
				const endpoint = `/CreditNotes${queryString ? `?${queryString}` : ""}`;

				const response = await client.fetch(endpoint);

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to fetch credit notes from Xero: ${errorText}`,
					};
				}

				const data = await response.json();
				const creditNotes = data.CreditNotes || [];

				return {
					success: true,
					totalCreditNotes: creditNotes.length,
					page,
					creditNotes: creditNotes.map((cn: any) => ({
						creditNoteID: cn.CreditNoteID,
						creditNoteNumber: cn.CreditNoteNumber,
						contact: {
							contactID: cn.Contact?.ContactID,
							name: cn.Contact?.Name,
						},
						date: cn.Date,
						status: cn.Status,
						lineAmountTypes: cn.LineAmountTypes,
						subTotal: cn.SubTotal,
						totalTax: cn.TotalTax,
						total: cn.Total,
						currencyCode: cn.CurrencyCode,
						reference: cn.Reference,
						type: cn.Type,
						remainingCredit: cn.RemainingCredit,
						allocations: cn.Allocations,
					})),
					hasMore: creditNotes.length === 100,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, {
				toolName: "listXeroCreditNotes",
				operation: "fetching credit notes",
			});
		}
	},
});
