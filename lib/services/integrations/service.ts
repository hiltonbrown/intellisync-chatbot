import type { AccountingIntegration } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import type { IntegrationStatus, IntegrationTokens } from '@/lib/types';
import {
  getIntegrationProvider,
  integrationProviders,
  type IntegrationProvider,
} from './providers';
import { getIntegrationClient } from './clients';
import type { HandshakeResponse, SyncResponse } from './clients';
import type {
  HandshakePayload,
  IntegrationSummaryItem,
  SerializedIntegrationState,
  SyncPayload,
} from './types';

type IntegrationMutationInput = {
  userId: string;
  provider: IntegrationProvider;
  status?: IntegrationStatus;
  connectedAt?: Date | null;
  lastSyncedAt?: Date | null;
  tokens?: IntegrationTokens;
};

interface IntegrationRepository {
  list(userId: string): Promise<Array<AccountingIntegration>>;
  get(
    userId: string,
    provider: IntegrationProvider,
  ): Promise<AccountingIntegration | null>;
  upsert(input: IntegrationMutationInput): Promise<AccountingIntegration>;
  update(input: IntegrationMutationInput): Promise<AccountingIntegration>;
  delete(userId: string, provider: IntegrationProvider): Promise<void>;
}

const globalForIntegrations = globalThis as unknown as {
  __integrationRepository?: IntegrationRepository;
};

function shouldUseInMemoryRepository() {
  if (process.env.USE_INTEGRATION_MEMORY_STORE === '1') {
    return true;
  }

  if (!process.env.POSTGRES_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('POSTGRES_URL environment variable is not set');
    }

    return true;
  }

  return false;
}

async function createDatabaseRepository(): Promise<IntegrationRepository> {
  const queries = await import('@/lib/db/queries');

  return {
    list: (userId) => queries.listAccountingIntegrations(userId),
    get: (userId, provider) =>
      queries.getAccountingIntegrationByProvider({ userId, provider }),
    upsert: (input) => queries.upsertAccountingIntegration(input),
    update: (input) => queries.updateAccountingIntegration(input),
    delete: async (userId, provider) => {
      await queries.deleteAccountingIntegration({ userId, provider });
    },
  } satisfies IntegrationRepository;
}

function createMemoryRepository(): IntegrationRepository {
  type StoreKey = `${string}:${IntegrationProvider}`;

  const store = new Map<StoreKey, AccountingIntegration>();

  const toKey = (userId: string, provider: IntegrationProvider): StoreKey =>
    `${userId}:${provider}`;

  const cloneIntegration = (
    integration: AccountingIntegration,
  ): AccountingIntegration => ({
    ...integration,
    connectedAt: integration.connectedAt ? new Date(integration.connectedAt) : null,
    lastSyncedAt: integration.lastSyncedAt
      ? new Date(integration.lastSyncedAt)
      : null,
    createdAt: integration.createdAt ? new Date(integration.createdAt) : new Date(),
    updatedAt: integration.updatedAt ? new Date(integration.updatedAt) : new Date(),
  });

  return {
    async list(userId) {
      return Array.from(store.values())
        .filter((integration) => integration.userId === userId)
        .map(cloneIntegration);
    },
    async get(userId, provider) {
      const integration = store.get(toKey(userId, provider));
      return integration ? cloneIntegration(integration) : null;
    },
    async upsert({
      userId,
      provider,
      status,
      connectedAt,
      lastSyncedAt,
      tokens,
    }) {
      const key = toKey(userId, provider);
      const now = new Date();
      const existing = store.get(key);

      if (existing) {
        const updated: AccountingIntegration = {
          ...existing,
          status: status ?? existing.status,
          connectedAt:
            connectedAt !== undefined ? connectedAt : existing.connectedAt,
          lastSyncedAt:
            lastSyncedAt !== undefined ? lastSyncedAt : existing.lastSyncedAt,
          tokens: tokens !== undefined ? tokens ?? null : existing.tokens,
          updatedAt: now,
        };

        store.set(key, updated);
        return cloneIntegration(updated);
      }

      const created: AccountingIntegration = {
        userId,
        provider,
        status: status ?? 'disconnected',
        connectedAt: connectedAt ?? null,
        lastSyncedAt: lastSyncedAt ?? null,
        tokens: tokens ?? null,
        createdAt: now,
        updatedAt: now,
      };

      store.set(key, created);
      return cloneIntegration(created);
    },
    async update({
      userId,
      provider,
      status,
      connectedAt,
      lastSyncedAt,
      tokens,
    }) {
      const key = toKey(userId, provider);
      const existing = store.get(key);

      if (!existing) {
        throw new ChatSDKError(
          'not_found:database',
          `Integration ${provider} not found for update`,
        );
      }

      const now = new Date();
      const updated: AccountingIntegration = {
        ...existing,
        updatedAt: now,
      };

      if (status !== undefined) {
        updated.status = status;
      }

      if (connectedAt !== undefined) {
        updated.connectedAt = connectedAt;
      }

      if (lastSyncedAt !== undefined) {
        updated.lastSyncedAt = lastSyncedAt;
      }

      if (tokens !== undefined) {
        updated.tokens = tokens ?? null;
      }

      store.set(key, updated);
      return cloneIntegration(updated);
    },
    async delete(userId, provider) {
      const key = toKey(userId, provider);

      if (!store.has(key)) {
        throw new ChatSDKError(
          'not_found:database',
          `Integration ${provider} not found for deletion`,
        );
      }

      store.delete(key);
    },
  } satisfies IntegrationRepository;
}

async function getIntegrationRepository(): Promise<IntegrationRepository> {
  if (globalForIntegrations.__integrationRepository) {
    return globalForIntegrations.__integrationRepository;
  }

  const useInMemory = shouldUseInMemoryRepository();
  const repository = useInMemory
    ? createMemoryRepository()
    : await createDatabaseRepository();

  if (useInMemory && process.env.NODE_ENV !== 'production') {
    console.warn(
      'Accounting integrations are using the in-memory store. Configure POSTGRES_URL to persist data.',
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    globalForIntegrations.__integrationRepository = repository;
  }

  return repository;
}

function serializeIntegration(
  provider: IntegrationProvider,
  integration: AccountingIntegration | null,
): SerializedIntegrationState {
  const tokens = integration?.tokens;
  const hasCredentials =
    tokens !== null &&
    tokens !== undefined &&
    typeof tokens === 'object' &&
    Object.keys(tokens as Record<string, unknown>).length > 0;

  return {
    provider,
    status: integration?.status ?? 'disconnected',
    connectedAt: integration?.connectedAt?.toISOString() ?? null,
    lastSyncedAt: integration?.lastSyncedAt?.toISOString() ?? null,
    createdAt: integration?.createdAt?.toISOString() ?? null,
    updatedAt: integration?.updatedAt?.toISOString() ?? null,
    hasCredentials,
  };
}

async function ensureIntegration(
  userId: string,
  provider: IntegrationProvider,
  repository?: IntegrationRepository,
): Promise<AccountingIntegration> {
  const targetRepository = repository ?? (await getIntegrationRepository());
  const existing = await targetRepository.get(userId, provider);

  if (existing) {
    return existing;
  }

  return targetRepository.upsert({ userId, provider, status: 'disconnected' });
}

export async function getIntegrationSummaryForUser(
  userId: string,
): Promise<Array<IntegrationSummaryItem>> {
  const repository = await getIntegrationRepository();
  const integrations = await repository.list(userId);
  const integrationByProvider = new Map(
    integrations.map((integration) => [integration.provider, integration]),
  );

  return integrationProviders.map((definition) => ({
    definition,
    integration: serializeIntegration(
      definition.id,
      integrationByProvider.get(definition.id) ?? null,
    ),
  }));
}

export async function getIntegrationState(
  userId: string,
  provider: IntegrationProvider,
): Promise<SerializedIntegrationState> {
  const definition = getIntegrationProvider(provider);

  if (!definition) {
    throw new ChatSDKError('not_found:integration', `Unknown provider ${provider}`);
  }

  if (definition.comingSoon) {
    return serializeIntegration(provider, null);
  }

  const repository = await getIntegrationRepository();
  const integration = await repository.get(userId, provider);

  return serializeIntegration(provider, integration);
}

export async function startIntegrationHandshake(
  userId: string,
  provider: IntegrationProvider,
): Promise<HandshakePayload> {
  const definition = getIntegrationProvider(provider);

  if (!definition) {
    throw new ChatSDKError('not_found:integration', `Unknown provider ${provider}`);
  }

  if (definition.comingSoon) {
    throw new ChatSDKError(
      'bad_request:integration',
      `${definition.name} is not available yet.`,
    );
  }

  const client = getIntegrationClient(provider);
  const repository = await getIntegrationRepository();
  const handshake: HandshakeResponse = await client.startHandshake(userId);

  await ensureIntegration(userId, provider, repository);

  const integration = await repository.upsert({
    userId,
    provider,
    status: 'connecting',
    tokens: {
      state: handshake.state,
      expiresAt: handshake.expiresAt.toISOString(),
    },
  });

  return {
    handshake: {
      authorizationUrl: handshake.authorizationUrl,
      state: handshake.state,
      expiresAt: handshake.expiresAt.toISOString(),
      suggestedRedirect: handshake.suggestedRedirect,
    },
    integration: serializeIntegration(provider, integration),
  };
}

export async function disconnectIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<SerializedIntegrationState> {
  const definition = getIntegrationProvider(provider);

  if (!definition) {
    throw new ChatSDKError('not_found:integration', `Unknown provider ${provider}`);
  }

  const client = getIntegrationClient(provider);
  const repository = await getIntegrationRepository();
  const existing = await repository.get(userId, provider);

  if (!existing) {
    const fresh = await repository.upsert({
      userId,
      provider,
      status: 'disconnected',
      tokens: null,
      connectedAt: null,
    });

    return serializeIntegration(provider, fresh);
  }

  await client.disconnect(userId);

  const updated = await repository.update({
    userId,
    provider,
    status: 'disconnected',
    connectedAt: null,
    tokens: null,
  });

  return serializeIntegration(provider, updated);
}

export async function triggerIntegrationSync(
  userId: string,
  provider: IntegrationProvider,
): Promise<SyncPayload> {
  const definition = getIntegrationProvider(provider);

  if (!definition) {
    throw new ChatSDKError('not_found:integration', `Unknown provider ${provider}`);
  }

  if (definition.comingSoon) {
    throw new ChatSDKError(
      'bad_request:integration',
      `${definition.name} does not support syncing yet.`,
    );
  }

  const client = getIntegrationClient(provider);
  const repository = await getIntegrationRepository();
  const integration = await ensureIntegration(userId, provider, repository);

  if (integration.status === 'disconnected') {
    throw new ChatSDKError(
      'bad_request:integration',
      'Connect the provider before triggering a sync.',
    );
  }

  await repository.update({
    userId,
    provider,
    status: 'syncing',
  });

  const sync: SyncResponse = await client.triggerSync(userId);

  const updated = await repository.update({
    userId,
    provider,
    status: 'connected',
    lastSyncedAt: sync.syncedAt,
    connectedAt: integration.connectedAt ?? sync.syncedAt,
  });

  return {
    integration: serializeIntegration(provider, updated),
    sync: {
      syncedAt: sync.syncedAt.toISOString(),
      details: sync.details,
    },
  };
}

export async function deleteIntegration(
  userId: string,
  provider: IntegrationProvider,
) {
  const repository = await getIntegrationRepository();
  await repository.delete(userId, provider);
}
