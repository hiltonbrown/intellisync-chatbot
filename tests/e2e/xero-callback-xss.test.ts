import { expect, test } from "@playwright/test";

/**
 * E2E test suite for XSS prevention in Xero OAuth callback error handling
 *
 * This tests the fix for code scanning alert #4 (Reflected XSS) in app/api/xero/callback/route.ts
 *
 * These tests verify that the actual API route properly escapes malicious error parameters
 * by making real HTTP requests to the endpoint and validating the response.
 *
 * Unlike the previous unit tests that tested the escape-html library itself, these tests
 * verify the end-to-end behavior of the route handler, ensuring that:
 * 1. Malicious input is properly escaped in the HTTP response
 * 2. The XSS vulnerability is fixed in practice, not just in theory
 * 3. The route behaves correctly under real-world conditions
 *
 * Note: These tests require a running Next.js development server with proper environment
 * variables configured. The Playwright test runner handles server startup automatically.
 */

test.describe("Xero Callback XSS Prevention - E2E Tests", () => {
	test("escapes script tags in error parameter", async ({ request }) => {
		const maliciousError = '<script>alert("XSS")</script>';

		const response = await request.get("/api/xero/callback", {
			params: {
				error: maliciousError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Verify that the error is escaped and doesn't contain executable script tags
		expect(body).not.toContain("<script>");
		expect(body).not.toContain("</script>");

		// Verify that the error is properly escaped with HTML entities
		expect(body).toContain("&lt;script&gt;");
		expect(body).toContain("&lt;/script&gt;");

		// Verify the full escaped content is present
		expect(body).toContain(
			"&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;",
		);
	});

	test("escapes image tag with onerror handler", async ({ request }) => {
		const maliciousError = '<img src=x onerror="alert(1)">';

		const response = await request.get("/api/xero/callback", {
			params: {
				error: maliciousError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Verify that the malicious tag is escaped
		expect(body).not.toContain("<img");
		expect(body).not.toContain("onerror=");

		// Verify HTML entities are present
		expect(body).toContain("&lt;img");
		expect(body).toContain("&gt;");
	});

	test("escapes iframe with javascript protocol", async ({ request }) => {
		const maliciousError = '<iframe src="javascript:alert(1)"></iframe>';

		const response = await request.get("/api/xero/callback", {
			params: {
				error: maliciousError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Verify that the iframe tag is escaped
		expect(body).not.toContain("<iframe");
		expect(body).not.toContain("</iframe>");

		// Verify HTML entities are present
		expect(body).toContain("&lt;iframe");
		expect(body).toContain("&lt;/iframe&gt;");
	});

	test("escapes SVG with onload event", async ({ request }) => {
		const maliciousError = "<svg onload=alert(1)>";

		const response = await request.get("/api/xero/callback", {
			params: {
				error: maliciousError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Verify that the SVG tag is escaped
		expect(body).not.toContain("<svg");
		expect(body).not.toContain("onload=");

		// Verify HTML entities are present
		expect(body).toContain("&lt;svg");
	});

	test("escapes attribute breakout attempt", async ({ request }) => {
		const maliciousError = '" onmouseover="alert(1)"';

		const response = await request.get("/api/xero/callback", {
			params: {
				error: maliciousError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Verify that quotes are escaped to prevent attribute breakout
		expect(body).toContain("&quot;");
		expect(body).not.toContain('" onmouseover="');
	});

	test("escapes closing tag injection attempt", async ({ request }) => {
		const maliciousError = '"><script>alert(1)</script>';

		const response = await request.get("/api/xero/callback", {
			params: {
				error: maliciousError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Verify that script tags are escaped
		expect(body).not.toContain("<script>");
		expect(body).toContain("&quot;&gt;&lt;script&gt;");
	});

	test("preserves safe error messages without modification", async ({
		request,
	}) => {
		const safeError = "access_denied";

		const response = await request.get("/api/xero/callback", {
			params: {
				error: safeError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Safe error should be present and not modified
		expect(body).toContain("Xero Auth Error: access_denied");
	});

	test("escapes complex multi-vector XSS attempt", async ({ request }) => {
		const maliciousError =
			"<img src=x onerror=\"alert('XSS')\" & onload=alert(1)>";

		const response = await request.get("/api/xero/callback", {
			params: {
				error: maliciousError,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Verify all dangerous characters are escaped
		expect(body).not.toContain("<img");
		expect(body).not.toContain("onerror=");
		expect(body).not.toContain("onload=");

		// Verify proper escaping of all special characters
		expect(body).toContain("&lt;img");
		expect(body).toContain("&amp;");
		expect(body).toContain("&#39;"); // Single quote
		expect(body).toContain("&quot;"); // Double quote
	});

	test("handles empty error parameter safely", async ({ request }) => {
		const response = await request.get("/api/xero/callback", {
			params: {
				error: "",
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.text();

		// Should handle empty string without issues
		expect(body).toContain("Xero Auth Error:");
	});
});
