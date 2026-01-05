import type {
  Account,
  Contact,
  CreateContactInput,
  CreateInvoiceInput,
  Connection,
  Invoice,
  InvoiceResponse,
} from "../../types/xero"
import { loadXeroConfig } from "./config"
import type { OAuthTokenSet, TokenManager } from "./tokenManager"

export interface XeroClientOptions {
  tokenManager: TokenManager
  tenantId?: string
}

export class XeroClient {
  private readonly config = loadXeroConfig()

  constructor(private readonly options: XeroClientOptions) {}

  setTenantId(tenantId: string): void {
    this.options.tenantId = tenantId
  }

  async listContacts(): Promise<Contact[]> {
    const response = await this.request<{ Contacts: Contact[] }>("/Contacts")
    return response.Contacts
  }

  async createContacts(payload: CreateContactInput[]): Promise<Contact[]> {
    const response = await this.request<{ Contacts: Contact[] }>("/Contacts", {
      method: "POST",
      body: JSON.stringify({ Contacts: payload }),
    })
    return response.Contacts
  }

  async listAccounts(): Promise<Account[]> {
    const response = await this.request<{ Accounts: Account[] }>("/Accounts")
    return response.Accounts
  }

  async createInvoice(payload: CreateInvoiceInput): Promise<Invoice> {
    const response = await this.request<InvoiceResponse>("/Invoices", {
      method: "POST",
      body: JSON.stringify({ Invoices: [payload] }),
    })
    return response.Invoices[0]
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const response = await this.request<InvoiceResponse>(`/Invoices/${invoiceId}`)
    return response.Invoices[0]
  }

  async updateInvoice(invoiceId: string, payload: CreateInvoiceInput): Promise<Invoice> {
    const response = await this.request<InvoiceResponse>(`/Invoices/${invoiceId}`, {
      method: "PUT",
      body: JSON.stringify({ Invoices: [payload] }),
    })
    return response.Invoices[0]
  }

  async listConnections(): Promise<Connection[]> {
    const response = await this.requestIdentity<Connection[]>("/connections")
    return response
  }

  async exchangeAuthorizationCode(code: string, codeVerifier: string): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri || "",
      code_verifier: codeVerifier,
    })

    const response = await this.fetchToken(body)
    return response
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

  setOAuthToken(token: OAuthTokenSet): void {
    this.options.tokenManager.setToken(token)
  }

  getOAuthToken(): OAuthTokenSet | null {
    return this.options.tokenManager.getToken()
  }

  private async fetchToken(body: URLSearchParams): Promise<OAuthTokenSet> {
    const basicAuth = this.config.clientSecret
      ? Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")
      : Buffer.from(this.config.clientId).toString("base64")

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

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.options.tokenManager.getValidAccessToken()
    const tenantId = this.options.tenantId
    if (!tenantId) {
      throw new Error("Xero tenant ID is required")
    }

    const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Xero-tenant-id": tenantId,
        ...(init.headers ?? {}),
      },
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`Xero API error (${response.status}): ${message}`)
    }

    return (await response.json()) as T
  }

  private async requestIdentity<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.options.tokenManager.getValidAccessToken()

    const response = await fetch(`https://api.xero.com${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {}),
      },
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`Xero identity error (${response.status}): ${message}`)
    }

    return (await response.json()) as T
  }
}
