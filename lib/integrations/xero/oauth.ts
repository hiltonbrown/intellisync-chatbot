import "server-only";

import { z } from "zod";
import { xeroConfig } from "./config";

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.string().optional(),
  token_type: z.string(),
});

export type XeroTokenResponse = z.infer<typeof tokenResponseSchema>;

export function buildXeroAuthorizationUrl({
  state,
  scopes,
}: {
  state: string;
  scopes: string[];
}): string {
  const url = new URL(xeroConfig.authUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", xeroConfig.clientId);
  url.searchParams.set("redirect_uri", xeroConfig.redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeXeroAuthCode(code: string) {
  const credentials = Buffer.from(
    `${xeroConfig.clientId}:${xeroConfig.clientSecret}`
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: xeroConfig.redirectUri,
  });

  const response = await fetch(xeroConfig.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Xero auth code");
  }

  const json = await response.json();
  return tokenResponseSchema.parse(json);
}

export async function refreshXeroTokens(refreshToken: string) {
  const credentials = Buffer.from(
    `${xeroConfig.clientId}:${xeroConfig.clientSecret}`
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(xeroConfig.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Xero token");
  }

  const json = await response.json();
  return tokenResponseSchema.parse(json);
}

const connectionSchema = z.object({
  tenantId: z.string(),
  tenantName: z.string().optional(),
  tenantType: z.string().optional(),
});

export type XeroConnection = z.infer<typeof connectionSchema>;

export async function fetchXeroConnections(accessToken: string) {
  const response = await fetch(xeroConfig.connectionsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Xero connections");
  }

  const json = await response.json();
  const parsed = z.array(connectionSchema).safeParse(json);
  if (!parsed.success) {
    throw new Error("Invalid Xero connections response");
  }

  return parsed.data;
}
