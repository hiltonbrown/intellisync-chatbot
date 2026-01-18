import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { integrationTenantBindings, integrationGrants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { decryptToken } from "@/lib/utils/encryption";

const xeroAdapter = new XeroAdapter();

const DisconnectSchema = z.object({
    tenantBindingId: z.string()
});

export async function POST(req: Request) {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
        return new Response("Unauthorized", { status: 401 });
    }
     if (orgRole !== "org:admin" && orgRole !== "org:owner") {
         return new Response("Forbidden", { status: 403 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    const result = DisconnectSchema.safeParse(body);
    if (!result.success) {
        return new Response("Invalid input", { status: 400 });
    }

    const { tenantBindingId } = result.data;

    // 1. Verify Binding belongs to Org
    const binding = await db.query.integrationTenantBindings.findFirst({
        where: and(
            eq(integrationTenantBindings.id, tenantBindingId),
            eq(integrationTenantBindings.clerkOrgId, orgId)
        )
    });

    if (!binding) {
        return new Response("Binding not found", { status: 404 });
    }

    // 2. Disconnect (Mark Revoked)
    await db.update(integrationTenantBindings)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(integrationTenantBindings.id, tenantBindingId));

    // 3. Check if Grant is orphaned (no other active bindings use it)
    // "If its grant is no longer used by any bindings: Set grant = revoked."
    const grantId = binding.activeGrantId;

    const otherBindings = await db.query.integrationTenantBindings.findFirst({
        where: and(
            eq(integrationTenantBindings.activeGrantId, grantId),
            eq(integrationTenantBindings.status, "active") // Only care about active ones
        )
    });

    if (!otherBindings) {
        // Orphaned grant!
        const grant = await db.query.integrationGrants.findFirst({
            where: eq(integrationGrants.id, grantId)
        });

        if (grant && grant.status === 'active') {
             console.log(`Revoking orphaned grant ${grantId}`);

             // Optionally call Xero revoke
             try {
                 const token = decryptToken(grant.refreshTokenEnc); // Use refresh token to revoke
                 await xeroAdapter.revokeToken(token);
             } catch (e) {
                 console.warn("Failed to revoke token upstream:", e);
             }

             // Overwrite tokens in DB
             await db.update(integrationGrants)
                .set({
                    status: "revoked",
                    accessTokenEnc: "revoked",
                    refreshTokenEnc: "revoked",
                    updatedAt: new Date()
                })
                .where(eq(integrationGrants.id, grantId));
        }
    }

    return Response.json({ success: true });
}
