import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { XeroAdapter } from "@/lib/integrations/xero/adapter";
import { db } from "@/lib/db";
import { integrationGrants } from "@/lib/db/schema";
import { encryptToken } from "@/lib/utils/encryption";
import { addMinutes } from "date-fns";

const xeroAdapter = new XeroAdapter();

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");

	if (error) {
		return new Response(`Xero Auth Error: ${error}`, { status: 400 });
	}

	if (!code || !state) {
		return new Response("Missing code or state", { status: 400 });
	}

	let decodedState: { clerk_user_id: string; clerk_org_id: string };
	try {
		const json = Buffer.from(state, "base64").toString("utf-8");
		decodedState = JSON.parse(json);
	} catch (e) {
		return new Response("Invalid state parameter", { status: 400 });
	}

    // Verify current user matches the one who started the flow (Security check)
    // Note: In a callback, the cookie session should still be valid.
    const { userId, orgId } = await auth();

    // We strictly require the user who initiated the flow to complete it,
    // AND they must still be in the same org context if possible.
    // However, the callback comes from Xero, and Clerk might rely on cookies.
    // Use the state's user/org as the source of truth for who *authorized* it,
    // but verify the current session to ensure it's not a CSRF attack on a different user.

    if (!userId || userId !== decodedState.clerk_user_id) {
        return new Response("Unauthorized: User mismatch", { status: 403 });
    }

    // Org mismatch check is good practice too
    if (orgId && orgId !== decodedState.clerk_org_id) {
         // User switched orgs in the meantime?
         // We should probably bind it to the org in the state, but this mismatch is suspicious.
         console.warn("Org ID mismatch in callback", { current: orgId, state: decodedState.clerk_org_id });
    }


	try {
		// Exchange Code
		const tokenSet = await xeroAdapter.exchangeCode(code);

		// Store Grant
		const [grant] = await db
			.insert(integrationGrants)
			.values({
				authorisedByClerkUserId: decodedState.clerk_user_id,
				clerkOrgId: decodedState.clerk_org_id,
				provider: "xero",
				accessTokenEnc: encryptToken(tokenSet.access_token),
				refreshTokenEnc: encryptToken(tokenSet.refresh_token),
				expiresAt: addMinutes(new Date(), 30), // Default 30 mins
				status: "active",
			})
			.returning();

		// Redirect to settings page with grantId to trigger tenant selection
		redirect(`/settings/integrations?action=select_tenant&grantId=${grant.id}`);
	} catch (e) {
		console.error("Xero Callback Error:", e);
		return new Response("Failed to complete Xero connection", { status: 500 });
	}
}
