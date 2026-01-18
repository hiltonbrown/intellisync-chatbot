import type { XeroApiClient } from "../adapter";
import type {
	XeroContact,
	XeroListOptions,
	XeroApiResponse,
} from "../types";

export interface ContactFilters extends XeroListOptions {
	contactIDs?: string[];
	includeArchived?: boolean;
}

/**
 * Retrieve contacts from Xero
 */
export async function getContacts(
	client: XeroApiClient,
	filters?: ContactFilters,
): Promise<XeroContact[]> {
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

	if (filters?.includeArchived) {
		params.set("includeArchived", "true");
	}

	if (filters?.contactIDs && filters.contactIDs.length > 0) {
		params.set("IDs", filters.contactIDs.join(","));
	}

	const path = `/Contacts${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch contacts: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroContact>;
	return data.Contacts || [];
}

/**
 * Get a single contact by ID
 */
export async function getContactById(
	client: XeroApiClient,
	contactId: string,
): Promise<XeroContact | null> {
	const response = await client.fetch(`/Contacts/${contactId}`);

	if (!response.ok) {
		if (response.status === 404) {
			return null;
		}
		const error = await response.text();
		throw new Error(`Failed to fetch contact: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroContact>;
	return data.Contacts?.[0] || null;
}

/**
 * Create a new contact in Xero
 */
export async function createContact(
	client: XeroApiClient,
	contact: Omit<XeroContact, "ContactID">,
): Promise<XeroContact> {
	const response = await client.fetch("/Contacts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ Contacts: [contact] }),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to create contact: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroContact>;
	const createdContact = data.Contacts?.[0];

	if (!createdContact) {
		throw new Error("Contact was not created");
	}

	return createdContact;
}

/**
 * Update an existing contact in Xero
 */
export async function updateContact(
	client: XeroApiClient,
	contactId: string,
	contact: Partial<XeroContact>,
): Promise<XeroContact> {
	const response = await client.fetch(`/Contacts/${contactId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ Contacts: [{ ...contact, ContactID: contactId }] }),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to update contact: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroContact>;
	const updatedContact = data.Contacts?.[0];

	if (!updatedContact) {
		throw new Error("Contact was not updated");
	}

	return updatedContact;
}
