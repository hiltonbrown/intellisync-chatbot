import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const xeroAdapter = new XeroAdapter();

export async function GET(req: Request) {
	const { userId, orgId, orgRole } = await auth();

	if (!userId || !orgId) {
		return new Response("Unauthorized: Org context required", { status: 401 });
	}

	if (orgRole !== "org:admin" && orgRole !== "org:owner" && orgRole !== "org:creator") {
		// Adjust roles based on Clerk configuration. "org:creator" is sometimes used.
        // Assuming admin/owner/creator has permission.
        // If strictly admin/owner:
        if (orgRole !== "org:admin" && orgRole !== "org:owner") {
		    return new Response("Unauthorized: Admin access required", { status: 403 });
        }
	}

    // State encodes the context to return to
	const state = Buffer.from(
		JSON.stringify({
			clerk_user_id: userId,
			clerk_org_id: orgId,
            nonce: Math.random().toString(36).substring(7) // Simple nonce
		}),
	).toString("base64");

	const url = xeroAdapter.getAuthUrl(state);

	redirect(url);
}
