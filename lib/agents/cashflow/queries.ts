import "server-only";

import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	cashflowAdjustments,
	xeroBills,
	xeroInvoices,
	xeroTransactions,
} from "@/lib/db/schema";

export async function getCashflowDashboardData(period: number = 30) {
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

	// Dates
	const today = new Date();
	const futureDate = new Date();
	futureDate.setDate(today.getDate() + period);

	// 1. Projected Debtors (Inflow)
	const debtors = await db
		.select({
			total: sql<number>`sum(cast(${xeroInvoices.amountDue} as numeric))`,
		})
		.from(xeroInvoices)
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, tenantId),
				eq(xeroInvoices.status, "AUTHORISED"),
				gte(xeroInvoices.dueDate, today),
				lte(xeroInvoices.dueDate, futureDate),
			),
		);
	const projectedDebtors = Number(debtors[0]?.total || 0);

	// 2. Projected Creditors (Outflow)
	const creditors = await db
		.select({
			total: sql<number>`sum(cast(${xeroBills.amountDue} as numeric))`,
		})
		.from(xeroBills)
		.where(
			and(
				eq(xeroBills.xeroTenantId, tenantId),
				eq(xeroBills.status, "AUTHORISED"),
				gte(xeroBills.dueDate, today),
				lte(xeroBills.dueDate, futureDate),
			),
		);
	const projectedCreditors = Number(creditors[0]?.total || 0);

	// 3. Projected Adjustments
	const adjIn = await db
		.select({ total: sql<number>`sum(amount)` })
		.from(cashflowAdjustments)
		.where(
			and(
				eq(cashflowAdjustments.xeroTenantId, tenantId),
				gte(cashflowAdjustments.date, today),
				lte(cashflowAdjustments.date, futureDate),
				eq(cashflowAdjustments.type, "IN"),
			),
		);
	const adjOut = await db
		.select({ total: sql<number>`sum(amount)` })
		.from(cashflowAdjustments)
		.where(
			and(
				eq(cashflowAdjustments.xeroTenantId, tenantId),
				gte(cashflowAdjustments.date, today),
				lte(cashflowAdjustments.date, futureDate),
				eq(cashflowAdjustments.type, "OUT"),
			),
		);

	const totalGainLoss =
		projectedDebtors +
		Number(adjIn[0]?.total || 0) -
		(projectedCreditors + Number(adjOut[0]?.total || 0));

	return {
		summary: {
			debtorsOwing: projectedDebtors,
			creditorsOwing: projectedCreditors,
			netCashflow: totalGainLoss,
		},
	};
}

export async function getCashflowChartData() {
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
	const tenantId = binding.externalTenantId;

	// Historical (Last 90 days)
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	// Fetch raw transactions to perform deduplication logic in JS
	const rawTransactions = await db
		.select({
			date: xeroTransactions.date,
			amount: xeroTransactions.amount,
			type: xeroTransactions.type,
			source: xeroTransactions.source,
			xeroId: xeroTransactions.xeroId,
		})
		.from(xeroTransactions)
		.where(
			and(
				eq(xeroTransactions.xeroTenantId, tenantId),
				gte(xeroTransactions.date, ninetyDaysAgo),
				lte(xeroTransactions.date, new Date()),
			),
		);

	// Deduplication Logic: Prioritise BANK_TRANS over PAYMENT
	// Group by Date + Amount + Type + XeroId (more robust key)
	const uniqueTrans = new Map<string, (typeof rawTransactions)[0]>();

	for (const t of rawTransactions) {
		if (!t.date || !t.amount) continue;

		// Enhanced key including xeroId for better uniqueness
		const dateStr = t.date.toISOString().split("T")[0];
		const key = `${dateStr}_${t.amount}_${t.type}_${t.xeroId || ""}`;

		const existing = uniqueTrans.get(key);
		if (existing) {
			// If existing is PAYMENT and new is BANK_TRANS, replace it
			if (existing.source === "PAYMENT" && t.source === "BANK_TRANS") {
				uniqueTrans.set(key, t);
			}
			// If existing is BANK_TRANS, keep it (ignore new PAYMENT)
		} else {
			uniqueTrans.set(key, t);
		}
	}

	// Aggregate deduplicated transactions by day
	const historicalAgg = new Map<string, { in: number; out: number }>();

	uniqueTrans.forEach((t) => {
		if (!t.date) return;
		const dateStr = t.date.toISOString().split("T")[0];
		const entry = historicalAgg.get(dateStr) || { in: 0, out: 0 };

		const amount = Number(t.amount);
		if (t.type === "RECEIVE") entry.in += amount;
		else if (t.type === "SPEND") entry.out += amount;

		historicalAgg.set(dateStr, entry);
	});

	// Projected (Next 90 days)
	// Future Invoices
	const invoices = await db
		.select({
			date: sql<string>`to_char(${xeroInvoices.dueDate}, 'YYYY-MM-DD')`,
			amount: sql<number>`sum(cast(${xeroInvoices.amountDue} as numeric))`,
		})
		.from(xeroInvoices)
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, tenantId),
				eq(xeroInvoices.status, "AUTHORISED"),
				gte(xeroInvoices.dueDate, new Date()),
			),
		)
		.groupBy(sql`to_char(${xeroInvoices.dueDate}, 'YYYY-MM-DD')`);

	// Future Bills
	const bills = await db
		.select({
			date: sql<string>`to_char(${xeroBills.dueDate}, 'YYYY-MM-DD')`,
			amount: sql<number>`sum(cast(${xeroBills.amountDue} as numeric))`,
		})
		.from(xeroBills)
		.where(
			and(
				eq(xeroBills.xeroTenantId, tenantId),
				eq(xeroBills.status, "AUTHORISED"),
				gte(xeroBills.dueDate, new Date()),
			),
		)
		.groupBy(sql`to_char(${xeroBills.dueDate}, 'YYYY-MM-DD')`);

	// Adjustments
	const adjustments = await db
		.select({
			date: sql<string>`to_char(${cashflowAdjustments.date}, 'YYYY-MM-DD')`,
			amount: sql<number>`sum(amount)`,
			type: cashflowAdjustments.type,
		})
		.from(cashflowAdjustments)
		.where(
			and(
				eq(cashflowAdjustments.xeroTenantId, tenantId),
				gte(cashflowAdjustments.date, new Date()),
			),
		)
		.groupBy(
			sql`to_char(${cashflowAdjustments.date}, 'YYYY-MM-DD')`,
			cashflowAdjustments.type,
		);

	// Merge logic
	const dataMap = new Map<
		string,
		{
			date: string;
			historicalIn: number;
			historicalOut: number;
			projectedIn: number;
			projectedOut: number;
		}
	>();

	// Fill History
	historicalAgg.forEach((val, dateStr) => {
		const entry = dataMap.get(dateStr) || {
			date: dateStr,
			historicalIn: 0,
			historicalOut: 0,
			projectedIn: 0,
			projectedOut: 0,
		};
		entry.historicalIn = val.in;
		entry.historicalOut = val.out;
		dataMap.set(dateStr, entry);
	});

	// Fill Projected
	invoices.forEach((i) => {
		if (!i.date) return;
		const entry = dataMap.get(i.date) || {
			date: i.date,
			historicalIn: 0,
			historicalOut: 0,
			projectedIn: 0,
			projectedOut: 0,
		};
		entry.projectedIn += Number(i.amount);
		dataMap.set(i.date, entry);
	});

	bills.forEach((b) => {
		if (!b.date) return;
		const entry = dataMap.get(b.date) || {
			date: b.date,
			historicalIn: 0,
			historicalOut: 0,
			projectedIn: 0,
			projectedOut: 0,
		};
		entry.projectedOut += Number(b.amount);
		dataMap.set(b.date, entry);
	});

	adjustments.forEach((a) => {
		if (!a.date) return;
		const entry = dataMap.get(a.date) || {
			date: a.date,
			historicalIn: 0,
			historicalOut: 0,
			projectedIn: 0,
			projectedOut: 0,
		};
		if (a.type === "IN") entry.projectedIn += Number(a.amount);
		else entry.projectedOut += Number(a.amount);
		dataMap.set(a.date, entry);
	});

	return Array.from(dataMap.values()).sort((a, b) =>
		a.date.localeCompare(b.date),
	);
}

export async function getCalendarEvents() {
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
	const tenantId = binding.externalTenantId;

	const today = new Date();

	// Upcoming AR
	const arEvents = await db
		.select({
			id: xeroInvoices.id,
			date: xeroInvoices.dueDate,
			amount: xeroInvoices.amountDue,
			title: sql<string>`'Invoice #' || ${xeroInvoices.xeroInvoiceId}`,
			type: sql<string>`'IN'`,
		})
		.from(xeroInvoices)
		.where(
			and(
				eq(xeroInvoices.xeroTenantId, tenantId),
				eq(xeroInvoices.status, "AUTHORISED"),
				gte(xeroInvoices.dueDate, today),
			),
		);

	// Upcoming AP
	const apEvents = await db
		.select({
			id: xeroBills.id,
			date: xeroBills.dueDate,
			amount: xeroBills.amountDue,
			title: sql<string>`'Bill #' || ${xeroBills.xeroBillId}`,
			type: sql<string>`'OUT'`,
		})
		.from(xeroBills)
		.where(
			and(
				eq(xeroBills.xeroTenantId, tenantId),
				eq(xeroBills.status, "AUTHORISED"),
				gte(xeroBills.dueDate, today),
			),
		);

	// Upcoming Adjustments
	const adjEvents = await db
		.select({
			id: cashflowAdjustments.id,
			date: cashflowAdjustments.date,
			amount: cashflowAdjustments.amount,
			title: cashflowAdjustments.description,
			type: cashflowAdjustments.type,
		})
		.from(cashflowAdjustments)
		.where(
			and(
				eq(cashflowAdjustments.xeroTenantId, tenantId),
				gte(cashflowAdjustments.date, today),
			),
		);

	return [...arEvents, ...apEvents, ...adjEvents]
		.map((e) => ({
			id: e.id,
			date: e.date,
			amount: Number(e.amount),
			title: e.title,
			type: e.type, // IN/OUT
		}))
		.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
}
