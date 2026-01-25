import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	integrationTenantBindings,
	xeroBills,
	xeroSuppliers,
} from "@/lib/db/schema";

export async function getApDashboardData() {
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

	if (!binding) return null;

	const tenantId = binding.externalTenantId;

	// 1. Total Payable & Count
	const summary = await db
		.select({
			totalPayable: sql<number>`sum(cast(${xeroBills.amountDue} as numeric))`,
			countPayable: count(xeroBills.id),
		})
		.from(xeroBills)
		.where(
			and(
				eq(xeroBills.xeroTenantId, tenantId),
				sql`cast(${xeroBills.amountDue} as numeric) > 0`,
				eq(xeroBills.status, "AUTHORISED"),
			),
		);

	const totalPayable = Number(summary[0]?.totalPayable || 0);
	const countPayable = Number(summary[0]?.countPayable || 0);

	// 2. DPO Calculation (Last 90 Days)
	// DPO = (Total AP / Total Purchases) * 90
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	const purchasesSummary = await db
		.select({
			totalPurchases: sql<number>`sum(cast(${xeroBills.total} as numeric))`,
		})
		.from(xeroBills)
		.where(
			and(
				eq(xeroBills.xeroTenantId, tenantId),
				gte(xeroBills.date, ninetyDaysAgo),
				eq(xeroBills.type, "ACCPAY"),
			),
		);

	const totalPurchases = Number(purchasesSummary[0]?.totalPurchases || 0);
	const dpo = totalPurchases > 0 ? (totalPayable / totalPurchases) * 90 : 0;

	// 3. Ageing Breakdown
	const buckets = await db
		.select({
			current: sql<number>`sum(case when ${xeroBills.dueDate} >= now() then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue1to30: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '1 day' and interval '30 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue31to60: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '31 days' and interval '60 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue61to90: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '61 days' and interval '90 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue90plus: sql<number>`sum(case when now() - ${xeroBills.dueDate} > interval '90 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
		})
		.from(xeroBills)
		.where(
			and(
				eq(xeroBills.xeroTenantId, tenantId),
				sql`cast(${xeroBills.amountDue} as numeric) > 0`,
				eq(xeroBills.status, "AUTHORISED"),
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
			totalPayable,
			countPayable,
			dpo: Math.round(dpo),
		},
		ageing,
	};
}

export async function getVendorList() {
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

	const rows = await db
		.select({
			supplierId: xeroBills.supplierId,
			supplierName: xeroSuppliers.name,
			totalDue: sql<number>`sum(cast(${xeroBills.amountDue} as numeric))`,
			billCount: count(xeroBills.id),
            // Buckets per vendor for possible table display
            current: sql<number>`sum(case when ${xeroBills.dueDate} >= now() then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue1to30: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '1 day' and interval '30 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue31to60: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '31 days' and interval '60 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue61to90: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '61 days' and interval '90 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue90plus: sql<number>`sum(case when now() - ${xeroBills.dueDate} > interval '90 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
		})
		.from(xeroBills)
		.leftJoin(xeroSuppliers, eq(xeroBills.supplierId, xeroSuppliers.id))
		.where(
			and(
				eq(xeroBills.xeroTenantId, binding.externalTenantId),
				sql`cast(${xeroBills.amountDue} as numeric) > 0`,
				eq(xeroBills.status, "AUTHORISED"),
                isNotNull(xeroBills.supplierId)
			),
		)
		.groupBy(xeroBills.supplierId, xeroSuppliers.name)
		.orderBy(desc(sql`sum(cast(${xeroBills.amountDue} as numeric))`));

	return rows.map((r) => ({
		id: r.supplierId!,
		name: r.supplierName || "Unknown",
		totalDue: Number(r.totalDue),
		billCount: Number(r.billCount),
        buckets: {
            current: Number(r.current),
            days30: Number(r.overdue1to30),
            days60: Number(r.overdue31to60),
            days90: Number(r.overdue61to90),
            days90plus: Number(r.overdue90plus),
        }
	}));
}

export async function getVendorDetails(supplierId: string) {
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
	if (!binding) return null;

	const supplier = await db.query.xeroSuppliers.findFirst({
		where: (t, { and, eq }) =>
			and(eq(t.id, supplierId), eq(t.xeroTenantId, binding.externalTenantId)),
	});

	if (!supplier) return null;

	const bills = await db.query.xeroBills.findMany({
		where: (t, { and, eq }) =>
			and(
				eq(t.supplierId, supplierId),
				eq(t.xeroTenantId, binding.externalTenantId),
			),
		orderBy: (t, { desc }) => [desc(t.date)],
	});

	return {
		supplier,
		bills: bills.map((b) => ({
			...b,
			amountDue: Number(b.amountDue),
			amountPaid: Number(b.amountPaid),
			total: Number(b.total),
		})),
		risk: "TBD", // Placeholder as requested
	};
}
