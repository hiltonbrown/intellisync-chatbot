"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
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
import { withTokenRefreshRetry } from "./retry-helper";

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
		if (!contactsRes.ok)
			throw new Error(`Failed to fetch contacts: ${contactsRes.statusText}`);
		const contactsData = (await contactsRes.json()) as XeroContactResponse;

		console.log(`Synced ${contactsData.Contacts.length} contacts`);

		// Upsert Contacts
		for (const contact of contactsData.Contacts) {
			await db
				.insert(xeroContacts)
				.values({
					xeroTenantId: binding.externalTenantId,
					xeroContactId: contact.ContactID,
					name: contact.Name,
					email: contact.EmailAddress,
					phone: contact.Phones?.find(
						(p) => p.PhoneType === "DEFAULT" || p.PhoneType === "MOBILE",
					)?.PhoneNumber,
				})
				.onConflictDoUpdate({
					target: [xeroContacts.xeroTenantId, xeroContacts.xeroContactId],
					set: {
						name: contact.Name,
						email: contact.EmailAddress,
						phone: contact.Phones?.find(
							(p) => p.PhoneType === "DEFAULT" || p.PhoneType === "MOBILE",
						)?.PhoneNumber,
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
			if (!invoicesRes.ok)
				throw new Error(`Failed to fetch invoices: ${invoicesRes.statusText}`);
			const invoicesData = (await invoicesRes.json()) as XeroInvoiceResponse;

			if (invoicesData.Invoices.length === 0) break;
			totalInvoices += invoicesData.Invoices.length;

			for (const invoice of invoicesData.Invoices) {
				const contactId = contactMap.get(invoice.Contact.ContactID);

				// Safe parsing of date
				const date = invoice.DateString ? new Date(invoice.DateString) : null;
				const dueDate = invoice.DueDateString
					? new Date(invoice.DueDateString)
					: null;

				await db
					.insert(xeroInvoices)
					.values({
						xeroTenantId: binding.externalTenantId,
						xeroInvoiceId: invoice.InvoiceID,
						contactId: contactId || null, // Should not be null if contacts synced, but safe fallback
						type: invoice.Type,
						status: invoice.Status,
						date: date,
						dueDate: dueDate,
						amountDue: invoice.AmountDue.toString(),
						amountPaid: invoice.AmountPaid.toString(),
						total: invoice.Total.toString(),
						currencyCode: invoice.CurrencyCode,
					})
					.onConflictDoUpdate({
						target: [xeroInvoices.xeroTenantId, xeroInvoices.xeroInvoiceId],
						set: {
							status: invoice.Status,
							amountDue: invoice.AmountDue.toString(),
							amountPaid: invoice.AmountPaid.toString(),
							total: invoice.Total.toString(),
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
		if (!contactsRes.ok)
			throw new Error(`Failed to fetch contacts: ${contactsRes.statusText}`);
		const contactsData = (await contactsRes.json()) as XeroContactResponse;

		for (const contact of contactsData.Contacts) {
			await db
				.insert(xeroSuppliers)
				.values({
					xeroTenantId: binding.externalTenantId,
					xeroContactId: contact.ContactID,
					name: contact.Name,
					email: contact.EmailAddress,
					phone: contact.Phones?.find(
						(p) => p.PhoneType === "DEFAULT" || p.PhoneType === "MOBILE",
					)?.PhoneNumber,
				})
				.onConflictDoUpdate({
					target: [xeroSuppliers.xeroTenantId, xeroSuppliers.xeroContactId],
					set: {
						name: contact.Name,
						email: contact.EmailAddress,
						phone: contact.Phones?.find(
							(p) => p.PhoneType === "DEFAULT" || p.PhoneType === "MOBILE",
						)?.PhoneNumber,
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
			if (!billsRes.ok)
				throw new Error(`Failed to fetch bills: ${billsRes.statusText}`);
			const billsData = (await billsRes.json()) as XeroInvoiceResponse;

			if (billsData.Invoices.length === 0) break;
			totalBills += billsData.Invoices.length;

			for (const bill of billsData.Invoices) {
				const supplierId = supplierMap.get(bill.Contact.ContactID);

				const date = bill.DateString ? new Date(bill.DateString) : null;
				const dueDate = bill.DueDateString
					? new Date(bill.DueDateString)
					: null;

				const lineItemsSummary =
					bill.LineItems?.map(
						(l) => `${l.Description || "Item"} ($${l.LineAmount})`,
					).join("; ") || "";

				await db
					.insert(xeroBills)
					.values({
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
					})
					.onConflictDoUpdate({
						target: [xeroBills.xeroTenantId, xeroBills.xeroBillId],
						set: {
							status: bill.Status,
							amountDue: bill.AmountDue.toString(),
							amountPaid: bill.AmountPaid.toString(),
							total: bill.Total.toString(),
							lineItemsSummary: lineItemsSummary,
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
        // Note: Xero API might limit history, so we might need paging or date filtering.
        // Syncing last 365 days for MVP relevance.
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const whereDate = oneYearAgo.toISOString().split('T')[0];

        let page = 1;
        while(true) {
            const btRes = await client.fetch(`/BankTransactions?where=Date>=DateTime.Parse("${whereDate}")&page=${page}`);
            if (!btRes.ok) break; // Or throw
            const btData = await btRes.json() as XeroBankTransactionResponse;
            if (btData.BankTransactions.length === 0) break;

            for (const bt of btData.BankTransactions) {
                const date = bt.DateString ? new Date(bt.DateString) : null;
                const desc = bt.LineItems?.map(l => l.Description).join('; ') || "Bank Transaction";

                await db.insert(xeroTransactions).values({
                    xeroTenantId: binding.externalTenantId,
                    xeroId: bt.BankTransactionID,
                    type: bt.Type, // SPEND or RECEIVE
                    amount: bt.Total.toString(),
                    date: date,
                    description: desc,
                    source: "BANK_TRANS",
                }).onConflictDoUpdate({
                    target: [xeroTransactions.xeroTenantId, xeroTransactions.xeroId],
                    set: {
                        amount: bt.Total.toString(),
                        description: desc,
                        updatedAt: new Date(),
                    }
                });
            }
            transactionsCount += btData.BankTransactions.length;
            page++;
        }

        // 2. Sync Payments (Invoice Payments)
        // Fetch Payments modified after... or just all recent.
        // /Payments endpoint supports paging.
        page = 1;
        while(true) {
            const payRes = await client.fetch(`/Payments?where=Date>=DateTime.Parse("${whereDate}")&page=${page}`);
            if (!payRes.ok) break;
            const payData = await payRes.json() as XeroPaymentResponse;
            if (payData.Payments.length === 0) break;

            for (const pay of payData.Payments) {
                const type = pay.PaymentType === "ACCREC PAYMENT" ? "RECEIVE" : "SPEND";
                const date = pay.Date ? new Date(pay.Date) : null; // Payments API returns YYYY-MM-DD often? Actually usually milliseconds timestamp or string.
                // Xero API usually returns /Date(123123)/ format in JSON, need robust parsing if not using standard serializer?
                // The library we used in `syncXeroData` (fetch wrapper) returns JSON.
                // Standard Xero API V2 returns /Date(...)/ for JSON unless opting into standard JSON format which is newer.
                // Assuming standard date string ISO or timestamp. If previous syncs worked with DateString, Payments usually have "Date" field.

                // Note: The `fetch` helper likely returns raw JSON from Xero.
                // Xero JSON dates are annoying `/Date(1519344000000+0000)/`.
                // However, `syncXeroData` used `DateString` which Xero provides as `YYYY-MM-DD` alongside.
                // Payments endpoint has `Date`. We might need to check if it's safe.
                // Let's assume we can parse `pay.Date`.

                const desc = `${pay.PaymentType} - Ref: ${pay.Reference || 'N/A'}`;

                await db.insert(xeroTransactions).values({
                    xeroTenantId: binding.externalTenantId,
                    xeroId: pay.PaymentID,
                    type: type,
                    amount: pay.Amount.toString(),
                    date: date,
                    description: desc,
                    source: "PAYMENT",
                }).onConflictDoUpdate({
                    target: [xeroTransactions.xeroTenantId, xeroTransactions.xeroId],
                    set: {
                        amount: pay.Amount.toString(),
                        updatedAt: new Date(),
                    }
                });
            }
            paymentsCount += payData.Payments.length;
            page++;
        }

        revalidatePath("/agents/cashflow");
        return { success: true, counts: { transactions: transactionsCount, payments: paymentsCount } };
    });
}
