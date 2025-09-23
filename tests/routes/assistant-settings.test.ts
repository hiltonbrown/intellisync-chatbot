import { expect, test } from '@playwright/test';

const COOKIE_MODEL_ID = 'openai/gpt-5-mini';
const COOKIE_MODEL_LABEL = 'Gpt 5 Mini';

test.describe('assistant settings model selector', () => {
  test('shows the model stored in the chat-model cookie', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'chat-model',
        value: COOKIE_MODEL_ID,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/models') && response.ok(),
      ),
      page.goto('/settings/assistant-settings'),
    ]);

    const selectorTrigger = page.locator('button[aria-label="Select model"]');

    await expect(selectorTrigger).toContainText(COOKIE_MODEL_LABEL);
  });
});
