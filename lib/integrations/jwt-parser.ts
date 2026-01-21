export interface ParsedXeroToken {
	exp: number;
	iat: number;
	authentication_event_id: string;
	xero_userid: string;
	expiresAt: Date;
	[key: string]: any;
}

export function parseXeroAccessToken(accessToken: string): ParsedXeroToken {
	try {
		const parts = accessToken.split(".");
		if (parts.length !== 3) {
			throw new Error("Invalid JWT format: expected 3 parts");
		}

		// Ensure proper base64 padding/url decoding
		const base64Url = parts[1];
		const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
		const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");

		const payload = JSON.parse(jsonPayload);

		if (!payload.exp) {
			throw new Error("Missing exp claim in token");
		}

		return {
			...payload,
			expiresAt: new Date(payload.exp * 1000),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to parse Xero access token: ${message}`);
	}
}

export function safeParseXeroAccessToken(
	accessToken: string,
): ParsedXeroToken | null {
	try {
		return parseXeroAccessToken(accessToken);
	} catch (e) {
		return null;
	}
}
