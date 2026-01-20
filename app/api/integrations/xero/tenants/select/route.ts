import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationGrants, integrationTenantBindings } from "@/lib/db/schema";
import { syncClerkOrgNameFromXero } from "@/lib/integrations/clerk-sync";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { decryptToken } from "@/lib/utils/encryption";

const xeroAdapter = new XeroAdapter();

const SelectTenantSchema = z.object({
	grantId: z.string(),
	tenantId: z.string(), // The Xero Tenant ID (externalTenantId)
});

export async function POST(req: Request) {
	const { userId, orgId, orgRole } = await auth();

	if (!userId || !orgId) {
		return new Response("Unauthorized", { status: 401 });
	}

	// Only admins/owners can configure integrations
	if (orgRole !== "org:admin" && orgRole !== "org:owner") {
		return new Response("Forbidden", { status: 403 });
	}

	let body;
	try {
		body = await req.json();
	} catch (e) {
		return new Response("Invalid JSON", { status: 400 });
	}

	const result = SelectTenantSchema.safeParse(body);
	if (!result.success) {
		return new Response("Invalid input", { status: 400 });
	}

	const { grantId, tenantId } = result.data;

	// 1. Validate Grant belongs to Org
	const grant = await db.query.integrationGrants.findFirst({
		where: and(
			eq(integrationGrants.id, grantId),
			eq(integrationGrants.clerkOrgId, orgId),
		),
	});

	if (!grant) {
		return new Response("Grant not found or access denied", { status: 404 });
	}

	// 2. Validate Tenant is accessible by this Grant
	// We must call Xero to ensure this grant actually sees this tenant.
	// This prevents a user from guessing a tenant ID they shouldn't access.
	try {
		const accessToken = decryptToken(grant.accessTokenEnc);
		const tenants = await xeroAdapter.getTenants(accessToken);

		const targetTenant = tenants.find((t) => t.tenantId === tenantId);
		if (!targetTenant) {
			return new Response("Tenant not found in this connection", {
				status: 404,
			});
		}

		// 3. Bind Tenant
		// Logic:
		// - If binding exists for this (provider, externalId), update it to point to THIS grant (reconnect/switch user).
		// - If binding exists but for DIFFERENT org -> Error (Conflict).
		// - Else create new binding.

		const existingBinding = await db.query.integrationTenantBindings.findFirst({
			where: and(
				eq(integrationTenantBindings.provider, "xero"),
				eq(integrationTenantBindings.externalTenantId, tenantId),
			),
		});

		if (existingBinding) {
			if (existingBinding.clerkOrgId !== orgId) {
				// Hard Requirement: "If exists in another org: Throw 409."
				return new Response(
					"Tenant already connected to another organization",
					{ status: 409 },
				);
			}

			// Same org, update grant
			await db
				.update(integrationTenantBindings)
				.set({
					activeGrantId: grantId,
					status: "active",
					updatedAt: new Date(),
					externalTenantName: targetTenant.tenantName, // Update name in case it changed
				})
				.where(eq(integrationTenantBindings.id, existingBinding.id));
		} else {
			// Create new binding
			await db.insert(integrationTenantBindings).values({
				clerkOrgId: orgId,
				provider: "xero",
				externalTenantId: tenantId,
				externalTenantName: targetTenant.tenantName,
				activeGrantId: grantId,
				status: "active",
			});

			// First-time connection: sync Clerk org name from Xero tenant
			// This is non-blocking - failures are logged but don't affect the connection
			syncClerkOrgNameFromXero(orgId, targetTenant.tenantName).then(
				(syncResult) => {
					if (syncResult.synced) {
						console.log("Clerk org name synced successfully:", {
							orgId,
							xeroTenantName: targetTenant.tenantName,
							previousName: syncResult.previousName,
						});
					} else if (syncResult.error) {
						console.warn(
							"Clerk org name sync skipped or failed:",
							syncResult.error,
						);
					}
				},
			);
		}

		return Response.json({ success: true });
	} catch (e) {
		console.error("Select tenant error:", e);
		return new Response("Failed to select tenant", { status: 500 });
	}
}
