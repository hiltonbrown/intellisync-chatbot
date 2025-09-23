import { auth } from '@clerk/nextjs/server';

import { getUserPreferences, saveUserPreferences } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import {
  createDefaultPreferences,
  deserializeUserPreferences,
  isSerializedUserPreferences,
  serializeUserPreferences,
  type SerializedUserPreferences,
} from '@/lib/types/preferences';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const storedPreferences = await getUserPreferences(userId);
    const preferences = storedPreferences ?? createDefaultPreferences();

    return Response.json(serializeUserPreferences(preferences));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Unable to load user preferences.',
    ).toResponse();
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let payload: unknown;

  try {
    payload = (await request.json()) as SerializedUserPreferences;
  } catch (error) {
    return new ChatSDKError('bad_request:api', 'Invalid request payload.').toResponse();
  }

  if (!isSerializedUserPreferences(payload)) {
    return new ChatSDKError('bad_request:api', 'Invalid preferences payload.').toResponse();
  }

  const preferences = deserializeUserPreferences(payload);

  try {
    const savedPreferences = await saveUserPreferences({
      userId,
      preferences,
    });

    return Response.json(serializeUserPreferences(savedPreferences));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Unable to save user preferences.',
    ).toResponse();
  }
}
