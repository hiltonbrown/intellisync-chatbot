import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { integrationConnections } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/integrations/encryption";
import { verifyState } from "@/lib/integrations/state";
import {
  exchangeXeroAuthCode,
  fetchXeroConnections,
} from "@/lib/integrations/xero/oauth";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing OAuth parameters", { status: 400 });
  }

  const payload = verifyState(state);
  if (!payload) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  if (Date.now() - payload.issuedAt > STATE_MAX_AGE_MS) {
    return new Response("Expired OAuth state", { status: 400 });
  }

  const tokenResponse = await exchangeXeroAuthCode(code);
  const connections = await fetchXeroConnections(tokenResponse.access_token);

  if (connections.length === 0) {
    return new Response("No Xero tenants connected", { status: 400 });
  }

  const tenantIds = connections.map((connection) => connection.tenantId);

  const existingConnections = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.provider, "xero"),
        inArray(integrationConnections.externalAccountId, tenantIds)
      )
    );

  const conflicting = existingConnections.find(
    (connection) => connection.clerkOrgId !== payload.clerkOrgId
  );

  if (conflicting) {
    return new Response(
      "One or more tenants are already connected to another organization",
      { status: 409 }
    );
  }

  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

  await db.transaction(async (tx) => {
    for (const connection of connections) {
      await tx
        .insert(integrationConnections)
        .values({
          provider: "xero",
          clerkOrgId: payload.clerkOrgId,
          createdByClerkUserId: payload.clerkUserId,
          externalAccountId: connection.tenantId,
          externalAccountName: connection.tenantName ?? "Xero Tenant",
          accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
          refreshTokenEncrypted: encryptSecret(tokenResponse.refresh_token),
          expiresAtUtc: expiresAt,
          scopes: tokenResponse.scope ?? null,
          state: "active",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            integrationConnections.provider,
            integrationConnections.externalAccountId,
          ],
          set: {
            clerkOrgId: payload.clerkOrgId,
            createdByClerkUserId: payload.clerkUserId,
            externalAccountName: connection.tenantName ?? "Xero Tenant",
            accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
            refreshTokenEncrypted: encryptSecret(tokenResponse.refresh_token),
            expiresAtUtc: expiresAt,
            scopes: tokenResponse.scope ?? null,
            state: "active",
            updatedAt: new Date(),
          },
        });
    }
  });

  return new Response("Xero connected", { status: 200 });
}
