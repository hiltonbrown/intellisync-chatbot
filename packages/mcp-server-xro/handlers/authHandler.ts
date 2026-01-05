import crypto from "crypto"
import type { MCPHandler } from "../../../types/mcp"
import { loadXeroConfig } from "../../xero-client/config"
import type { XeroClient } from "../../xero-client/client"
import type { OAuthTokenSet } from "../../xero-client/tokenManager"

interface AuthenticateParams {
  code?: string
  codeVerifier?: string
  redirectUri?: string
  tenantId?: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  scopes?: string[]
}

interface AuthenticateResult {
  authorizationUrl?: string
  codeVerifier?: string
  state?: string
  token?: OAuthTokenSet
  tenantId?: string
  connections?: { tenantId: string; tenantName: string }[]
}

const base64UrlEncode = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

const createCodeVerifier = (): string => base64UrlEncode(crypto.randomBytes(32))

const createCodeChallenge = (verifier: string): string =>
  base64UrlEncode(crypto.createHash("sha256").update(verifier).digest())

export const authenticate = (client: XeroClient): MCPHandler<AuthenticateParams, AuthenticateResult> =>
  async (params) => {
    const config = loadXeroConfig()

    if (params.accessToken) {
      await client.setAccessToken(params.accessToken, params.expiresIn)
    }

    if (params.code && params.codeVerifier) {
      const token = await client.exchangeAuthorizationCode(params.code, params.codeVerifier)
      client.setOAuthToken(token)
    } else if (params.refreshToken) {
      const token = await client.refreshAccessToken(params.refreshToken)
      client.setOAuthToken(token)
    }

    if (params.tenantId) {
      client.setTenantId(params.tenantId)
    }

    if (params.code || params.refreshToken || params.accessToken) {
      const connections = await client.listConnections()
      const primary = connections[0]

      if (primary && !params.tenantId) {
        client.setTenantId(primary.tenantId)
      }

      return {
        token: client.getOAuthToken() ?? undefined,
        tenantId: primary?.tenantId ?? params.tenantId,
        connections: connections.map((connection) => ({
          tenantId: connection.tenantId,
          tenantName: connection.tenantName,
        })),
      }
    }

    const codeVerifier = createCodeVerifier()
    const codeChallenge = createCodeChallenge(codeVerifier)
    const state = base64UrlEncode(crypto.randomBytes(12))
    const scopes = params.scopes?.length
      ? params.scopes
      : ["offline_access", "accounting.contacts", "accounting.settings", "accounting.transactions"]

    const query = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: params.redirectUri ?? config.redirectUri ?? "",
      scope: scopes.join(" "),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    })

    return {
      authorizationUrl: `https://login.xero.com/identity/connect/authorize?${query.toString()}`,
      codeVerifier,
      state,
    }
  }

export const refresh = (client: XeroClient): MCPHandler<{ refreshToken: string }, AuthenticateResult> =>
  async ({ refreshToken }) => {
    const token = await client.refreshAccessToken(refreshToken)
    client.setOAuthToken(token)

    const connections = await client.listConnections()
    const primary = connections[0]

    if (primary) {
      client.setTenantId(primary.tenantId)
    }

    return {
      token,
      tenantId: primary?.tenantId,
      connections: connections.map((connection) => ({
        tenantId: connection.tenantId,
        tenantName: connection.tenantName,
      })),
    }
  }
