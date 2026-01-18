import "server-only";

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
			console.error("Missing Xero credentials");
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
			const error = await response.text();
			throw new Error(`Xero token exchange failed: ${error}`);
		}

		return response.json();
	}

	async refreshTokens(refreshToken: string): Promise<XeroTokenSet> {
		const credentials = Buffer.from(
			`${this.clientId}:${this.clientSecret}`,
		).toString("base64");

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
			const error = await response.text();
			throw new Error(`Xero token refresh failed: ${error}`);
		}

		return response.json();
	}

	async getTenants(accessToken: string): Promise<XeroTenant[]> {
		const response = await fetch("https://api.xero.com/connections", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Xero getTenants failed: ${error}`);
		}

		return response.json();
	}

	async revokeToken(token: string): Promise<void> {
		const credentials = Buffer.from(
			`${this.clientId}:${this.clientSecret}`,
		).toString("base64");

		await fetch("https://identity.xero.com/connect/revocation", {
			method: "POST",
			headers: {
				Authorization: `Basic ${credentials}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				token,
			}),
		});
	}

	getApiClient(accessToken: string, tenantId: string) {
		return {
			// Basic fetch wrapper with injected headers
			fetch: async (path: string, init?: RequestInit) => {
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
                    throw new Error("Xero API 401 Unauthorized");
                }

				return response;
			},
		};
	}
}
