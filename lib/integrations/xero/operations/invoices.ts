import type { XeroApiClient } from "../adapter";
import type {
	XeroInvoice,
	XeroListOptions,
	XeroApiResponse,
} from "../types";

export interface InvoiceFilters extends XeroListOptions {
	invoiceNumbers?: string[];
	contactIDs?: string[];
	statuses?: string[];
	invoiceIDs?: string[];
}

/**
 * Retrieve invoices from Xero
 */
export async function getInvoices(
	client: XeroApiClient,
	filters?: InvoiceFilters,
): Promise<XeroInvoice[]> {
	const params = new URLSearchParams();

	if (filters?.page) {
		params.set("page", filters.page.toString());
	}

	if (filters?.where) {
		params.set("where", filters.where);
	}

	if (filters?.order) {
		params.set("order", filters.order);
	}

	if (filters?.invoiceNumbers && filters.invoiceNumbers.length > 0) {
		params.set("InvoiceNumbers", filters.invoiceNumbers.join(","));
	}

	if (filters?.contactIDs && filters.contactIDs.length > 0) {
		params.set("ContactIDs", filters.contactIDs.join(","));
	}

	if (filters?.statuses && filters.statuses.length > 0) {
		params.set("Statuses", filters.statuses.join(","));
	}

	if (filters?.invoiceIDs && filters.invoiceIDs.length > 0) {
		params.set("IDs", filters.invoiceIDs.join(","));
	}

	const path = `/Invoices${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch invoices: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroInvoice>;
	return data.Invoices || [];
}

/**
 * Get a single invoice by ID
 */
export async function getInvoiceById(
	client: XeroApiClient,
	invoiceId: string,
): Promise<XeroInvoice | null> {
	const response = await client.fetch(`/Invoices/${invoiceId}`);

	if (!response.ok) {
		if (response.status === 404) {
			return null;
		}
		const error = await response.text();
		throw new Error(`Failed to fetch invoice: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroInvoice>;
	return data.Invoices?.[0] || null;
}

/**
 * Create a new invoice in Xero
 */
export async function createInvoice(
	client: XeroApiClient,
	invoice: Omit<XeroInvoice, "InvoiceID">,
): Promise<XeroInvoice> {
	const response = await client.fetch("/Invoices", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ Invoices: [invoice] }),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to create invoice: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroInvoice>;
	const createdInvoice = data.Invoices?.[0];

	if (!createdInvoice) {
		throw new Error("Invoice was not created");
	}

	return createdInvoice;
}

/**
 * Update an existing invoice in Xero
 */
export async function updateInvoice(
	client: XeroApiClient,
	invoiceId: string,
	invoice: Partial<XeroInvoice>,
): Promise<XeroInvoice> {
	const response = await client.fetch(`/Invoices/${invoiceId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			Invoices: [{ ...invoice, InvoiceID: invoiceId }],
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to update invoice: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroInvoice>;
	const updatedInvoice = data.Invoices?.[0];

	if (!updatedInvoice) {
		throw new Error("Invoice was not updated");
	}

	return updatedInvoice;
}

/**
 * Approve a draft invoice
 */
export async function approveInvoice(
	client: XeroApiClient,
	invoiceId: string,
): Promise<XeroInvoice> {
	return await updateInvoice(client, invoiceId, { Status: "AUTHORISED" });
}
