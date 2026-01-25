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
