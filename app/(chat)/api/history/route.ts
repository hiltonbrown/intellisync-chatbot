import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { ChatSDKError } from '@/lib/errors';

type HistoryQueryInput = {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
};

async function loadUserChats(input: HistoryQueryInput) {
  if (!process.env.POSTGRES_URL) {
    return [] as const;
  }

  const { getChatsByUserId } = await import('@/lib/db/queries');

  return getChatsByUserId(input);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      'bad_request:api',
      'Only one of starting_after or ending_before can be provided.',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chats = await loadUserChats({
    id: session.userId,
    limit,
    startingAfter,
    endingBefore,
  });

  return Response.json(chats);
}
