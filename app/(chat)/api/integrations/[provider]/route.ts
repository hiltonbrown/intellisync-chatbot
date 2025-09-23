import type { NextRequest } from 'next/server';

import { ChatSDKError } from '@/lib/errors';
import { getIntegrationState } from '@/lib/services/integrations/service';
import {
  getIntegrationProvider,
  isIntegrationProvider,
} from '@/lib/services/integrations/providers';

import { requireUserId } from '../utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;

    if (!isIntegrationProvider(provider)) {
      return new ChatSDKError(
        'not_found:integration',
        `Unknown provider ${provider}`,
      ).toResponse();
    }

    const definition = getIntegrationProvider(provider);

    if (!definition) {
      return new ChatSDKError(
        'not_found:integration',
        `Unknown provider ${provider}`,
      ).toResponse();
    }

    const userId = await requireUserId(request);
    const integration = await getIntegrationState(userId, provider);

    return Response.json({ definition, integration });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Failed to get integration state', error);
    return new ChatSDKError(
      'internal:integration',
      'Unable to fetch integration status',
    ).toResponse();
  }
}
