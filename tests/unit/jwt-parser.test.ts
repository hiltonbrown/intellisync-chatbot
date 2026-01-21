import assert from "node:assert";
import { test } from "node:test";
import {
	parseXeroAccessToken,
	safeParseXeroAccessToken,
} from "../../lib/integrations/jwt-parser";

function createMockJwt(payload: Record<string, any>): string {
	const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
		"base64",
	);
	const body = Buffer.from(JSON.stringify(payload)).toString("base64");
	return `${header}.${body}.signature`;
}

test("parseXeroAccessToken extracts exp claim correctly", () => {
	const expUnixSeconds = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
	const mockToken = createMockJwt({
		exp: expUnixSeconds,
		iat: expUnixSeconds - 1800,
		authentication_event_id: "test-event-123",
		xero_userid: "user-456",
	});

	const result = parseXeroAccessToken(mockToken);

	assert.strictEqual(
		result.expiresAt.getTime(),
		expUnixSeconds * 1000,
		"expiresAt should match exp claim",
	);
	assert.strictEqual(result.xero_userid, "user-456");
});

test("parseXeroAccessToken throws on invalid format", () => {
	assert.throws(() => {
		parseXeroAccessToken("invalid.token");
	}, /Invalid JWT format/);
});

test("parseXeroAccessToken throws on missing exp", () => {
	const mockToken = createMockJwt({
		iat: 1234567890,
	});
	assert.throws(() => {
		parseXeroAccessToken(mockToken);
	}, /Missing exp claim/);
});

test("safeParseXeroAccessToken returns null on failure", () => {
	const result = safeParseXeroAccessToken("invalid.token");
	assert.strictEqual(result, null);
});

test("safeParseXeroAccessToken returns parsed token on success", () => {
	const exp = Math.floor(Date.now() / 1000);
	const mockToken = createMockJwt({ exp });
	const result = safeParseXeroAccessToken(mockToken);
	assert.ok(result);
	assert.strictEqual(result?.expiresAt.getTime(), exp * 1000);
});
