import "server-only";

import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { xeroContacts, xeroInvoices } from "@/lib/db/schema";

interface Invoice {
	total: number;
	dueDate: Date | null;
}

/**
 * Calculate customer risk score based on AR agent logic
 * @param invoices - Array of invoices for the customer
 * @returns Risk score between 0.05 and 0.95
 */
function calculateRiskScore(invoices: Invoice[]): number {
	// Base risk
	let score = 0.1;

	const now = new Date();
	let hasHighValueInvoice = false;

	// Iterate through all invoices
	for (const invoice of invoices) {
		// Check for high value invoices (> $10,000)
		if (invoice.total > 10000) {
			hasHighValueInvoice = true;
		}

		// Calculate overdue factor
		if (invoice.dueDate) {
			const daysOverdue = Math.max(
				0,
				Math.floor(
					(now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
				),
			);

			if (daysOverdue > 0) {
				// Calculate penalty: (daysOverdue / 30) * 0.5, capped at 0.6
				const penalty = Math.min((daysOverdue / 30) * 0.5, 0.6);
				score += penalty;
			}
		}
	}

	// Add high value factor
	if (hasHighValueInvoice) {
		score += 0.1;
	}

	// Clamp between 0.05 and 0.95
	return Math.max(0.05, Math.min(0.95, score));
}

/**
 * Determine follow-up tone based on maximum days overdue
 * @param invoices - Array of invoices for the customer
 * @returns Tone classification: "Polite", "Firm", or "Final"
 */
function getFollowUpTone(invoices: Invoice[]): string {
	const now = new Date();
	let maxDaysOverdue = 0;

	for (const invoice of invoices) {
		if (invoice.dueDate) {
			const daysOverdue = Math.max(
				0,
				Math.floor(
					(now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
				),
			);
			maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
		}
	}

	if (maxDaysOverdue >= 60) return "Final";
	if (maxDaysOverdue >= 30) return "Firm";
	return "Polite";
}

export async function getArDashboardData() {
	const { orgId } = await auth();
	if (!orgId) return null;

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (t, { and, eq }) =>
			and(
				eq(t.clerkOrgId, orgId),
				eq(t.status, "active"),
				eq(t.provider, "xero"),
			),
	});

	if (!binding) return null; // No data state

	const tenantId = binding.externalTenantId;

	// 1. Total Outstanding & Count
	const summary = await db
		.select({
			totalOutstanding: sql<number>`sum(cast(${xeroInvoices.amountDue} as numeric))`,
			countOutstanding: count(xeroInvoices.id),
		})
		.from(xeroInvoices)
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, tenantId),
				sql`cast(${xeroInvoices.amountDue} as numeric) > 0`,
				eq(xeroInvoices.status, "AUTHORISED"),
			),
		);

	const totalOutstanding = Number(summary[0]?.totalOutstanding || 0);
	const countOutstanding = Number(summary[0]?.countOutstanding || 0);

	// 2. DSO Calculation (Last 90 Days)
	// DSO = (Total AR / Total Credit Sales) * 90
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	const salesSummary = await db
		.select({
			totalSales: sql<number>`sum(cast(${xeroInvoices.total} as numeric))`,
		})
		.from(xeroInvoices)
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, tenantId),
				gte(xeroInvoices.date, ninetyDaysAgo),
				eq(xeroInvoices.type, "ACCREC"),
			),
		);

	const totalSales = Number(salesSummary[0]?.totalSales || 0);
	const dso = totalSales > 0 ? (totalOutstanding / totalSales) * 90 : 0;

	// 3. Ageing Breakdown
	const buckets = await db
		.select({
			current: sql<number>`sum(case when ${xeroInvoices.dueDate} >= now() then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			currentCount: sql<number>`sum(case when ${xeroInvoices.dueDate} >= now() then 1 else 0 end)`,
			overdue1to30: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '1 day' and interval '30 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue1to30Count: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '1 day' and interval '30 days' then 1 else 0 end)`,
			overdue31to60: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '31 days' and interval '60 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue31to60Count: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '31 days' and interval '60 days' then 1 else 0 end)`,
			overdue61to90: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '61 days' and interval '90 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue61to90Count: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '61 days' and interval '90 days' then 1 else 0 end)`,
			overdue90plus: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} > interval '90 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue90plusCount: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} > interval '90 days' then 1 else 0 end)`,
		})
		.from(xeroInvoices)
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, tenantId),
				sql`cast(${xeroInvoices.amountDue} as numeric) > 0`,
				eq(xeroInvoices.status, "AUTHORISED"),
			),
		);

	const ageing = {
		current: Number(buckets[0]?.current || 0),
		currentCount: Number(buckets[0]?.currentCount || 0),
		days30: Number(buckets[0]?.overdue1to30 || 0),
		days30Count: Number(buckets[0]?.overdue1to30Count || 0),
		days60: Number(buckets[0]?.overdue31to60 || 0),
		days60Count: Number(buckets[0]?.overdue31to60Count || 0),
		days90: Number(buckets[0]?.overdue61to90 || 0),
		days90Count: Number(buckets[0]?.overdue61to90Count || 0),
		days90plus: Number(buckets[0]?.overdue90plus || 0),
		days90plusCount: Number(buckets[0]?.overdue90plusCount || 0),
	};

	return {
		summary: {
			totalOutstanding,
			countOutstanding,
			dso: Math.round(dso),
		},
		ageing,
	};
}

export async function getCustomerList() {
	const { orgId } = await auth();
	if (!orgId) return [];

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (t, { and, eq }) =>
			and(
				eq(t.clerkOrgId, orgId),
				eq(t.status, "active"),
				eq(t.provider, "xero"),
			),
	});

	if (!binding) return [];

	// First, get ageing breakdown for each customer
	const ageingRows = await db
		.select({
			contactId: xeroInvoices.contactId,
			contactName: xeroContacts.name,
			totalDue: sql<number>`sum(cast(${xeroInvoices.amountDue} as numeric))`,
			invoiceCount: count(xeroInvoices.id),
			current: sql<number>`sum(case when ${xeroInvoices.dueDate} >= now() then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			days30: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '1 day' and interval '30 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			days60: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '31 days' and interval '60 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			days90: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '61 days' and interval '90 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			days90plus: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} > interval '90 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
		})
		.from(xeroInvoices)
		.leftJoin(xeroContacts, eq(xeroInvoices.contactId, xeroContacts.id))
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, binding.externalTenantId),
				sql`cast(${xeroInvoices.amountDue} as numeric) > 0`,
				eq(xeroInvoices.status, "AUTHORISED"),
				isNotNull(xeroInvoices.contactId),
			),
		)
		.groupBy(xeroInvoices.contactId, xeroContacts.name)
		.orderBy(desc(sql`sum(cast(${xeroInvoices.amountDue} as numeric))`));

	// Get all outstanding invoices for risk calculation
	const allInvoices = await db
		.select({
			contactId: xeroInvoices.contactId,
			total: xeroInvoices.total,
			dueDate: xeroInvoices.dueDate,
		})
		.from(xeroInvoices)
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, binding.externalTenantId),
				sql`cast(${xeroInvoices.amountDue} as numeric) > 0`,
				eq(xeroInvoices.status, "AUTHORISED"),
				isNotNull(xeroInvoices.contactId),
			),
		);

	// Group invoices by contact
	const invoicesByContact = new Map<string, Invoice[]>();
	for (const inv of allInvoices) {
		if (!inv.contactId) continue;
		if (!invoicesByContact.has(inv.contactId)) {
			invoicesByContact.set(inv.contactId, []);
		}
		invoicesByContact.get(inv.contactId)?.push({
			total: Number(inv.total || 0),
			dueDate: inv.dueDate,
		});
	}

	return ageingRows
		.filter((r) => r.contactId !== null)
		.map((r) => {
			const contactId = r.contactId!;
			const totalDue = Number(r.totalDue);
			const current = Number(r.current || 0);
			const days30 = Number(r.days30 || 0);
			const days60 = Number(r.days60 || 0);
			const days90 = Number(r.days90 || 0);
			const days90plus = Number(r.days90plus || 0);

			// Get invoices for this customer
			const customerInvoices = invoicesByContact.get(contactId) || [];

			// Calculate risk score using the new formula
			const riskScore = calculateRiskScore(customerInvoices);

			// Determine follow-up tone
			const followUpTone = getFollowUpTone(customerInvoices);

			return {
				id: contactId,
				name: r.contactName || "Unknown",
				totalDue,
				invoiceCount: Number(r.invoiceCount),
				current,
				days30,
				days60,
				days90,
				days90plus,
				riskScore: Number.parseFloat(riskScore.toFixed(2)),
				followUpTone,
			};
		});
}
