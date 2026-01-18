import type { XeroApiClient } from "../adapter";
import type { XeroAccount, XeroApiResponse, XeroListOptions } from "../types";

export interface AccountFilters extends XeroListOptions {
	accountIDs?: string[];
}

/**
 * Escapes a string value for use in OData query expressions.
 * This prevents OData injection by escaping special characters.
 *
 * @param value - The string value to escape
 * @returns The escaped string safe for use in OData queries
 */
function escapeODataString(value: string): string {
	// Escape backslashes first (must be done before other escapes)
	let escaped = value.replace(/\\/g, "\\\\");
	// Escape double quotes (used for string delimiters in Xero OData queries)
	escaped = escaped.replace(/"/g, '\\"');
	// Escape single quotes
	escaped = escaped.replace(/'/g, "\\'");
	return escaped;
}

/**
 * Validates that an account code contains only safe characters.
 * Xero account codes typically contain alphanumeric characters, hyphens, and underscores.
 *
 * @param code - The account code to validate
 * @throws Error if the code contains invalid characters
 */
function validateAccountCode(code: string): void {
	if (!code || code.trim().length === 0) {
		throw new Error("Account code cannot be empty");
	}

	// Xero account codes should only contain alphanumeric characters, hyphens, underscores, and dots
	// This prevents injection attempts with OData operators or special characters
	const validCodePattern = /^[a-zA-Z0-9\-_.]+$/;

	if (!validCodePattern.test(code)) {
		throw new Error(
			"Invalid account code format. Account codes must contain only alphanumeric characters, hyphens, underscores, and dots.",
		);
	}

	// Additional length validation (Xero supports up to 10 characters for account codes)
	if (code.length > 10) {
		throw new Error("Account code must be 10 characters or less");
	}
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
	// Validate and sanitize the account code to prevent OData injection
	validateAccountCode(code);
	const sanitizedCode = escapeODataString(code);

	const accounts = await getAccounts(client, {
		where: `Code=="${sanitizedCode}"`,
	});

	return accounts[0] || null;
}
