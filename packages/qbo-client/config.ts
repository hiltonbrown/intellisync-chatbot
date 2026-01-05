export type QboEnvironment = "production" | "sandbox"

export interface QboConfig {
  clientId: string
  clientSecret: string
  redirectUri?: string
  environment: QboEnvironment
  tokenEndpoint: string
  authorizationEndpoint: string
  apiBaseUrl: string
}

const DEFAULT_TOKEN_ENDPOINT = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
const DEFAULT_AUTH_ENDPOINT = "https://appcenter.intuit.com/connect/oauth2"
const DEFAULT_API_BASE_URL = "https://quickbooks.api.intuit.com"
const DEFAULT_SANDBOX_API_BASE_URL = "https://sandbox-quickbooks.api.intuit.com"

export const loadQboConfig = (): QboConfig => {
  const clientId = process.env.QBO_CLIENT_ID
  const clientSecret = process.env.QBO_CLIENT_SECRET

  if (!clientId) {
    throw new Error("QBO_CLIENT_ID is required")
  }

  if (!clientSecret) {
    throw new Error("QBO_CLIENT_SECRET is required")
  }

  const environment = (process.env.QBO_ENV as QboEnvironment) ?? "sandbox"
  const baseUrl =
    process.env.QBO_API_BASE_URL ??
    (environment === "production" ? DEFAULT_API_BASE_URL : DEFAULT_SANDBOX_API_BASE_URL)

  return {
    clientId,
    clientSecret,
    redirectUri: process.env.QBO_REDIRECT_URI,
    environment,
    tokenEndpoint: process.env.QBO_TOKEN_ENDPOINT ?? DEFAULT_TOKEN_ENDPOINT,
    authorizationEndpoint: process.env.QBO_AUTH_ENDPOINT ?? DEFAULT_AUTH_ENDPOINT,
    apiBaseUrl: baseUrl,
  }
}
