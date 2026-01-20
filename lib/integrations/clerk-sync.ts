import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

/**
 * Syncs the Clerk organization name from a Xero tenant name.
 * This should only be called on first-time connections to avoid overwriting
 * manually-set organization names.
 *
 * @param organizationId - The Clerk organization ID
 * @param xeroTenantName - The Xero tenant name to sync
 * @returns Object with sync result and optional error message
 */
export async function syncClerkOrgNameFromXero(
	organizationId: string,
	xeroTenantName: string,
): Promise<{ synced: boolean; previousName?: string; error?: string }> {
	try {
		const client = await clerkClient();

		// Get current organization to check existing name
		const currentOrg = await client.organizations.getOrganization({
			organizationId,
		});

		const previousName = currentOrg.name;

		// Only update if name is different
		if (previousName === xeroTenantName) {
			return {
				synced: false,
				previousName,
				error: "Name already matches, no update needed",
			};
		}

		// Update the organization name
		await client.organizations.updateOrganization(organizationId, {
			name: xeroTenantName,
		});

		console.log("Clerk org name synced from Xero:", {
			organizationId,
			previousName,
			newName: xeroTenantName,
		});

		return {
			synced: true,
			previousName,
		};
	} catch (error) {
		// Log but don't throw - this is a non-critical operation
		console.error("Failed to sync Clerk org name from Xero:", {
			organizationId,
			xeroTenantName,
			error: error instanceof Error ? error.message : error,
		});

		return {
			synced: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
