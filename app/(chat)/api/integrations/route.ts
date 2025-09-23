import type { NextRequest } from 'next/server';

import { ChatSDKError } from '@/lib/errors';
import { getIntegrationSummaryForUser } from '@/lib/services/integrations/service';

import { requireUserId } from './utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    const providers = await getIntegrationSummaryForUser(userId);

    return Response.json({
      providers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Failed to list integrations', error);
    return new ChatSDKError(
      'internal:integration',
      'Unable to load integrations',
    ).toResponse();
  }
}
