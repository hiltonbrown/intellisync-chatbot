import type { IntegrationStatus } from '@/lib/types';
import type { IntegrationProvider, IntegrationProviderDefinition } from './providers';

export interface SerializedIntegrationState {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  hasCredentials: boolean;
}

export interface IntegrationSummaryItem {
  definition: IntegrationProviderDefinition;
  integration: SerializedIntegrationState;
}

export interface HandshakePayload {
  handshake: {
    authorizationUrl: string;
    state: string;
    expiresAt: string;
    suggestedRedirect?: string;
  };
  integration: SerializedIntegrationState;
}

export interface SyncPayload {
  integration: SerializedIntegrationState;
  sync: {
    syncedAt: string;
    details?: Record<string, unknown>;
  };
}
