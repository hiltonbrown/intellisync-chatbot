import crypto from "crypto"
import type { MCPHandler } from "../../../types/mcp"
import { loadQboConfig } from "../../qbo-client/config"
import type { QboClient } from "../../qbo-client/client"
import type { OAuthTokenSet } from "../../qbo-client/tokenManager"

interface AuthenticateParams {
  code?: string
  codeVerifier?: string
  redirectUri?: string
  realmId?: string
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
  realmId?: string
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

export const authenticate = (client: QboClient): MCPHandler<AuthenticateParams, AuthenticateResult> =>
  async (params) => {
    const config = loadQboConfig()

    if (params.accessToken) {
      await client.setAccessToken(params.accessToken, params.expiresIn)
    }

    if (params.code) {
      const token = await client.exchangeAuthorizationCode(params.code, params.codeVerifier)
      client.setOAuthToken(token)
    } else if (params.refreshToken) {
      const token = await client.refreshAccessToken(params.refreshToken)
      client.setOAuthToken(token)
    }

    if (params.realmId) {
      client.setRealmId(params.realmId)
    }

    if (params.code || params.refreshToken || params.accessToken) {
      return {
        token: client.getOAuthToken() ?? undefined,
        realmId: params.realmId,
      }
    }

    const codeVerifier = createCodeVerifier()
    const codeChallenge = createCodeChallenge(codeVerifier)
    const state = base64UrlEncode(crypto.randomBytes(12))
    const scopes = params.scopes?.length
      ? params.scopes
      : ["com.intuit.quickbooks.accounting", "openid", "email", "profile", "offline_access"]

    const query = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: params.redirectUri || config.redirectUri || "",
      scope: scopes.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    })

    return {
      authorizationUrl: `${config.authorizationEndpoint}?${query.toString()}`,
      codeVerifier,
      state,
    }
  }

export const refresh = (client: QboClient): MCPHandler<{ refreshToken: string; realmId?: string }, AuthenticateResult> =>
  async ({ refreshToken, realmId }) => {
    const token = await client.refreshAccessToken(refreshToken)
    client.setOAuthToken(token)

    if (realmId) {
      client.setRealmId(realmId)
    }

    return {
      token,
      realmId,
    }
  }
