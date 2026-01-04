import { auth } from "@clerk/nextjs/server";
import { signState } from "@/lib/integrations/state";
import { buildXeroAuthorizationUrl } from "@/lib/integrations/xero/oauth";

const REQUIRED_ROLES = new Set(["owner", "admin"]);

export async function POST() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!orgId || !orgRole) {
    return new Response("Organization context required", { status: 400 });
  }

  if (!REQUIRED_ROLES.has(orgRole)) {
    return new Response("Forbidden", { status: 403 });
  }

  const state = signState({
    clerkOrgId: orgId,
    clerkUserId: userId,
    issuedAt: Date.now(),
  });

  const scopes = [
    "offline_access",
    "accounting.transactions",
    "accounting.contacts",
    "accounting.settings",
  ];

  const redirectUrl = buildXeroAuthorizationUrl({ state, scopes });

  return Response.redirect(redirectUrl, 303);
}
