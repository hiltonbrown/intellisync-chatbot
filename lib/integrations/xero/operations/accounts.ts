import type { XeroApiClient } from "../adapter";
import type {
	XeroAccount,
	XeroListOptions,
	XeroApiResponse,
} from "../types";

export interface AccountFilters extends XeroListOptions {
	accountIDs?: string[];
}

/**
 * Retrieve accounts from Xero
 */
export async function getAccounts(
	client: XeroApiClient,
	filters?: AccountFilters,
): Promise<XeroAccount[]> {
	const params = new URLSearchParams();

	if (filters?.where) {
		params.set("where", filters.where);
	}

	if (filters?.order) {
		params.set("order", filters.order);
	}

	if (filters?.accountIDs && filters.accountIDs.length > 0) {
		params.set("IDs", filters.accountIDs.join(","));
	}

	const path = `/Accounts${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch accounts: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroAccount>;
	return data.Accounts || [];
}

/**
 * Get a single account by ID
 */
export async function getAccountById(
	client: XeroApiClient,
	accountId: string,
): Promise<XeroAccount | null> {
	const response = await client.fetch(`/Accounts/${accountId}`);

	if (!response.ok) {
		if (response.status === 404) {
			return null;
		}
		const error = await response.text();
		throw new Error(`Failed to fetch account: ${error}`);
	}

	const data = (await response.json()) as XeroApiResponse<XeroAccount>;
	return data.Accounts?.[0] || null;
}

/**
 * Get account by code
 */
export async function getAccountByCode(
	client: XeroApiClient,
	code: string,
): Promise<XeroAccount | null> {
	const accounts = await getAccounts(client, {
		where: `Code=="${code}"`,
	});

	return accounts[0] || null;
}
