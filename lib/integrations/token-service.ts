import "server-only";

import { addMinutes, addSeconds, differenceInDays, isPast } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	type IntegrationGrant,
	integrationGrants,
	integrationTenantBindings,
} from "@/lib/db/schema";
import { AuthError, TokenError } from "@/lib/integrations/errors";
import { safeParseXeroAccessToken } from "@/lib/integrations/jwt-parser";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { decryptToken, encryptToken } from "@/lib/utils/encryption";

const xeroAdapter = new XeroAdapter();

const TOKEN_REFRESH_BUFFER_MINUTES = 5;

// In-memory locks to prevent multiple identical refresh requests within the same process
const tokenRefreshLocks = new Map<string, Promise<IntegrationGrant>>();
// Track last refresh time to minimize DB hits for "spammy" requests
const lastRefreshTimestamps = new Map<string, number>();

export class TokenService {
	/**
	 * Gets an authenticated Xero API client for a specific tenant binding.
	 * Automatically refreshes the token if it's expiring soon.
	 *
	 * @param tenantBindingId - The tenant binding ID
	 * @param orgId - The Clerk organization ID that owns the tenant binding
	 * @param forceRefresh - Force a token refresh even if not expired
	 */
	static async getClientForTenantBinding(
		tenantBindingId: string,
		orgId: string,
		forceRefresh = false,
	) {
		const binding = await db.query.integrationTenantBindings.findFirst({
			where: and(
				eq(integrationTenantBindings.id, tenantBindingId),
				eq(integrationTenantBindings.clerkOrgId, orgId),
			),
		});

		if (!binding) {
			throw new Error("Tenant binding not found");
		}

		if (binding.status !== "active") {
			throw new Error(`Tenant binding is ${binding.status}`);
		}

		// Load the grant
		const grant = await db.query.integrationGrants.findFirst({
			where: eq(integrationGrants.id, binding.activeGrantId),
		});

		if (!grant) {
			throw new Error("Active grant not found");
		}

		// Check if refresh is needed (either forced, token expiring soon, or refresh token getting old)
		let needsRefresh =
			forceRefresh ||
			isPast(addMinutes(grant.expiresAt, -TOKEN_REFRESH_BUFFER_MINUTES));

		// Proactively refresh if refresh token is > 50 days old (limit is 60 days)
		if (grant.refreshTokenIssuedAt) {
			const refreshTokenAgeDays = differenceInDays(
				new Date(),
				grant.refreshTokenIssuedAt,
			);
			if (refreshTokenAgeDays > 50) {
				console.log(
					`[TokenService] Grant ${grant.id} refresh token is ${refreshTokenAgeDays} days old. Proactively refreshing to reset rolling 60-day expiry.`,
				);
				needsRefresh = true;
			}
		}

		if (needsRefresh) {
			const refreshType = forceRefresh ? "force" : "auto";
			console.log(
				`Token for grant ${grant.id} ${refreshType} refreshing... (expires: ${grant.expiresAt.toISOString()}, status: ${grant.status})`,
			);
			try {
				const refreshedGrant = await TokenService.refreshGrantSingleFlight(
					grant.id,
				);
				console.log(
					`Returning client with refreshed token for tenant ${binding.externalTenantId.substring(0, 8)}...`,
				);
				return xeroAdapter.getApiClient(
					decryptToken(refreshedGrant.accessTokenEnc),
					binding.externalTenantId,
				);
			} catch (error) {
				console.error("Failed to refresh token:", {
					grantId: grant.id,
					bindingId: binding.id,
					error:
						error instanceof Error
							? {
									message: error.message,
									name: error.name,
									code: (error as any).code,
								}
							: error,
				});
				// If refresh failed, we can't proceed
				throw new Error("Token expired and refresh failed");
			}
		}

		console.log(
			`Using existing token for grant ${grant.id} (expires: ${grant.expiresAt.toISOString()})`,
		);
		return xeroAdapter.getApiClient(
			decryptToken(grant.accessTokenEnc),
			binding.externalTenantId,
		);
	}

	/**
	 * Refreshes a grant's token with Row Locking AND In-Memory Locking (Single Flight).
	 *
	 * Uses JWT `exp` claim as authoritative source for token expiry (not expires_in).
	 */
	static async refreshGrantSingleFlight(
		grantId: string,
	): Promise<IntegrationGrant> {
		// 1. In-Memory Lock Check (Fast path)
		// If a refresh is already in progress for this grant in this process, return that promise.
		const existingPromise = tokenRefreshLocks.get(grantId);
		if (existingPromise) {
			console.log(
				`[TokenService] Joining existing in-flight refresh for grant ${grantId}`,
			);
			return existingPromise;
		}

		// 2. Recently Refreshed Check (Throttle)
		// If we refreshed this very recently (e.g. < 5 seconds ago), assume it's fresh enough.
		// This avoids spamming the DB with locks if many requests come in bursts.
		const lastRefresh = lastRefreshTimestamps.get(grantId);
		if (lastRefresh && Date.now() - lastRefresh < 5000) {
			console.log(
				`[TokenService] Grant ${grantId} refreshed recently (<5s), fetching latest from DB without lock.`,
			);
			const grant = await db.query.integrationGrants.findFirst({
				where: eq(integrationGrants.id, grantId),
			});
			if (!grant) throw new Error("Grant not found");
			return grant;
		}

		// Create the promise for the actual work
		const promise = (async () => {
			try {
				return await db.transaction(async (tx) => {
					// 3. Database Row Lock (Cross-process safety)
					await tx
						.select()
						.from(integrationGrants)
						.where(eq(integrationGrants.id, grantId))
						.for("update");

					// Re-fetch using Drizzle to get typed object (inside the transaction, so it sees the locked state)
					const grant = await tx.query.integrationGrants.findFirst({
						where: eq(integrationGrants.id, grantId),
					});

					if (!grant) throw new Error("Grant not found");

					// 4. Re-check expiry inside the lock
					// If another process just refreshed it, expiresAt will be in the future.
					if (
						!isPast(addMinutes(grant.expiresAt, -TOKEN_REFRESH_BUFFER_MINUTES))
					) {
						console.log("Grant was already refreshed by another process.");
						return grant;
					}

					try {
						// 5. Perform Refresh
						const currentRefreshToken = decryptToken(grant.refreshTokenEnc);

						let tokenSet: Awaited<ReturnType<typeof xeroAdapter.refreshTokens>>;
						try {
							tokenSet = await xeroAdapter.refreshTokens(currentRefreshToken);
						} catch (error) {
							// Check if the error is permanent (e.g. invalid_grant usually means expired/revoked)
							let isPermanent = false;
							if (error instanceof TokenError) {
								const context = error.context as any;
								if (
									error.statusCode === 400 &&
									context?.error === "invalid_grant"
								) {
									isPermanent = true;
								}
							} else if (error instanceof AuthError) {
								if (error.statusCode === 400) isPermanent = true;
							}

							if (isPermanent) {
								throw error;
							}

							console.warn(
								`[TokenService] Initial refresh failed for grant ${grantId}, retrying...`,
								error instanceof Error ? error.message : "Unknown error",
							);

							// Retry once
							tokenSet = await xeroAdapter.refreshTokens(currentRefreshToken);
						}

						if (!tokenSet.access_token || !tokenSet.refresh_token) {
							throw new Error("Invalid token response from Xero");
						}

						// Extract expiry from JWT (authoritative source)
						// Fall back to expires_in calculation if JWT parsing fails
						let newExpiresAt: Date;
						const parsed = safeParseXeroAccessToken(tokenSet.access_token);

						if (parsed) {
							// Use JWT exp claim - this is the authoritative source
							newExpiresAt = parsed.expiresAt;
							console.log(
								`[TokenService] Using JWT exp claim: ${newExpiresAt.toISOString()}`,
							);
						} else {
							// Fallback: calculate from expires_in with safety buffer
							const expiresInSeconds = tokenSet.expires_in || 1800;
							newExpiresAt = new Date(
								Date.now() + expiresInSeconds * 1000 - 30000,
							);
							console.warn(
								`[TokenService] JWT parse failed, using expires_in fallback: ${newExpiresAt.toISOString()}`,
							);
						}

						// 6. Update DB
						const [updatedGrant] = await tx
							.update(integrationGrants)
							.set({
								accessTokenEnc: encryptToken(tokenSet.access_token),
								refreshTokenEnc: encryptToken(tokenSet.refresh_token),
								refreshTokenIssuedAt: new Date(),
								expiresAt: newExpiresAt,
								updatedAt: new Date(),
								status: "active", // Ensure it's active
							})
							.where(eq(integrationGrants.id, grantId))
							.returning();

						// Update timestamp cache
						lastRefreshTimestamps.set(grantId, Date.now());

						return updatedGrant;
					} catch (error) {
						console.error(`Refresh failed for grant ${grantId}:`, error);

						// Handle Failure
						// Critically, we only want to mark the grant as 'refresh_failed' (effectively disabled)
						// if we are sure the token is invalid (e.g. 400 invalid_grant).
						// If it's a network error or 5xx, we should leave it 'active' so it can retry.
						let isPermanentFailure = false;

						if (error instanceof TokenError) {
							const context = error.context as any;
							// Xero returns "error": "invalid_grant" for revoked/expired tokens
							if (
								error.statusCode === 400 &&
								context?.error === "invalid_grant"
							) {
								isPermanentFailure = true;
							}
							// Other 400s might also be permanent (e.g. invalid_client), but 5xx are temporary.
							// For safety, we default to NOT disabling unless sure.
						} else if (error instanceof AuthError) {
							// Auth errors might be configuration issues
							if (error.statusCode === 400) isPermanentFailure = true;
						}

						if (isPermanentFailure) {
							console.warn(
								`Marking grant ${grantId} as refresh_failed due to permanent error.`,
							);
							await tx
								.update(integrationGrants)
								.set({
									status: "refresh_failed",
									updatedAt: new Date(),
								})
								.where(eq(integrationGrants.id, grantId));

							// Update bindings to needs_reauth
							await tx
								.update(integrationTenantBindings)
								.set({
									status: "needs_reauth",
									updatedAt: new Date(),
								})
								.where(eq(integrationTenantBindings.activeGrantId, grantId));
						} else {
							console.warn(
								`Preserving active status for grant ${grantId} despite refresh error (assumed temporary).`,
							);
						}

						throw error;
					}
				});
			} finally {
				// Clean up the lock map when done (success or failure)
				tokenRefreshLocks.delete(grantId);
			}
		})();

		// Store the promise in the map
		tokenRefreshLocks.set(grantId, promise);

		return promise;
	}
}
