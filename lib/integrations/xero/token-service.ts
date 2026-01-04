import "server-only";

import { addMinutes } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { integrationConnections } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/integrations/encryption";
import { refreshXeroTokens } from "./oauth";

const EXPIRY_BUFFER_MINUTES = 5;

export async function getValidXeroAccessToken(
  clerkOrgId: string,
  tenantId: string
): Promise<string> {
  return db.transaction(async (tx) => {
    const [connection] = await tx
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.provider, "xero"),
          eq(integrationConnections.clerkOrgId, clerkOrgId),
          eq(integrationConnections.externalAccountId, tenantId)
        )
      )
      .for("update")
      .limit(1);

    if (!connection) {
      throw new Error("Xero connection not found");
    }

    if (connection.state === "disconnected") {
      throw new Error("Xero connection is disconnected");
    }

    if (connection.state === "reauth_required") {
      throw new Error("Xero connection requires reauthentication");
    }

    if (connection.state === "error") {
      throw new Error("Xero connection is in error state");
    }

    const expiresAt = new Date(connection.expiresAtUtc);
    const needsRefresh = expiresAt <= addMinutes(new Date(), EXPIRY_BUFFER_MINUTES);

    if (!needsRefresh) {
      return decryptSecret(connection.accessTokenEncrypted);
    }

    try {
      const refreshed = await refreshXeroTokens(
        decryptSecret(connection.refreshTokenEncrypted)
      );
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

      await tx
        .update(integrationConnections)
        .set({
          accessTokenEncrypted: encryptSecret(refreshed.access_token),
          refreshTokenEncrypted: encryptSecret(refreshed.refresh_token),
          expiresAtUtc: newExpiresAt,
          scopes: refreshed.scope ?? connection.scopes,
          state: "active",
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, connection.id));

      return refreshed.access_token;
    } catch (error) {
      await tx
        .update(integrationConnections)
        .set({ state: "reauth_required", updatedAt: new Date() })
        .where(eq(integrationConnections.id, connection.id));

      throw error;
    }
  });
}
