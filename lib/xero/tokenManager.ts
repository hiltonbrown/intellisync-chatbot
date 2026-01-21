import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrationGrants } from "@/lib/db/schema";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { decryptToken, encryptToken } from "@/lib/utils/encryption";
import { addSeconds, isPast } from "date-fns";

/**
 * Represents a Xero OAuth2 token set with expiry and scope information.
 */
export interface XeroToken {
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
	scopes: string[];
}

// Instantiate adapter to access scopes
const xeroAdapter = new XeroAdapter();

/**
 * Retrieves a stored Xero token for a specific user and organization.
 * Fetches the most recent active grant matching the criteria.
 *
 * @param userId - The Clerk User ID authorizing the connection.
 * @param orgId - The Clerk Organization ID context.
 * @returns The decrypted XeroToken or null if not found.
 */
export async function getStoredXeroToken(
	userId: string,
	orgId: string,
): Promise<XeroToken | null> {
	const grant = await db.query.integrationGrants.findFirst({
		where: and(
			eq(integrationGrants.authorisedByClerkUserId, userId),
			eq(integrationGrants.clerkOrgId, orgId),
			eq(integrationGrants.provider, "xero"),
			eq(integrationGrants.status, "active"),
		),
		orderBy: [desc(integrationGrants.updatedAt)],
	});

	if (!grant) {
		return null;
	}

	// Currently scopes are not stored in DB, so we use the hardcoded ones from the adapter
	const scopes = xeroAdapter.getAuthUrl("").split("scope=")[1].split("&")[0].split("%20");

	return {
		accessToken: decryptToken(grant.accessTokenEnc),
		refreshToken: decryptToken(grant.refreshTokenEnc),
		expiresAt: grant.expiresAt,
		scopes: scopes,
	};
}

/**
 * Stores (updates) the Xero token for a specific user and organization.
 * Finds the active grant and updates the tokens and expiry.
 *
 * @param userId - The Clerk User ID.
 * @param orgId - The Clerk Organization ID.
 * @param token - The new XeroToken object.
 */
export async function storeXeroToken(
	userId: string,
	orgId: string,
	token: XeroToken,
): Promise<void> {
	// Update the most recent active grant for this user/org
    // We use a subquery-like approach or just find the ID first to ensure we update the correct row.
    // Given Drizzle nuances, finding the ID first is safer.

	const grant = await db.query.integrationGrants.findFirst({
		where: and(
			eq(integrationGrants.authorisedByClerkUserId, userId),
			eq(integrationGrants.clerkOrgId, orgId),
			eq(integrationGrants.provider, "xero"),
			eq(integrationGrants.status, "active"),
		),
        orderBy: [desc(integrationGrants.updatedAt)],
	});

	if (!grant) {
        // If no grant exists, we cannot "update" a token.
        // In this architecture, grants are created via the OAuth callback flow.
        // We throw an error to indicate incorrect usage.
		throw new Error("No active grant found to update token for.");
	}

	await db
		.update(integrationGrants)
		.set({
			accessTokenEnc: encryptToken(token.accessToken),
			refreshTokenEnc: encryptToken(token.refreshToken),
			expiresAt: token.expiresAt,
			updatedAt: new Date(),
		})
		.where(eq(integrationGrants.id, grant.id));
}

/**
 * Checks if the access token is strictly expired.
 *
 * @param token - The XeroToken to check.
 * @returns True if the expiresAt date is in the past.
 */
export function isAccessTokenExpired(token: XeroToken): boolean {
	return isPast(token.expiresAt);
}

/**
 * Checks if the access token needs refreshing based on a safety buffer.
 *
 * @param token - The XeroToken to check.
 * @param thresholdSeconds - The buffer time in seconds (default: 300s / 5min).
 * @returns True if the token expires within the threshold window.
 */
export function needsRefresh(
	token: XeroToken,
	thresholdSeconds = 300,
): boolean {
	const thresholdDate = addSeconds(token.expiresAt, -thresholdSeconds);
	return isPast(thresholdDate);
}
