import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { randomBytes } from "crypto";

const xeroAdapter = new XeroAdapter();

export async function GET(req: Request) {
	const { userId, orgId, orgRole } = await auth();

	if (!userId || !orgId) {
		return new Response("Unauthorized: Org context required", { status: 401 });
	}

	const allowedRoles = ["org:admin", "org:owner"];
	if (!orgRole || !allowedRoles.includes(orgRole)) {
		return new Response("Forbidden: Admin access required", { status: 403 });
	}

    // State encodes the context to return to
    // Using randomBytes for secure nonce
	const state = Buffer.from(
		JSON.stringify({
			clerk_user_id: userId,
			clerk_org_id: orgId,
            nonce: randomBytes(32).toString("hex"),
            timestamp: Date.now()
		}),
	).toString("base64");

	const url = xeroAdapter.getAuthUrl(state);

	redirect(url);
}
