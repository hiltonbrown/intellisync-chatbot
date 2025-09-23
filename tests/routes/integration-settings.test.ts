import { expect, test } from '@playwright/test';

test.describe('integration settings page', () => {
  test('supports connect, sync, and disconnect flows with optimistic updates', async ({ page }) => {
    const baseIntegration = {
      provider: 'quickbooks',
      status: 'disconnected',
      connectedAt: null,
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hasCredentials: false,
    };

    let integrationState = { ...baseIntegration };

    const summary = {
      providers: [
        {
          definition: {
            id: 'quickbooks',
            name: 'QuickBooks Online',
            description: 'Sync invoices, revenue events, and chart of accounts.',
            category: 'accounting',
            connectionType: 'oauth',
            helpUrl: '#',
            docsUrl: '#',
            comingSoon: false,
          },
          integration: integrationState,
        },
        {
          definition: {
            id: 'xero',
            name: 'Xero',
            description: 'Import bank transactions and bills.',
            category: 'accounting',
            connectionType: 'oauth',
            helpUrl: '#',
            docsUrl: '#',
            comingSoon: false,
          },
          integration: {
            provider: 'xero',
            status: 'disconnected',
            connectedAt: null,
            lastSyncedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hasCredentials: false,
          },
        },
        {
          definition: {
            id: 'freshbooks',
            name: 'FreshBooks',
            description: 'Capture time tracking and invoicing activity.',
            category: 'finance',
            connectionType: 'oauth',
            helpUrl: '#',
            docsUrl: '#',
            comingSoon: true,
          },
          integration: {
            provider: 'freshbooks',
            status: 'disconnected',
            connectedAt: null,
            lastSyncedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hasCredentials: false,
          },
        },
      ],
      generatedAt: new Date().toISOString(),
    };

    await page.route('**/api/integrations', async (route) => {
      integrationState = { ...integrationState };
      await route.fulfill({ json: { ...summary, providers: [
        { ...summary.providers[0], integration: integrationState },
        summary.providers[1],
        summary.providers[2],
      ] } });
    });

    await page.route('**/api/integrations/quickbooks/handshake', async (route) => {
      integrationState = {
        ...integrationState,
        status: 'connecting',
        updatedAt: new Date().toISOString(),
        hasCredentials: true,
      };

      await route.fulfill({
        json: {
          handshake: {
            authorizationUrl: 'https://example.com/oauth',
            state: 'state-123',
            expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
          },
          integration: integrationState,
        },
      });
    });

    await page.route('**/api/integrations/quickbooks/sync', async (route) => {
      const syncedAt = new Date().toISOString();
      integrationState = {
        ...integrationState,
        status: 'connected',
        lastSyncedAt: syncedAt,
        connectedAt: integrationState.connectedAt ?? syncedAt,
        updatedAt: syncedAt,
      };

      await route.fulfill({
        json: {
          integration: integrationState,
          sync: {
            syncedAt,
            details: { batchesProcessed: 1 },
          },
        },
      });
    });

    await page.route('**/api/integrations/quickbooks/disconnect', async (route) => {
      integrationState = {
        ...integrationState,
        status: 'disconnected',
        connectedAt: null,
        updatedAt: new Date().toISOString(),
        hasCredentials: false,
      };

      await route.fulfill({
        json: {
          integration: integrationState,
        },
      });
    });

    await page.goto('/settings/integration-settings');

    const card = page.getByTestId('integration-card-quickbooks');
    await expect(card.getByTestId('integration-status-quickbooks')).toContainText('Disconnected');

    await page.getByTestId('integration-connect-quickbooks').click();
    await expect(card.getByTestId('integration-status-quickbooks')).toContainText('Connecting');
    await expect(page.getByRole('alertdialog')).toContainText('Finish connecting QuickBooks Online');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByTestId('integration-sync-quickbooks').click();
    await expect(card.getByTestId('integration-status-quickbooks')).toContainText('Connected');

    await page.getByTestId('integration-logs-quickbooks').click();
    await expect(page.getByRole('alertdialog')).toContainText('Activity log — QuickBooks Online');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByTestId('integration-disconnect-quickbooks').click();
    await expect(card.getByTestId('integration-status-quickbooks')).toContainText('Disconnected');

    await page.getByLabel('Filter integrations by status').click();
    await page.getByRole('option', { name: 'Connected', exact: true }).click();
    await expect(page.getByText('No integrations match your filters')).toBeVisible();
  });
});
