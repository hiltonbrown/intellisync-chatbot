import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { integrationGrants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/utils/encryption";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";

const xeroAdapter = new XeroAdapter();

export async function GET(req: Request) {
    const { userId, orgId, orgRole } = await auth();
    const { searchParams } = new URL(req.url);
    const grantId = searchParams.get("grantId");

    if (!userId || !orgId) {
        return new Response("Unauthorized", { status: 401 });
    }

    if (orgRole !== "org:admin" && orgRole !== "org:owner") {
         return new Response("Forbidden", { status: 403 });
    }

    if (!grantId) {
        return new Response("Missing grantId", { status: 400 });
    }

    // Check grant exists and belongs to org
    const grant = await db.query.integrationGrants.findFirst({
        where: and(
            eq(integrationGrants.id, grantId),
            eq(integrationGrants.clerkOrgId, orgId)
        )
    });

    if (!grant) {
        return new Response("Grant not found", { status: 404 });
    }

    // Fetch tenants from Xero
    try {
        const accessToken = decryptToken(grant.accessTokenEnc);
        const tenants = await xeroAdapter.getTenants(accessToken);
        return Response.json(tenants);
    } catch (e) {
        console.error("Failed to list tenants for grant:", e);
        return new Response("Failed to list tenants", { status: 500 });
    }
}
