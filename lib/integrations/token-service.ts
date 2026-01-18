import "server-only";

import { db } from "@/lib/db";
import {
	integrationGrants,
	integrationTenantBindings,
	type IntegrationGrant,
} from "@/lib/db/schema";
import { encryptToken, decryptToken } from "@/lib/utils/encryption";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { eq, sql } from "drizzle-orm";
import { addMinutes, isPast } from "date-fns";

const xeroAdapter = new XeroAdapter();

const TOKEN_REFRESH_BUFFER_MINUTES = 5;

export class TokenService {
	/**
	 * Gets an authenticated Xero API client for a specific tenant binding.
	 * Automatically refreshes the token if it's expiring soon.
	 */
	static async getClientForTenantBinding(tenantBindingId: string) {
		const binding = await db.query.integrationTenantBindings.findFirst({
			where: eq(integrationTenantBindings.id, tenantBindingId),
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

		// Check if refresh is needed
		if (isPast(addMinutes(grant.expiresAt, -TOKEN_REFRESH_BUFFER_MINUTES))) {
			console.log(`Token for grant ${grant.id} is expiring soon, refreshing...`);
			try {
				const refreshedGrant = await this.refreshGrantSingleFlight(grant.id);
				return xeroAdapter.getApiClient(
					decryptToken(refreshedGrant.accessTokenEnc),
					binding.externalTenantId,
				);
			} catch (error) {
				console.error("Failed to refresh token on-demand:", error);
				// If refresh failed, we can't proceed
				throw new Error("Token expired and refresh failed");
			}
		}

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
            // Query the grant with FOR UPDATE
            // Note: tx.execute returns a generic result depending on driver.
            // We use standard Drizzle queries where possible, but for lock we use SQL.

            await tx.execute(
                sql`SELECT * FROM ${integrationGrants} WHERE ${integrationGrants.id} = ${grantId} FOR UPDATE`
            );

            // Re-fetch using Drizzle to get typed object (inside the transaction, so it sees the locked state)
            const grant = await tx.query.integrationGrants.findFirst({
                where: eq(integrationGrants.id, grantId)
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
