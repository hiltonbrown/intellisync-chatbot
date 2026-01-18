import { expect, test } from "@playwright/test";

test.describe("User Settings", () => {
	test("saves and retrieves user settings", async ({ page }) => {
		// Navigate to personalization settings
		await page.goto("/settings/personalisation");

		// Fill in settings
		await page.fill('[id="companyName"]', "Test Company Pty Ltd");
		await page.selectOption('[id="timezone"]', "Australia/Brisbane");
		await page.selectOption('[id="baseCurrency"]', "AUD");
		await page.selectOption('[id="dateFormat"]', "DD/MM/YYYY");

		// Save
		await page.click('button[type="submit"]');

		// Wait for success message
		await expect(page.getByText("Settings saved successfully")).toBeVisible();

		// Refresh and verify persistence
		await page.reload();
		await expect(page.locator('[id="companyName"]')).toHaveValue(
			"Test Company Pty Ltd",
		);
		await expect(page.locator('[id="timezone"]')).toHaveValue(
			"Australia/Brisbane",
		);
	});

	test("validates company name length", async ({ page }) => {
		await page.goto("/settings/personalisation");

		// Try to enter a very long company name (>256 chars)
		const longName = "A".repeat(300);
		await page.fill('[id="companyName"]', longName);
		await page.click('button[type="submit"]');

		// Should show error
		await expect(
			page.getByText(/must be 256 characters or less/i),
		).toBeVisible();
	});

	test("defaults to Australia/Brisbane timezone", async ({ page }) => {
		await page.goto("/settings/personalisation");

		// Default should be Brisbane
		await expect(page.locator('[id="timezone"]')).toHaveValue(
			"Australia/Brisbane",
		);
	});

	test("shows error message when save fails", async ({ page }) => {
		await page.goto("/settings/personalisation");

		// Simulate network failure or invalid data
		await page.route("**/api/**", (route) => route.abort());

		await page.fill('[id="companyName"]', "Test Company");
		await page.click('button[type="submit"]');

		// Should show error message
		await expect(page.getByText(/failed|error/i)).toBeVisible();
	});
});
