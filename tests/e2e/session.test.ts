import { expect, test } from '../fixtures';
import { AuthPage } from '../pages/auth';
import { generateRandomTestUser } from '../helpers';
test.describe('Unauthenticated Access', () => {
  test('redirects visitors to the login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('allows direct navigation to authentication routes', async ({ page }) => {
    await page.goto('/login');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');

    await page.goto('/register');
    await page.waitForURL('/register');
    await expect(page).toHaveURL('/register');
  });
});

test.describe
  .serial('Login and Registration', () => {
    let authPage: AuthPage;

    const testUser = generateRandomTestUser();

    test.beforeEach(async ({ page }) => {
      authPage = new AuthPage(page);
    });

    test('Register new account', async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain('Account created successfully!');
    });

    test('Register new account with existing email', async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain('Account already exists!');
    });

    test('Log into account that exists', async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL('/');
      await expect(page.getByPlaceholder('Send a message...')).toBeVisible();
    });

    test('Display user email in user menu', async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL('/');
      await expect(page.getByPlaceholder('Send a message...')).toBeVisible();

      const userEmail = await page.getByTestId('user-email');
      await expect(userEmail).toHaveText(testUser.email);
    });

    test('Log out as non-guest user', async () => {
      await authPage.logout(testUser.email, testUser.password);
    });

    test('Log out is available for non-guest users', async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL('/');

      authPage.openSidebar();

      const userNavButton = page.getByTestId('user-nav-button');
      await expect(userNavButton).toBeVisible();

      await userNavButton.click();
      const userNavMenu = page.getByTestId('user-nav-menu');
      await expect(userNavMenu).toBeVisible();

      const authMenuItem = page.getByTestId('user-nav-item-auth');
      await expect(authMenuItem).toContainText('Sign out');
    });

    test('Do not navigate to /register for non-guest users', async ({
      page,
    }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL('/');

      await page.goto('/register');
      await expect(page).toHaveURL('/');
    });

    test('Do not navigate to /login for non-guest users', async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL('/');

      await page.goto('/login');
      await expect(page).toHaveURL('/');
    });
  });
