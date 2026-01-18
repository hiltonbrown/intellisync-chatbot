import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { integrationTenantBindings, integrationGrants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: Request) {
    const { orgId } = await auth();

    if (!orgId) {
        return new Response("Unauthorized", { status: 401 });
    }

    // Get all active bindings for this org
    const bindings = await db
        .select()
        .from(integrationTenantBindings)
        .where(
            and(
                eq(integrationTenantBindings.clerkOrgId, orgId),
                eq(integrationTenantBindings.status, "active")
            )
        );

    // Get all grants for this org (to see who connected what, or if we have unused grants)
    // We explicitly exclude the secrets!
    const grants = await db
        .select({
            id: integrationGrants.id,
            status: integrationGrants.status,
            authorisedByClerkUserId: integrationGrants.authorisedByClerkUserId,
            createdAt: integrationGrants.createdAt,
            expiresAt: integrationGrants.expiresAt
        })
        .from(integrationGrants)
        .where(eq(integrationGrants.clerkOrgId, orgId));

    return Response.json({
        bindings,
        grants
    });
}
