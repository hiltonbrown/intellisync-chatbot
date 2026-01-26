"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
	integrationTenantBindings,
	xeroBills,
	xeroContacts,
	xeroInvoices,
	xeroSuppliers,
	xeroTransactions,
} from "@/lib/db/schema";
import { ExternalAPIError } from "@/lib/integrations/errors";
import { withTokenRefreshRetry } from "./retry-helper";
import { parseXeroDate } from "./utils";

// Define simplified Xero types
interface XeroContactResponse {
	Contacts: Array<{
		ContactID: string;
		Name: string;
		EmailAddress?: string;
		Phones?: Array<{ PhoneType: string; PhoneNumber: string }>;
	}>;
}

interface XeroInvoiceResponse {
	Invoices: Array<{
		InvoiceID: string;
		Contact: { ContactID: string };
		Type: string;
		Status: string;
		DateString?: string;
		DueDateString?: string;
		AmountDue: number;
		AmountPaid: number;
		Total: number;
		CurrencyCode: string;
		LineItems?: Array<{ Description?: string; LineAmount?: number }>;
	}>;
}

interface XeroBankTransactionResponse {
	BankTransactions: Array<{
		BankTransactionID: string;
		Type: string; // SPEND or RECEIVE
		Total: number;
		DateString?: string;
		LineItems?: Array<{ Description?: string; LineAmount?: number }>;
	}>;
}

interface XeroPaymentResponse {
	Payments: Array<{
		PaymentID: string;
		Date: string; // Typically YYYY-MM-DD
		Amount: number;
		PaymentType: string; // ACCREC PAYMENT or ACCPAY PAYMENT
		Reference?: string;
		Invoice?: { InvoiceID: string; Type: string }; // Depending on endpoint details
	}>;
}

export async function syncXeroData() {
	const { orgId } = await auth();
	if (!orgId) {
		throw new Error("No organization selected");
	}

	// Find active tenant binding for this org
	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (table, { and, eq }) =>
			and(
				eq(table.clerkOrgId, orgId),
				eq(table.status, "active"),
				eq(table.provider, "xero"),
			),
	});

	if (!binding) {
		throw new Error("No active Xero connection found");
	}

	return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
		// 1. Fetch Contacts
		const contactsRes = await client.fetch("/Contacts");
		if (!contactsRes.ok) {
			const errorBody = await contactsRes.text();
			throw new ExternalAPIError(
				"Failed to fetch Xero contacts",
				"xero",
				contactsRes.status,
				{ endpoint: "/Contacts", response: errorBody },
			);
		}
		const contactsData = (await contactsRes.json()) as XeroContactResponse;

		console.log(`Synced ${contactsData.Contacts.length} contacts`);

		// Batch Upsert Contacts
		if (contactsData.Contacts.length > 0) {
			await db
				.insert(xeroContacts)
				.values(
					contactsData.Contacts.map((contact) => ({
						xeroTenantId: binding.externalTenantId,
						xeroContactId: contact.ContactID,
						name: contact.Name,
						email: contact.EmailAddress,
						phone: contact.Phones?.find(
							(p) => p.PhoneType === "DEFAULT" || p.PhoneType === "MOBILE",
						)?.PhoneNumber,
					})),
				)
				.onConflictDoUpdate({
					target: [xeroContacts.xeroTenantId, xeroContacts.xeroContactId],
					set: {
						name: sql`excluded.name`,
						email: sql`excluded.email`,
						phone: sql`excluded.phone`,
						updatedAt: new Date(),
					},
				});
		}

		// Load internal Contact Map for linking
		const internalContacts = await db.query.xeroContacts.findMany({
			where: and(eq(xeroContacts.xeroTenantId, binding.externalTenantId)),
			columns: {
				id: true,
				xeroContactId: true,
			},
		});
		const contactMap = new Map(
			internalContacts.map((c) => [c.xeroContactId, c.id]),
		);

		// 2. Fetch Invoices
		const whereClause =
			'Type=="ACCREC" AND (Status=="AUTHORISED" OR Status=="PAID")';
		let page = 1;
		let totalInvoices = 0;

		while (true) {
			const invoicesRes = await client.fetch(
				`/Invoices?where=${encodeURIComponent(whereClause)}&page=${page}`,
			);
			if (!invoicesRes.ok) {
				const errorBody = await invoicesRes.text();
				throw new ExternalAPIError(
					"Failed to fetch Xero invoices",
					"xero",
					invoicesRes.status,
					{ endpoint: "/Invoices", response: errorBody },
				);
			}
			const invoicesData = (await invoicesRes.json()) as XeroInvoiceResponse;

			if (invoicesData.Invoices.length === 0) break;
			totalInvoices += invoicesData.Invoices.length;

			// Prepare Invoice Data
			const invoiceValues = invoicesData.Invoices.map((invoice) => {
				const contactId = contactMap.get(invoice.Contact.ContactID);
				const date = parseXeroDate(invoice.DateString);
				const dueDate = parseXeroDate(invoice.DueDateString);

				return {
					xeroTenantId: binding.externalTenantId,
					xeroInvoiceId: invoice.InvoiceID,
					contactId: contactId || null,
					type: invoice.Type,
					status: invoice.Status,
					date: date,
					dueDate: dueDate,
					amountDue: invoice.AmountDue.toString(),
					amountPaid: invoice.AmountPaid.toString(),
					total: invoice.Total.toString(),
					currencyCode: invoice.CurrencyCode,
				};
			});

			if (invoiceValues.length > 0) {
				await db
					.insert(xeroInvoices)
					.values(invoiceValues)
					.onConflictDoUpdate({
						target: [xeroInvoices.xeroTenantId, xeroInvoices.xeroInvoiceId],
						set: {
							status: sql`excluded.status`,
							amountDue: sql`excluded.amount_due`,
							amountPaid: sql`excluded.amount_paid`,
							total: sql`excluded.total`,
							updatedAt: new Date(),
						},
					});
			}
			page++;
		}

		console.log(`Synced ${totalInvoices} invoices`);
		revalidatePath("/agents/ar");
		return {
			success: true,
			counts: {
				contacts: contactsData.Contacts.length,
				invoices: totalInvoices,
			},
		};
	});
}

export async function syncXeroBills() {
	const { orgId } = await auth();
	if (!orgId) {
		throw new Error("No organization selected");
	}

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (table, { and, eq }) =>
			and(
				eq(table.clerkOrgId, orgId),
				eq(table.status, "active"),
				eq(table.provider, "xero"),
			),
	});

	if (!binding) {
		throw new Error("No active Xero connection found");
	}

	return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
		// 1. Fetch Suppliers (Contacts)
		// We sync all contacts to suppliers table for simplicity, or we can assume contacts are shared.
		// Given separate tables requirement, we upsert to xeroSuppliers.
		const contactsRes = await client.fetch("/Contacts");
		if (!contactsRes.ok) {
			const errorBody = await contactsRes.text();
			throw new ExternalAPIError(
				"Failed to fetch Xero contacts/suppliers",
				"xero",
				contactsRes.status,
				{ endpoint: "/Contacts", response: errorBody },
			);
		}
		const contactsData = (await contactsRes.json()) as XeroContactResponse;

		if (contactsData.Contacts.length > 0) {
			await db
				.insert(xeroSuppliers)
				.values(
					contactsData.Contacts.map((contact) => ({
						xeroTenantId: binding.externalTenantId,
						xeroContactId: contact.ContactID,
						name: contact.Name,
						email: contact.EmailAddress,
						phone: contact.Phones?.find(
							(p) => p.PhoneType === "DEFAULT" || p.PhoneType === "MOBILE",
						)?.PhoneNumber,
					})),
				)
				.onConflictDoUpdate({
					target: [xeroSuppliers.xeroTenantId, xeroSuppliers.xeroContactId],
					set: {
						name: sql`excluded.name`,
						email: sql`excluded.email`,
						phone: sql`excluded.phone`,
						updatedAt: new Date(),
					},
				});
		}

		// Load internal Supplier Map
		const internalSuppliers = await db.query.xeroSuppliers.findMany({
			where: and(eq(xeroSuppliers.xeroTenantId, binding.externalTenantId)),
			columns: {
				id: true,
				xeroContactId: true,
			},
		});
		const supplierMap = new Map(
			internalSuppliers.map((s) => [s.xeroContactId, s.id]),
		);

		// 2. Fetch Bills (ACCPAY)
		const whereClause =
			'Type=="ACCPAY" AND (Status=="AUTHORISED" OR Status=="PAID")';
		let page = 1;
		let totalBills = 0;

		while (true) {
			const billsRes = await client.fetch(
				`/Invoices?where=${encodeURIComponent(whereClause)}&page=${page}`,
			);
			if (!billsRes.ok) {
				const errorBody = await billsRes.text();
				throw new ExternalAPIError(
					"Failed to fetch Xero bills",
					"xero",
					billsRes.status,
					{ endpoint: "/Invoices", response: errorBody },
				);
			}
			const billsData = (await billsRes.json()) as XeroInvoiceResponse;

			if (billsData.Invoices.length === 0) break;
			totalBills += billsData.Invoices.length;

			const billValues = billsData.Invoices.map((bill) => {
				const supplierId = supplierMap.get(bill.Contact.ContactID);
				const date = parseXeroDate(bill.DateString);
				const dueDate = parseXeroDate(bill.DueDateString);
				const lineItemsSummary =
					bill.LineItems?.map(
						(l) => `${l.Description || "Item"} ($${l.LineAmount})`,
					).join("; ") || "";

				return {
					xeroTenantId: binding.externalTenantId,
					xeroBillId: bill.InvoiceID,
					supplierId: supplierId || null,
					type: bill.Type,
					status: bill.Status,
					date: date,
					dueDate: dueDate,
					amountDue: bill.AmountDue.toString(),
					amountPaid: bill.AmountPaid.toString(),
					total: bill.Total.toString(),
					currencyCode: bill.CurrencyCode,
					lineItemsSummary: lineItemsSummary,
				};
			});

			if (billValues.length > 0) {
				await db
					.insert(xeroBills)
					.values(billValues)
					.onConflictDoUpdate({
						target: [xeroBills.xeroTenantId, xeroBills.xeroBillId],
						set: {
							status: sql`excluded.status`,
							amountDue: sql`excluded.amount_due`,
							amountPaid: sql`excluded.amount_paid`,
							total: sql`excluded.total`,
							lineItemsSummary: sql`excluded.line_items_summary`,
							updatedAt: new Date(),
						},
					});
			}
			page++;
		}

		console.log(`Synced ${totalBills} bills`);
		revalidatePath("/agents/ap");
		return {
			success: true,
			counts: {
				suppliers: contactsData.Contacts.length,
				bills: totalBills,
			},
		};
	});
}

export async function syncXeroTransactions() {
	const { orgId } = await auth();
	if (!orgId) throw new Error("No organization selected");

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (table, { and, eq }) =>
			and(
				eq(table.clerkOrgId, orgId),
				eq(table.status, "active"),
				eq(table.provider, "xero"),
			),
	});

	if (!binding) throw new Error("No active Xero connection found");

	return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
		let transactionsCount = 0;
		let paymentsCount = 0;

		// 1. Sync Bank Transactions (Spend/Receive Money)
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		const whereDate = oneYearAgo.toISOString().split("T")[0];

		let page = 1;
		while (true) {
			const btRes = await client.fetch(
				`/BankTransactions?where=Date>=DateTime.Parse("${whereDate}")&page=${page}`,
			);
			if (!btRes.ok) break; // Or throw but partial success might be ok for unrelated endpoints
			const btData = (await btRes.json()) as XeroBankTransactionResponse;
			if (btData.BankTransactions.length === 0) break;

			const btValues = btData.BankTransactions.map((bt) => {
				const date = parseXeroDate(bt.DateString);
				const desc =
					bt.LineItems?.map((l) => l.Description).join("; ") ||
					"Bank Transaction";
				return {
					xeroTenantId: binding.externalTenantId,
					xeroId: bt.BankTransactionID,
					type: bt.Type,
					amount: bt.Total.toString(),
					date: date,
					description: desc,
					source: "BANK_TRANS",
				};
			});

			if (btValues.length > 0) {
				await db
					.insert(xeroTransactions)
					.values(btValues)
					.onConflictDoUpdate({
						target: [xeroTransactions.xeroTenantId, xeroTransactions.xeroId],
						set: {
							amount: sql`excluded.amount`,
							description: sql`excluded.description`,
							updatedAt: new Date(),
						},
					});
			}
			transactionsCount += btData.BankTransactions.length;
			page++;
		}

		// 2. Sync Payments (Invoice Payments)
		page = 1;
		while (true) {
			const payRes = await client.fetch(
				`/Payments?where=Date>=DateTime.Parse("${whereDate}")&page=${page}`,
			);
			if (!payRes.ok) break;
			const payData = (await payRes.json()) as XeroPaymentResponse;
			if (payData.Payments.length === 0) break;

			const payValues = payData.Payments.map((pay) => {
				const type = pay.PaymentType === "ACCREC PAYMENT" ? "RECEIVE" : "SPEND";
				const date = parseXeroDate(pay.Date);
				const desc = `${pay.PaymentType} - Ref: ${pay.Reference || "N/A"}`;

				return {
					xeroTenantId: binding.externalTenantId,
					xeroId: pay.PaymentID,
					type: type,
					amount: pay.Amount.toString(),
					date: date,
					description: desc,
					source: "PAYMENT",
				};
			});

			if (payValues.length > 0) {
				await db
					.insert(xeroTransactions)
					.values(payValues)
					.onConflictDoUpdate({
						target: [xeroTransactions.xeroTenantId, xeroTransactions.xeroId],
						set: {
							amount: sql`excluded.amount`,
							updatedAt: new Date(),
						},
					});
			}
			paymentsCount += payData.Payments.length;
			page++;
		}

		revalidatePath("/agents/cashflow");
		return {
			success: true,
			counts: { transactions: transactionsCount, payments: paymentsCount },
		};
	});
}
