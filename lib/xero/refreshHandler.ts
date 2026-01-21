import { TokenError } from "@/lib/integrations/errors";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import {
	getStoredXeroToken,
	isAccessTokenExpired,
	needsRefresh,
	storeXeroToken,
	type XeroToken,
} from "@/lib/xero/tokenManager";
import { addSeconds } from "date-fns";

const xeroAdapter = new XeroAdapter();

/**
 * Ensures that a valid Xero token exists for the given user and organization.
 * Checks for expiry and proactively refreshes the token if needed.
 *
 * @param userId - The Clerk User ID.
 * @param orgId - The Clerk Organization ID.
 * @returns A valid XeroToken.
 * @throws TokenError if no token exists or if refresh fails.
 */
export async function ensureValidXeroToken(
	userId: string,
	orgId: string,
): Promise<XeroToken> {
	const token = await getStoredXeroToken(userId, orgId);

	if (!token) {
		throw new TokenError(
			"No Xero token found for user/org",
			"TOKEN_NOT_FOUND",
			401,
		);
	}

	// Check if token is strictly expired or needs proactive refresh
	if (isAccessTokenExpired(token) || needsRefresh(token)) {
		console.log(
			`[Xero Refresh] Token for user ${userId} needs refresh (expired=${isAccessTokenExpired(token)}, needsRefresh=${needsRefresh(token)})`,
		);

		try {
			// Call Xero to refresh the token
			const tokenSet = await xeroAdapter.refreshTokens(token.refreshToken);

			if (!tokenSet.access_token || !tokenSet.refresh_token) {
				throw new TokenError(
					"Invalid token response from Xero during refresh",
					"TOKEN_REFRESH_INVALID_RESPONSE",
					502,
				);
			}

			// Calculate new expiry
			// Xero returns `expires_in` in seconds (usually 1800s = 30m)
			// We add a safety buffer of 30 seconds to be conservative
			const expiresInSeconds = tokenSet.expires_in || 1800;
			const newExpiresAt = addSeconds(new Date(), expiresInSeconds - 30);

			// Currently scopes are hardcoded in tokenManager/adapter, so we preserve what we have or re-fetch
			const scopes = xeroAdapter.getAuthUrl("").split("scope=")[1].split("&")[0].split("%20");

			const newToken: XeroToken = {
				accessToken: tokenSet.access_token,
				refreshToken: tokenSet.refresh_token,
				expiresAt: newExpiresAt,
				scopes: scopes,
			};

			// Store the new token (Rotate refresh token)
			await storeXeroToken(userId, orgId, newToken);

			console.log(`[Xero Refresh] Token refreshed successfully for user ${userId}`);
			return newToken;
		} catch (error) {
			console.error(`[Xero Refresh] Failed to refresh token for user ${userId}:`, error);
			// If refresh fails, we must throw to trigger re-auth flow
			if (error instanceof TokenError) {
				throw error;
			}
			throw new TokenError(
				"Failed to refresh Xero token",
				"TOKEN_REFRESH_FAILED",
				500,
				{ originalError: error },
			);
		}
	}

	return token;
}
