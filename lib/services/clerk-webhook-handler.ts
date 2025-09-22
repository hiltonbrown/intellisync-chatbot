import 'server-only';

import type { WebhookEvent } from '@clerk/nextjs/server';

import {
  createUser,
  getUserById,
  updateUserOpenRouterKeyDetails,
} from '@/lib/db/queries';
import { getEntitlements, type UserType } from '@/lib/ai/entitlements';
import { OpenRouterKeyService } from '@/lib/services/openrouter-keys';

const LEGACY_EMAIL_DOMAIN = '@clerk.local';

const parseUserType = (value: unknown): UserType => {
  if (value === 'pro' || value === 'enterprise' || value === 'free') {
    return value;
  }
  return 'free';
};

async function ensureDatabaseUser({
  userId,
  email,
  userType,
  creditLimit,
}: {
  userId: string;
  email?: string | null;
  userType: UserType;
  creditLimit: number;
}) {
  const [existing] = await getUserById(userId);

  if (!existing) {
    const fallbackEmail = email ?? `${userId}${LEGACY_EMAIL_DOMAIN}`;
    await createUser(fallbackEmail, userId);
  }

  await updateUserOpenRouterKeyDetails({
    userId,
    userType,
    creditLimit,
  });
}

function createKeyService(): OpenRouterKeyService | null {
  try {
    return new OpenRouterKeyService();
  } catch (error) {
    console.warn('OpenRouter provisioning unavailable, skipping key management', error);
    return null;
  }
}

export async function handleClerkWebhook(event: WebhookEvent) {
  const keyService = createKeyService();
  const type = event.type;

  if (!type) {
    console.warn('Received Clerk webhook without a type. Ignoring.');
    return;
  }

  switch (type) {
    case 'user.created': {
      const user = event.data as any;
      const userId = user.id as string;
      const tier = parseUserType(user?.public_metadata?.subscriptionTier);
      const entitlements = getEntitlements(tier);

      try {
        await ensureDatabaseUser({
          userId,
          email: user?.email_addresses?.[0]?.email_address,
          userType: tier,
          creditLimit: entitlements.creditLimit,
        });

        if (keyService) {
          await keyService.ensureUserApiKey({
            userId,
            userType: tier,
            creditLimit: entitlements.creditLimit,
          });
        }
      } catch (error) {
        console.error('Failed to provision OpenRouter resources for new user', {
          userId,
          error,
        });
      }

      break;
    }

    case 'user.deleted': {
      const user = event.data as any;
      const userId = user.id as string;

      if (!userId) {
        console.warn('Clerk webhook user.deleted missing user id.');
        return;
      }

      try {
        if (keyService) {
          await keyService.deleteUserApiKey({ userId });
        }
      } catch (error) {
        console.error('Failed to clean up OpenRouter key for deleted user', {
          userId,
          error,
        });
      }

      break;
    }

    case 'user.updated': {
      const user = event.data as any;
      const userId = user.id as string;
      if (!userId) {
        console.warn('Clerk webhook user.updated missing user id.');
        return;
      }

      const tier = parseUserType(user?.public_metadata?.subscriptionTier);
      const entitlements = getEntitlements(tier);
      const requestedLimitRaw = user?.public_metadata?.creditLimit;
      const requestedLimit =
        typeof requestedLimitRaw === 'number' && requestedLimitRaw >= 0
          ? requestedLimitRaw
          : entitlements.creditLimit;
      const rotateRequested = Boolean(user?.public_metadata?.rotateKeyOnTierChange);

      try {
        await ensureDatabaseUser({
          userId,
          email: user?.email_addresses?.[0]?.email_address,
          userType: tier,
          creditLimit: requestedLimit,
        });

        if (!keyService) {
          return;
        }

        const keyDetails = await keyService.ensureUserApiKey({
          userId,
          userType: tier,
          creditLimit: requestedLimit,
        });

        if (requestedLimit !== keyDetails.limit) {
          await keyService.updateCreditLimit({
            userId,
            newLimit: requestedLimit,
          });
        }

        if (rotateRequested) {
          await keyService.rotateUserApiKey({
            userId,
            userType: tier,
            creditLimit: requestedLimit,
          });
        }
      } catch (error) {
        console.error('Failed to process Clerk user.updated webhook', {
          userId,
          error,
        });
      }

      break;
    }

    default: {
      console.log('Ignoring unsupported Clerk webhook event type', type);
    }
  }
}
