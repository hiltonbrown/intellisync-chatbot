"use server";

import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq, gte, isNotNull, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	integrationTenantBindings,
	xeroContacts,
	xeroInvoices,
} from "@/lib/db/schema";

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
	const now = new Date();
	const buckets = await db
		.select({
			current: sql<number>`sum(case when ${xeroInvoices.dueDate} >= now() then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue1to30: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '1 day' and interval '30 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue31to60: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '31 days' and interval '60 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue61to90: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} between interval '61 days' and interval '90 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
			overdue90plus: sql<number>`sum(case when now() - ${xeroInvoices.dueDate} > interval '90 days' then cast(${xeroInvoices.amountDue} as numeric) else 0 end)`,
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
		days30: Number(buckets[0]?.overdue1to30 || 0),
		days60: Number(buckets[0]?.overdue31to60 || 0),
		days90: Number(buckets[0]?.overdue61to90 || 0),
		days90plus: Number(buckets[0]?.overdue90plus || 0),
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

	// Group invoices by contact
	const rows = await db
		.select({
			contactId: xeroInvoices.contactId,
			contactName: xeroContacts.name,
			totalDue: sql<number>`sum(cast(${xeroInvoices.amountDue} as numeric))`,
			invoiceCount: count(xeroInvoices.id),
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

	return rows.map((r) => ({
		id: r.contactId!,
		name: r.contactName || "Unknown",
		totalDue: Number(r.totalDue),
		invoiceCount: Number(r.invoiceCount),
	}));
}
