import { generateUUID } from '@/lib/utils';
import type { IntegrationProvider } from './providers';

export interface HandshakeResponse {
  authorizationUrl: string;
  state: string;
  expiresAt: Date;
  suggestedRedirect?: string;
}

export interface SyncResponse {
  syncedAt: Date;
  details?: Record<string, unknown>;
}

export interface IntegrationClient {
  startHandshake(userId: string): Promise<HandshakeResponse>;
  disconnect(userId: string): Promise<void>;
  triggerSync(userId: string): Promise<SyncResponse>;
}

const STUB_OAUTH_BASE: Record<IntegrationProvider, string> = {
  quickbooks: 'https://integrations.intellisync.dev/quickbooks/oauth',
  xero: 'https://integrations.intellisync.dev/xero/oauth',
  freshbooks: 'https://integrations.intellisync.dev/freshbooks/oauth',
};

const clients: Record<IntegrationProvider, IntegrationClient> = {
  quickbooks: createStubClient('quickbooks'),
  xero: createStubClient('xero'),
  freshbooks: createStubClient('freshbooks'),
};

function createStubClient(provider: IntegrationProvider): IntegrationClient {
  return {
    async startHandshake(userId: string) {
      const state = generateUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 10);

      return {
        authorizationUrl: `${STUB_OAUTH_BASE[provider]}?state=${state}&user=${encodeURIComponent(userId)}`,
        state,
        expiresAt,
        suggestedRedirect: `https://dashboard.intellisync.dev/integrations/${provider}/callback`,
      } satisfies HandshakeResponse;
    },
    async disconnect() {
      // Simulate short processing delay
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    },
    async triggerSync() {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      return {
        syncedAt: new Date(),
        details: {
          batchesProcessed: Math.floor(Math.random() * 4) + 1,
        },
      } satisfies SyncResponse;
    },
  };
}

export function getIntegrationClient(provider: IntegrationProvider): IntegrationClient {
  return clients[provider];
}
