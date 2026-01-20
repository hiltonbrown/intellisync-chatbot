import "server-only";

import { db } from "@/lib/db";
import {
	integrationGrants,
	integrationTenantBindings,
	type IntegrationGrant,
} from "@/lib/db/schema";
import { encryptToken, decryptToken } from "@/lib/utils/encryption";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { and, eq } from "drizzle-orm";
import { addMinutes, isPast } from "date-fns";

const xeroAdapter = new XeroAdapter();

const TOKEN_REFRESH_BUFFER_MINUTES = 5;

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

		// Check if refresh is needed (either forced or token expiring soon)
		const needsRefresh =
			forceRefresh ||
			isPast(addMinutes(grant.expiresAt, -TOKEN_REFRESH_BUFFER_MINUTES));

		if (needsRefresh) {
			const refreshType = forceRefresh ? "force" : "auto";
			console.log(
				`Token for grant ${grant.id} ${refreshType} refreshing... (expires: ${grant.expiresAt.toISOString()}, status: ${grant.status})`,
			);
			try {
				const refreshedGrant = await this.refreshGrantSingleFlight(grant.id);
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
	 * Refreshes a grant's token with Row Locking to prevent race conditions.
	 * This is the "Single Flight" mechanism.
	 */
	static async refreshGrantSingleFlight(
		grantId: string,
	): Promise<IntegrationGrant> {
		return await db.transaction(async (tx) => {
			// 1. Lock the row
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

			// 2. Re-check expiry inside the lock
			// If another process just refreshed it, expiresAt will be in the future.
			if (!isPast(addMinutes(grant.expiresAt, -TOKEN_REFRESH_BUFFER_MINUTES))) {
				console.log("Grant was already refreshed by another process.");
				return grant;
			}

			try {
				// 3. Perform Refresh
				const currentRefreshToken = decryptToken(grant.refreshTokenEnc);
				const tokenSet = await xeroAdapter.refreshTokens(currentRefreshToken);

				if (!tokenSet.access_token || !tokenSet.refresh_token) {
					throw new Error("Invalid token response from Xero");
				}

				// Xero returns `expires_in` in seconds (usually 1800s = 30m)
				// We add a safety buffer of 30 seconds to be conservative
				const expiresInSeconds = tokenSet.expires_in || 1800;
				const newExpiresAt = new Date(Date.now() + (expiresInSeconds * 1000) - 30000);

				// 4. Update DB
				const [updatedGrant] = await tx
					.update(integrationGrants)
					.set({
						accessTokenEnc: encryptToken(tokenSet.access_token),
						refreshTokenEnc: encryptToken(tokenSet.refresh_token),
						expiresAt: newExpiresAt,
						updatedAt: new Date(),
						status: "active", // Ensure it's active
					})
					.where(eq(integrationGrants.id, grantId))
					.returning();

				return updatedGrant;
			} catch (error) {
				console.error(`Refresh failed for grant ${grantId}:`, error);

				// 5. Handle Failure
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

				throw error;
			}
		});
	}
}
