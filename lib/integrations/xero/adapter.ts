import "server-only";

import {
	AuthError,
	ConfigError,
	ExternalAPIError,
	RateLimitError,
	TokenError,
} from "@/lib/integrations/errors";

export interface XeroTokenSet {
	access_token: string;
	refresh_token: string;
	expires_in: number; // seconds
	id_token: string;
	token_type: string;
}

export interface XeroTenant {
	id: string;
	authEventId: string;
	tenantId: string;
	tenantType: string;
	tenantName: string;
	createdDateUtc: string;
	updatedDateUtc: string;
}

export class XeroAdapter {
	private clientId: string;
	private clientSecret: string;
	private redirectUri: string;

	constructor() {
		this.clientId = process.env.XERO_CLIENT_ID || "";
		this.clientSecret = process.env.XERO_CLIENT_SECRET || "";
		this.redirectUri = process.env.XERO_REDIRECT_URI || "";

		if (!this.clientId || !this.clientSecret || !this.redirectUri) {
			throw new ConfigError("Missing Xero credentials", {
				hasClientId: !!this.clientId,
				hasClientSecret: !!this.clientSecret,
				hasRedirectUri: !!this.redirectUri,
			});
		}
	}

	getAuthUrl(state: string): string {
		const scopes = [
			"offline_access",
			"accounting.transactions",
			"accounting.settings",
			"accounting.contacts",
		].join(" ");

		const params = new URLSearchParams({
			response_type: "code",
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
			scope: scopes,
			state: state,
		});

		return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
	}

	async exchangeCode(code: string): Promise<XeroTokenSet> {
		const credentials = Buffer.from(
			`${this.clientId}:${this.clientSecret}`,
		).toString("base64");

		try {
			const response = await fetch("https://identity.xero.com/connect/token", {
				method: "POST",
				headers: {
					Authorization: `Basic ${credentials}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code,
					redirect_uri: this.redirectUri,
				}),
			});

			if (!response.ok) {
				// Don't expose raw Xero error messages to prevent information disclosure
				throw new AuthError(
					"Failed to exchange authorization code",
					"TOKEN_EXCHANGE_FAILED",
					response.status,
					{ statusCode: response.status },
				);
			}

			return response.json();
		} catch (error) {
			if (error instanceof AuthError) {
				throw error;
			}
			// Network or unexpected errors
			throw new AuthError(
				"Failed to connect to Xero",
				"TOKEN_EXCHANGE_NETWORK_ERROR",
				502,
			);
		}
	}

	async refreshTokens(refreshToken: string): Promise<XeroTokenSet> {
		const credentials = Buffer.from(
			`${this.clientId}:${this.clientSecret}`,
		).toString("base64");

		try {
			const response = await fetch("https://identity.xero.com/connect/token", {
				method: "POST",
				headers: {
					Authorization: `Basic ${credentials}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: refreshToken,
				}),
			});

			if (!response.ok) {
				throw new TokenError(
					"Token refresh failed",
					"TOKEN_REFRESH_FAILED",
					response.status,
					{ statusCode: response.status },
				);
			}

			return response.json();
		} catch (error) {
			if (error instanceof TokenError) {
				throw error;
			}
			throw new TokenError(
				"Failed to connect to Xero for token refresh",
				"TOKEN_REFRESH_NETWORK_ERROR",
				502,
			);
		}
	}

	async getTenants(accessToken: string): Promise<XeroTenant[]> {
		try {
			const response = await fetch("https://api.xero.com/connections", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new ExternalAPIError(
					"Failed to fetch tenants from Xero",
					"xero",
					response.status,
				);
			}

			return response.json();
		} catch (error) {
			if (error instanceof ExternalAPIError) {
				throw error;
			}
			throw new ExternalAPIError(
				"Failed to connect to Xero API",
				"xero",
				undefined,
			);
		}
	}

	async revokeToken(token: string): Promise<void> {
		const credentials = Buffer.from(
			`${this.clientId}:${this.clientSecret}`,
		).toString("base64");

		try {
			const response = await fetch("https://identity.xero.com/connect/revocation", {
				method: "POST",
				headers: {
					Authorization: `Basic ${credentials}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					token,
				}),
			});

			if (!response.ok) {
				throw new TokenError(
					"Token revocation failed",
					"TOKEN_REVOCATION_FAILED",
					response.status,
					{ statusCode: response.status },
				);
			}
		} catch (error) {
			if (error instanceof TokenError) {
				throw error;
			}
			throw new TokenError(
				"Failed to connect to Xero for token revocation",
				"TOKEN_REVOCATION_NETWORK_ERROR",
				502,
			);
		}
	}

	getApiClient(accessToken: string, tenantId: string) {
		return {
			// Basic fetch wrapper with injected headers
			fetch: async (path: string, init?: RequestInit) => {
				try {
					const url = `https://api.xero.com/api.xro/2.0${path}`;
					const headers = new Headers(init?.headers);
					headers.set("Authorization", `Bearer ${accessToken}`);
					headers.set("Xero-tenant-id", tenantId);
					headers.set("Accept", "application/json");

					const response = await fetch(url, {
						...init,
						headers,
					});

					if (response.status === 401) {
						throw new TokenError(
							"Xero API returned unauthorized",
							"API_UNAUTHORIZED",
							401,
						);
					}

					if (response.status === 429) {
						const retryAfter = response.headers.get("Retry-After");
						const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;
						throw new RateLimitError(
							"Xero API rate limit exceeded",
							retryAfterSeconds,
							{ path },
						);
					}

					if (!response.ok) {
						throw new ExternalAPIError(
							"Xero API request failed",
							"xero",
							response.status,
							{ path },
						);
					}

					return response;
				} catch (error) {
					if (
						error instanceof TokenError ||
						error instanceof ExternalAPIError ||
						error instanceof RateLimitError
					) {
						throw error;
					}
					throw new ExternalAPIError(
						"Failed to connect to Xero API",
						"xero",
						undefined,
						{ path },
					);
				}
			},
		};
	}
}
