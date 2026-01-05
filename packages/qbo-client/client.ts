import type {
  Account,
  CreateCustomerInput,
  CreateInvoiceInput,
  Customer,
  Invoice,
  QueryResponse,
} from "../../types/qbo"
import { loadQboConfig } from "./config"
import type { OAuthTokenSet, TokenManager } from "./tokenManager"

export interface QboClientOptions {
  tokenManager: TokenManager
  realmId?: string
}

export class QboClient {
  private readonly config = loadQboConfig()

  constructor(private readonly options: QboClientOptions) {}

  setRealmId(realmId: string): void {
    this.options.realmId = realmId
  }

  getOAuthToken(): OAuthTokenSet | null {
    return this.options.tokenManager.getToken()
  }

  setOAuthToken(token: OAuthTokenSet): void {
    this.options.tokenManager.setToken(token)
  }

  async exchangeAuthorizationCode(code: string, codeVerifier?: string): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri ?? "",
    })

    if (codeVerifier) {
      body.set("code_verifier", codeVerifier)
    }

    return this.fetchToken(body)
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })

    return this.fetchToken(body)
  }

  async setAccessToken(accessToken: string, expiresIn?: number): Promise<void> {
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined
    this.options.tokenManager.setToken({ accessToken, expiresAt })
  }

  async listCustomers(): Promise<Customer[]> {
    const response = await this.query<Customer>("select * from Customer")
    return response.QueryResponse.Customer ?? []
  }

  async createCustomer(payload: CreateCustomerInput): Promise<Customer> {
    const response = await this.request<Customer>("/customer", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    return response
  }

  async listAccounts(): Promise<Account[]> {
    const response = await this.query<Account>("select * from Account")
    return response.QueryResponse.Account ?? []
  }

  async createInvoice(payload: CreateInvoiceInput): Promise<Invoice> {
    return this.request<Invoice>("/invoice", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoice/${invoiceId}`)
  }

  async updateInvoice(invoiceId: string, payload: CreateInvoiceInput): Promise<Invoice> {
    return this.request<Invoice>(`/invoice/${invoiceId}`, {
      method: "POST",
      body: JSON.stringify({ ...payload, Id: invoiceId, sparse: true }),
    })
  }

  private async fetchToken(body: URLSearchParams): Promise<OAuthTokenSet> {
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      "base64"
    )

    const response = await fetch(this.config.tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`Failed to obtain token: ${message}`)
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    const expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    }
  }

  private async query<T>(query: string): Promise<QueryResponse<T>> {
    return this.request<QueryResponse<T>>(`/query?query=${encodeURIComponent(query)}`)
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.options.tokenManager.getValidAccessToken()
    const realmId = this.options.realmId
    if (!realmId) {
      throw new Error("QuickBooks realm ID is required")
    }

    const response = await fetch(`${this.config.apiBaseUrl}/v3/company/${realmId}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {}),
      },
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`QuickBooks API error (${response.status}): ${message}`)
    }

    return (await response.json()) as T
  }
}
