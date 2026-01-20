import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { integrationTenantBindings, integrationGrants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { decryptToken } from "@/lib/utils/encryption";
import { randomBytes } from "crypto";

const xeroAdapter = new XeroAdapter();

const DisconnectSchema = z.object({
    tenantBindingId: z.string()
});

export async function POST(req: Request) {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
        return new Response("Unauthorized", { status: 401 });
    }

    const allowedRoles = ["org:admin", "org:owner"];
    if (!orgRole || !allowedRoles.includes(orgRole)) {
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

	let revokeToken: string | null = null;

	const binding = await db.transaction(async (tx) => {
		// 1. Verify Binding belongs to Org
		const bindingRecord = await tx.query.integrationTenantBindings.findFirst({
			where: and(
				eq(integrationTenantBindings.id, tenantBindingId),
				eq(integrationTenantBindings.clerkOrgId, orgId),
			),
		});

		if (!bindingRecord) {
			return null;
		}

		// 2. Disconnect (Mark Revoked)
		await tx
			.update(integrationTenantBindings)
			.set({ status: "revoked", updatedAt: new Date() })
			.where(eq(integrationTenantBindings.id, tenantBindingId));

		// 3. Check if Grant is orphaned (no other active bindings use it)
		// "If its grant is no longer used by any bindings: Set grant = revoked."
		const grantId = bindingRecord.activeGrantId;

		// Lock the grant row to prevent concurrent orphan checks.
		await tx
			.select()
			.from(integrationGrants)
			.where(eq(integrationGrants.id, grantId))
			.for("update");

		const otherBindings = await tx.query.integrationTenantBindings.findFirst({
			where: and(
				eq(integrationTenantBindings.activeGrantId, grantId),
				eq(integrationTenantBindings.status, "active"), // Only care about active ones
			),
		});

		if (!otherBindings) {
			// Orphaned grant!
			const grant = await tx.query.integrationGrants.findFirst({
				where: eq(integrationGrants.id, grantId),
			});

			if (grant && grant.status === "active") {
				console.log(`Revoking orphaned grant ${grantId}`);

				revokeToken = decryptToken(grant.refreshTokenEnc);

				// Overwrite tokens in DB with random garbage
				await tx
					.update(integrationGrants)
					.set({
						status: "revoked",
						accessTokenEnc: randomBytes(64).toString("hex"),
						refreshTokenEnc: randomBytes(64).toString("hex"),
						updatedAt: new Date(),
					})
					.where(eq(integrationGrants.id, grantId));
			}
		}

		return bindingRecord;
	});

	if (!binding) {
		return new Response("Binding not found", { status: 404 });
	}

	if (revokeToken) {
		try {
			await xeroAdapter.revokeToken(revokeToken);
		} catch (e) {
			console.warn("Failed to revoke token upstream:", e);
		}
	}

    return Response.json({ success: true });
}
