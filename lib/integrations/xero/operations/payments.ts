import type { XeroApiClient } from "../adapter";
import type {
	XeroPayment,
	XeroListOptions,
	XeroApiResponse,
} from "../types";

export interface PaymentFilters extends XeroListOptions {
	paymentIDs?: string[];
}

/**
 * Retrieve payments from Xero
 */
export async function getPayments(
	client: XeroApiClient,
	filters?: PaymentFilters,
): Promise<XeroPayment[]> {
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

	if (filters?.paymentIDs && filters.paymentIDs.length > 0) {
		params.set("IDs", filters.paymentIDs.join(","));
	}

	const path = `/Payments${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch payments: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroPayment>;
	return data.Payments || [];
}

/**
 * Get a single payment by ID
 */
export async function getPaymentById(
	client: XeroApiClient,
	paymentId: string,
): Promise<XeroPayment | null> {
	const response = await client.fetch(`/Payments/${paymentId}`);

	if (!response.ok) {
		if (response.status === 404) {
			return null;
		}
		const error = await response.text();
		throw new Error(`Failed to fetch payment: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroPayment>;
	return data.Payments?.[0] || null;
}

/**
 * Create a new payment in Xero
 */
export async function createPayment(
	client: XeroApiClient,
	payment: Omit<XeroPayment, "PaymentID">,
): Promise<XeroPayment> {
	const response = await client.fetch("/Payments", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ Payments: [payment] }),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to create payment: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroPayment>;
	const createdPayment = data.Payments?.[0];

	if (!createdPayment) {
		throw new Error("Payment was not created");
	}

	return createdPayment;
}
