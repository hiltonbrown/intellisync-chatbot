export interface OAuthTokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export interface TokenStore {
  getToken(): OAuthTokenSet | null
  setToken(token: OAuthTokenSet): void
}

export class InMemoryTokenStore implements TokenStore {
  private token: OAuthTokenSet | null = null

  getToken(): OAuthTokenSet | null {
    return this.token
  }

  setToken(token: OAuthTokenSet): void {
    this.token = token
  }
}

export class TokenManager {
  constructor(
    private readonly store: TokenStore,
    private readonly refreshFn: (refreshToken: string) => Promise<OAuthTokenSet>
  ) {}

  getToken(): OAuthTokenSet | null {
    return this.store.getToken()
  }

  setToken(token: OAuthTokenSet): void {
    this.store.setToken(token)
  }

  async getValidAccessToken(): Promise<string> {
    const token = this.store.getToken()
    if (!token) {
      throw new Error("No OAuth token available")
    }

    if (token.expiresAt && token.expiresAt > Date.now()) {
      return token.accessToken
    }

    if (!token.refreshToken) {
      return token.accessToken
    }

    const refreshed = await this.refreshFn(token.refreshToken)
    this.store.setToken(refreshed)
    return refreshed.accessToken
  }
}
