import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import {
  getUserById,
  incrementUserOpenRouterUsage,
  recordOpenRouterKeyAudit,
  updateUserOpenRouterKeyDetails,
} from '@/lib/db/queries';
import type { User } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';

const OPENROUTER_API_BASE =
  process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

const KEY_STATUSES = new Set(['active', 'disabled', 'revoked', 'pending']);

interface ProvisionKeyInput {
  userId: string;
  userType: User['userType'];
  creditLimit: number;
  force?: boolean;
}

interface RotateKeyInput {
  userId: string;
  userType: User['userType'];
  creditLimit: number;
}

interface UpdateLimitInput {
  userId: string;
  newLimit: number;
}

interface DisableKeyInput {
  userId: string;
}

interface DeleteKeyInput {
  userId: string;
  scrubMetadata?: boolean;
}

interface OpenRouterKeyResponse {
  key: string;
  hash?: string;
  id?: string;
  limit?: number;
  status?: string;
  created_at?: string;
  label?: string;
}

interface StoredKeyDetails {
  apiKey: string;
  hash: string;
  reference: string;
  limit: number;
  status: User['keyStatus'];
}

interface UsageRecord {
  userId: string;
  cost: number;
  chatId: string;
  modelId: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

const KEY_ENCRYPTION_SECRET = process.env.OPENROUTER_KEY_ENCRYPTION_SECRET;

function ensureEncryptionSecret(): Buffer {
  if (!KEY_ENCRYPTION_SECRET) {
    throw new ChatSDKError(
      'bad_request:api',
      'OPENROUTER_KEY_ENCRYPTION_SECRET is not configured.',
    );
  }

  const secretBuffer = Buffer.from(KEY_ENCRYPTION_SECRET, 'utf8');
  return createHash('sha256').update(secretBuffer).digest();
}

function encryptApiKey(plainKey: string): string {
  const key = ensureEncryptionSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key.subarray(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(plainKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptApiKey(encryptedKey: string): string {
  const key = ensureEncryptionSecret();
  const buffer = Buffer.from(encryptedKey, 'base64');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key.subarray(0, 32), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

function hashApiKey(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex');
}

function normaliseStatus(status?: string): User['keyStatus'] {
  if (!status) return 'active';
  const lower = status.toLowerCase();
  if (KEY_STATUSES.has(lower)) {
    return lower as User['keyStatus'];
  }
  return 'active';
}

async function updateClerkMetadata(userId: string, metadata: Record<string, unknown>) {
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: metadata,
    });
  } catch (error) {
    console.warn('Unable to update Clerk metadata for user', userId, error);
  }
}

export class OpenRouterKeyService {
  private readonly provisioningKey: string;

  constructor() {
    if (!process.env.OPENROUTER_PROVISIONING_KEY) {
      throw new ChatSDKError(
        'bad_request:api',
        'OPENROUTER_PROVISIONING_KEY is not configured.',
      );
    }

    this.provisioningKey = process.env.OPENROUTER_PROVISIONING_KEY;
  }

  async ensureUserApiKey({
    userId,
    userType,
    creditLimit,
    force = false,
  }: ProvisionKeyInput): Promise<StoredKeyDetails> {
    const [userRecord] = await getUserById(userId);

    if (userRecord && !force && userRecord.openrouterKeyHash && userRecord.encryptedApiKey) {
      return {
        apiKey: decryptApiKey(userRecord.encryptedApiKey),
        hash: userRecord.openrouterKeyHash,
        reference: userRecord.openrouterKeyReference ?? userRecord.openrouterKeyHash,
        limit: userRecord.creditLimit ?? creditLimit,
        status: userRecord.keyStatus ?? 'active',
      };
    }

    const keyResponse = await this.createRemoteKey({
      userId,
      userType,
      creditLimit,
    });

    const stored = await this.persistKey({
      userId,
      userType,
      creditLimit,
      response: keyResponse,
      auditAction: force ? 'rotated' : 'created',
    });

    if (force && userRecord?.openrouterKeyReference) {
      await this.disableRemoteKey(userRecord.openrouterKeyReference);
    }

    return stored;
  }

  async rotateUserApiKey(input: RotateKeyInput): Promise<StoredKeyDetails> {
    return await this.ensureUserApiKey({ ...input, force: true });
  }

  async updateCreditLimit({ userId, newLimit }: UpdateLimitInput): Promise<void> {
    const [userRecord] = await getUserById(userId);

    if (!userRecord?.openrouterKeyReference) {
      throw new ChatSDKError(
        'not_found:api',
        'Unable to locate OpenRouter key reference for user.',
      );
    }

    await this.patchRemoteKey(userRecord.openrouterKeyReference, {
      limit: newLimit,
    });

    await updateUserOpenRouterKeyDetails({
      userId,
      creditLimit: newLimit,
    });

    await recordOpenRouterKeyAudit({
      userId,
      action: 'limit_updated',
      keyHash: userRecord.openrouterKeyHash,
      metadata: { limit: newLimit },
    });

    await updateClerkMetadata(userId, {
      creditLimit: newLimit,
    });
  }

  async disableUserApiKey({ userId }: DisableKeyInput): Promise<void> {
    const [userRecord] = await getUserById(userId);

    if (!userRecord?.openrouterKeyReference) {
      return;
    }

    await this.patchRemoteKey(userRecord.openrouterKeyReference, {
      status: 'disabled',
    });

    await updateUserOpenRouterKeyDetails({
      userId,
      keyStatus: 'disabled',
    });

    await recordOpenRouterKeyAudit({
      userId,
      action: 'disabled',
      keyHash: userRecord.openrouterKeyHash,
    });

    await updateClerkMetadata(userId, {
      keyStatus: 'disabled',
    });
  }

  async deleteUserApiKey({
    userId,
    scrubMetadata = true,
  }: DeleteKeyInput): Promise<void> {
    const [userRecord] = await getUserById(userId);

    if (userRecord?.openrouterKeyReference) {
      await this.deleteRemoteKey(userRecord.openrouterKeyReference);
    }

    await updateUserOpenRouterKeyDetails({
      userId,
      keyHash: null,
      keyReference: null,
      encryptedApiKey: null,
      keyStatus: 'revoked',
      currentUsage: 0,
      creditLimit: 0,
    });

    await recordOpenRouterKeyAudit({
      userId,
      action: 'deleted',
      keyHash: userRecord?.openrouterKeyHash,
    });

    if (scrubMetadata) {
      await updateClerkMetadata(userId, {
        openrouterKeyHash: null,
        creditLimit: 0,
        currentUsage: 0,
        keyStatus: 'revoked',
      });
    }
  }

  async getDecryptedApiKey(userId: string): Promise<string | null> {
    const [userRecord] = await getUserById(userId);
    if (!userRecord?.encryptedApiKey) {
      return null;
    }
    return decryptApiKey(userRecord.encryptedApiKey);
  }

  async recordUsage({
    userId,
    cost,
    chatId,
    modelId,
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    reasoningTokens,
  }: UsageRecord): Promise<number> {
    const newUsageTotal = await incrementUserOpenRouterUsage({
      userId,
      delta: cost,
    });

    await recordOpenRouterKeyAudit({
      userId,
      action: 'usage_logged',
      keyHash: undefined,
      metadata: {
        chatId,
        modelId,
        cost,
        usdCost: cost / 100,
        promptTokens,
        completionTokens,
        totalTokens,
        cachedTokens,
        reasoningTokens,
      },
    });

    await updateClerkMetadata(userId, {
      currentUsage: newUsageTotal,
      lastUsageAt: new Date().toISOString(),
      lastUsageCost: cost,
      lastUsageCostUSD: cost / 100,
    });

    return newUsageTotal;
  }

  private async createRemoteKey({
    userId,
    userType,
    creditLimit,
  }: Omit<ProvisionKeyInput, 'force'>): Promise<OpenRouterKeyResponse> {
    const response = await fetch(`${OPENROUTER_API_BASE}/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.provisioningKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `IntelliSync user ${userId}`,
        label: `intellisync-${userType}-${userId}`.slice(0, 64),
        limit: creditLimit,
      }),
    });

    if (!response.ok) {
      const message = await this.safeReadError(response);
      throw new ChatSDKError(
        'bad_request:api',
        `Failed to provision OpenRouter key: ${message}`,
      );
    }

    return (await response.json()) as OpenRouterKeyResponse;
  }

  private async persistKey({
    userId,
    userType,
    creditLimit,
    response,
    auditAction,
  }: {
    userId: string;
    userType: User['userType'];
    creditLimit: number;
    response: OpenRouterKeyResponse;
    auditAction: 'created' | 'rotated';
  }): Promise<StoredKeyDetails> {
    if (!response.key) {
      throw new ChatSDKError(
        'bad_request:api',
        'Provisioning API response did not include an API key.',
      );
    }

    const encryptedApiKey = encryptApiKey(response.key);
    const hash = response.hash ?? hashApiKey(response.key);
    const reference = response.id ?? hash;
    const limit = response.limit ?? creditLimit;
    const keyStatus = normaliseStatus(response.status);
    const createdAt = response.created_at
      ? new Date(response.created_at)
      : new Date();

    await updateUserOpenRouterKeyDetails({
      userId,
      keyHash: hash,
      keyReference: reference,
      encryptedApiKey,
      keyStatus,
      keyCreatedAt: createdAt,
      keyLastRotated: new Date(),
      creditLimit: limit,
      currentUsage: 0,
      userType,
    });

    await recordOpenRouterKeyAudit({
      userId,
      action: auditAction,
      keyHash: hash,
      metadata: {
        limit,
        status: keyStatus,
      },
    });

    await updateClerkMetadata(userId, {
      openrouterKeyHash: hash,
      creditLimit: limit,
      currentUsage: 0,
      keyStatus,
    });

    return {
      apiKey: response.key,
      hash,
      reference,
      limit,
      status: keyStatus,
    };
  }

  private async patchRemoteKey(
    reference: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(`${OPENROUTER_API_BASE}/keys/${reference}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.provisioningKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await this.safeReadError(response);
      throw new ChatSDKError(
        'bad_request:api',
        `Failed to update OpenRouter key: ${message}`,
      );
    }
  }

  private async disableRemoteKey(reference: string): Promise<void> {
    await this.patchRemoteKey(reference, { status: 'disabled' });
  }

  private async deleteRemoteKey(reference: string): Promise<void> {
    const response = await fetch(`${OPENROUTER_API_BASE}/keys/${reference}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.provisioningKey}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const message = await this.safeReadError(response);
      throw new ChatSDKError(
        'bad_request:api',
        `Failed to delete OpenRouter key: ${message}`,
      );
    }
  }

  private async safeReadError(response: Response): Promise<string> {
    try {
      const data = await response.json();
      return data?.error ?? data?.message ?? response.statusText;
    } catch (error) {
      return response.statusText;
    }
  }
}
