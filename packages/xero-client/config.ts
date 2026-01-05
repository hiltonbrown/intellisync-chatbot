export interface XeroConfig {
  clientId: string
  clientSecret?: string
  redirectUri?: string
  tokenEndpoint: string
  apiBaseUrl: string
}

const DEFAULT_TOKEN_ENDPOINT = "https://identity.xero.com/connect/token"
const DEFAULT_API_BASE_URL = "https://api.xero.com/api.xro/2.0"

export const loadXeroConfig = (): XeroConfig => {
  const clientId = process.env.XERO_CLIENT_ID
  if (!clientId) {
    throw new Error("XERO_CLIENT_ID is required")
  }

  return {
    clientId,
    clientSecret: process.env.XERO_CLIENT_SECRET,
    redirectUri: process.env.XERO_REDIRECT_URI,
    tokenEndpoint: process.env.XERO_TOKEN_ENDPOINT ?? DEFAULT_TOKEN_ENDPOINT,
    apiBaseUrl: process.env.XERO_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  }
}
