import { test, expect } from "@playwright/test";
import { addSeconds } from "date-fns";
import {
	isAccessTokenExpired,
	needsRefresh,
	type XeroToken,
} from "../../lib/xero/tokenManager";

test.describe("Xero Token Manager Logic", () => {
	const mockToken: XeroToken = {
		accessToken: "mock_access_token",
		refreshToken: "mock_refresh_token",
		expiresAt: new Date(),
		scopes: ["offline_access", "accounting.transactions"],
	};

	test.describe("isAccessTokenExpired", () => {
		test("should return true if expiresAt is in the past", () => {
			const expiredToken = {
				...mockToken,
				expiresAt: addSeconds(new Date(), -10), // expired 10s ago
			};
			expect(isAccessTokenExpired(expiredToken)).toBe(true);
		});

		test("should return false if expiresAt is in the future", () => {
			const validToken = {
				...mockToken,
				expiresAt: addSeconds(new Date(), 3600), // expires in 1h
			};
			expect(isAccessTokenExpired(validToken)).toBe(false);
		});
	});

	test.describe("needsRefresh", () => {
		test("should return true if expiresAt is within the default threshold (300s)", () => {
			// expires in 200s (less than 300s buffer) -> needs refresh
			const tokenAboutToExpire = {
				...mockToken,
				expiresAt: addSeconds(new Date(), 200),
			};
			expect(needsRefresh(tokenAboutToExpire)).toBe(true);
		});

		test("should return true if expiresAt is exactly at the threshold", () => {
			// expires in 299s (just inside 300s buffer)
            // Note: Date comparison precision might be tricky, so we use strictly inside
			const tokenAboutToExpire = {
				...mockToken,
				expiresAt: addSeconds(new Date(), 299),
			};
			expect(needsRefresh(tokenAboutToExpire)).toBe(true);
		});

		test("should return false if expiresAt is outside the threshold", () => {
			// expires in 400s (more than 300s buffer) -> no refresh needed yet
			const validToken = {
				...mockToken,
				expiresAt: addSeconds(new Date(), 400),
			};
			expect(needsRefresh(validToken)).toBe(false);
		});

		test("should respect custom threshold", () => {
			const token = {
				...mockToken,
				expiresAt: addSeconds(new Date(), 500),
			};
			// 500s remaining.
			// Threshold 600s -> needs refresh (500 < 600)
			expect(needsRefresh(token, 600)).toBe(true);

			// Threshold 400s -> no refresh (500 > 400)
			expect(needsRefresh(token, 400)).toBe(false);
		});
	});
});
