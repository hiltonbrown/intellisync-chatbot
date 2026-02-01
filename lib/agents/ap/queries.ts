import "server-only";

import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { xeroBills, xeroSuppliers } from "@/lib/db/schema";
import { calculateVendorRisk } from "./risk-scoring";
import type { RiskLevel } from "./risk-scoring";

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
			currentCount: sql<number>`sum(case when ${xeroBills.dueDate} >= now() then 1 else 0 end)`,
			overdue1to30: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '1 day' and interval '30 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue1to30Count: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '1 day' and interval '30 days' then 1 else 0 end)`,
			overdue31to60: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '31 days' and interval '60 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue31to60Count: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '31 days' and interval '60 days' then 1 else 0 end)`,
			overdue61to90: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '61 days' and interval '90 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue61to90Count: sql<number>`sum(case when now() - ${xeroBills.dueDate} between interval '61 days' and interval '90 days' then 1 else 0 end)`,
			overdue90plus: sql<number>`sum(case when now() - ${xeroBills.dueDate} > interval '90 days' then cast(${xeroBills.amountDue} as numeric) else 0 end)`,
			overdue90plusCount: sql<number>`sum(case when now() - ${xeroBills.dueDate} > interval '90 days' then 1 else 0 end)`,
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
			// Risk scoring fields
			taxNumber: xeroSuppliers.taxNumber,
			contactStatus: xeroSuppliers.contactStatus,
			supplierBankAccount: xeroSuppliers.bankAccountNumber,
			// Aggregate bill-level fields (using MAX to get any value since we're grouping)
			invoiceNumber: sql<string>`MAX(${xeroBills.invoiceNumber})`,
			billStatus: sql<string>`MAX(${xeroBills.status})`,
			billBankAccount: sql<string>`MAX(${xeroBills.billBankAccountNumber})`,
		})
		.from(xeroBills)
		.leftJoin(xeroSuppliers, eq(xeroBills.supplierId, xeroSuppliers.id))
		.where(
			and(
				eq(xeroBills.xeroTenantId, binding.externalTenantId),
				sql`cast(${xeroBills.amountDue} as numeric) > 0`,
				eq(xeroBills.status, "AUTHORISED"),
				isNotNull(xeroBills.supplierId),
			),
		)
		.groupBy(
			xeroBills.supplierId,
			xeroSuppliers.name,
			xeroSuppliers.taxNumber,
			xeroSuppliers.contactStatus,
			xeroSuppliers.bankAccountNumber,
		)
		.orderBy(desc(sql`sum(cast(${xeroBills.amountDue} as numeric))`));

	return rows
		.filter((r) => r.supplierId !== null)
		.map((r) => {
			// Calculate risk for this vendor
			const risk = calculateVendorRisk({
				taxNumber: r.taxNumber,
				invoiceNumber: r.invoiceNumber,
				billStatus: r.billStatus,
				contactStatus: r.contactStatus,
				supplierBankAccount: r.supplierBankAccount,
				billBankAccount: r.billBankAccount,
			});

			return {
				id: r.supplierId as string, // Already filtered for non-null
				name: r.supplierName || "Unknown",
				totalDue: Number(r.totalDue),
				billCount: Number(r.billCount),
				current: Number(r.current || 0),
				days30: Number(r.overdue1to30 || 0),
				days60: Number(r.overdue31to60 || 0),
				days90: Number(r.overdue61to90 || 0),
				days90plus: Number(r.overdue90plus || 0),
				riskScore: risk.riskScore,
				riskLevel: risk.riskLevel,
				hasBankChange: risk.hasBankChange,
				riskFactors: risk.riskFactors,
			};
		});
}
