import { expect, test } from '@playwright/test';

test.describe('integration api', () => {
  test('supports handshake, sync, and disconnect flow', async ({ request }) => {
    const provider = 'quickbooks';
    const headers = { 'x-test-user': `test-user-${Date.now()}` };

    const summaryResponse = await request.get('/api/integrations', { headers });
    expect(summaryResponse.ok()).toBeTruthy();
    const summary = await summaryResponse.json();

    expect(Array.isArray(summary.providers)).toBeTruthy();
    expect(summary.providers.length).toBeGreaterThanOrEqual(3);

    const handshakeResponse = await request.post(
      `/api/integrations/${provider}/handshake`,
      { headers },
    );
    expect(handshakeResponse.ok()).toBeTruthy();
    const handshake = await handshakeResponse.json();

    expect(handshake.integration.status).toBe('connecting');
    expect(handshake.handshake.authorizationUrl).toContain(provider);

    const statusResponse = await request.get(`/api/integrations/${provider}`, {
      headers,
    });
    expect(statusResponse.ok()).toBeTruthy();
    const status = await statusResponse.json();
    expect(status.integration.status).toBe('connecting');

    const syncResponse = await request.post(`/api/integrations/${provider}/sync`, {
      headers,
    });
    expect(syncResponse.ok()).toBeTruthy();
    const sync = await syncResponse.json();

    expect(sync.integration.status).toBe('connected');
    expect(sync.integration.lastSyncedAt).not.toBeNull();

    const disconnectResponse = await request.post(
      `/api/integrations/${provider}/disconnect`,
      { headers },
    );
    expect(disconnectResponse.ok()).toBeTruthy();
    const disconnect = await disconnectResponse.json();

    expect(disconnect.integration.status).toBe('disconnected');
  });
});
