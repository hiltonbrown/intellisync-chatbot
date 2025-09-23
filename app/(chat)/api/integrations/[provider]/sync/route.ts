import type { NextRequest } from 'next/server';

import { ChatSDKError } from '@/lib/errors';
import { triggerIntegrationSync } from '@/lib/services/integrations/service';
import { isIntegrationProvider } from '@/lib/services/integrations/providers';

import { requireUserId } from '../../utils';

export async function POST(
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

    const userId = await requireUserId(request);
    const payload = await triggerIntegrationSync(userId, provider);

    return Response.json(payload);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Failed to trigger integration sync', error);
    return new ChatSDKError(
      'internal:integration',
      'Unable to trigger sync',
    ).toResponse();
  }
}
