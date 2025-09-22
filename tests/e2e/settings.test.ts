import { expect, test } from '../fixtures';

test.describe('Settings', () => {
  test('updates default chat model from preferences page', async ({ adaContext }) => {
    const { page } = adaContext;

    await page.goto('/settings/user-preferences');
    await expect(page.getByRole('heading', { name: 'User Preferences' })).toBeVisible();

    const selectorTrigger = page.getByTestId('default-model-selector');
    await selectorTrigger.click();

    await page
      .getByRole('option', { name: 'Llama 3.3 8B (Free)' })
      .click();

    await expect(selectorTrigger).toContainText('Llama 3.3 8B (Free)');

    await expect
      .poll(async () => {
        const cookies = await page.context().cookies(['http://localhost:3000']);
        return cookies.find((cookie) => cookie.name === 'chat-model')?.value;
      })
      .toBe('meta-llama/llama-3.3-8b-instruct:free');

    await page.goto('/');
    await expect(
      page.getByRole('button', { name: /Llama 3.3 8B \(Free\)/ }),
    ).toBeVisible();
  });
});
