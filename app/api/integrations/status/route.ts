import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrationGrants, integrationTenantBindings } from "@/lib/db/schema";

export async function GET(req: Request) {
	const { orgId } = await auth();

	if (!orgId) {
		return new Response("Unauthorized", { status: 401 });
	}

	// Get all active bindings for this org with grant details
	const bindingsWithGrants = await db
		.select({
			// Binding fields
			id: integrationTenantBindings.id,
			externalTenantName: integrationTenantBindings.externalTenantName,
			externalTenantId: integrationTenantBindings.externalTenantId,
			status: integrationTenantBindings.status,
			bindingCreatedAt: integrationTenantBindings.createdAt,
			bindingUpdatedAt: integrationTenantBindings.updatedAt,
			// Grant fields (joined)
			grantId: integrationGrants.id,
			grantStatus: integrationGrants.status,
			grantCreatedAt: integrationGrants.createdAt,
			grantUpdatedAt: integrationGrants.updatedAt,
			grantExpiresAt: integrationGrants.expiresAt,
			grantLastUsedAt: integrationGrants.lastUsedAt,
			grantRefreshTokenIssuedAt: integrationGrants.refreshTokenIssuedAt,
		})
		.from(integrationTenantBindings)
		.innerJoin(
			integrationGrants,
			eq(integrationTenantBindings.activeGrantId, integrationGrants.id),
		)
		.where(
			and(
				eq(integrationTenantBindings.clerkOrgId, orgId),
				eq(integrationTenantBindings.status, "active"),
			),
		);

	// Get all grants for this org (to see who connected what, or if we have unused grants)
	// We explicitly exclude the secrets!
	const grants = await db
		.select({
			id: integrationGrants.id,
			status: integrationGrants.status,
			authorisedByClerkUserId: integrationGrants.authorisedByClerkUserId,
			createdAt: integrationGrants.createdAt,
			expiresAt: integrationGrants.expiresAt,
		})
		.from(integrationGrants)
		.where(eq(integrationGrants.clerkOrgId, orgId));

	return Response.json({
		bindings: bindingsWithGrants,
		grants,
	});
}
