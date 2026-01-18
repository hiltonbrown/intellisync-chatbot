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

export class TokenService {
	/**
	 * Gets an authenticated Xero API client for a specific tenant binding.
	 * Automatically refreshes the token if it's expiring soon.
	 */
	static async getClientForTenantBinding(tenantBindingId: string) {
		const binding = await db.query.integrationTenantBindings.findFirst({
			where: eq(integrationTenantBindings.id, tenantBindingId),
			with: {
				// We need to fetch the grant manually or via relation if defined.
				// Since we didn't define relations in schema.ts explicitly (using `relations`),
				// we'll fetch it in a second query or use a join.
				// For safety and row locking, we'll do the refresh check logic carefully.
			},
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

		// Check if refresh is needed (expires in < 5 minutes)
		// We use a buffer of 5 minutes
		if (isPast(addMinutes(grant.expiresAt, -5))) {
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
			// Drizzle doesn't have a native `for update` builder yet for all drivers,
			// but we can use raw SQL or the `lock` clause if available in the driver adapter.
			// Using `sql` for Postgres `FOR UPDATE`.

            // Query the grant with FOR UPDATE
            const results = await tx.execute(
                sql`SELECT * FROM ${integrationGrants} WHERE ${integrationGrants.id} = ${grantId} FOR UPDATE`
            );

            // Map the raw result back to the Drizzle schema shape if needed,
            // but for safety let's use the ID to verify it exists and is valid.
            if (results.length === 0) {
                throw new Error("Grant not found");
            }

            // Re-fetch using Drizzle to get typed object (inside the transaction, so it sees the locked state)
            // Note: Since we locked it above, this select is safe.
            const grant = (await tx
                .select()
                .from(integrationGrants)
                .where(eq(integrationGrants.id, grantId))
                .limit(1))[0];

			if (!grant) throw new Error("Grant not found");

			// 2. Re-check expiry inside the lock
			// If another process just refreshed it, expiresAt will be in the future.
			if (!isPast(addMinutes(grant.expiresAt, -5))) {
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

				const newExpiresAt = addMinutes(new Date(), 30); // Xero access tokens usually 30m
                // Or use tokenSet.expires_in if available, but safety buffer is good.

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
