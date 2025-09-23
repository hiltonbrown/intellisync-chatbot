import { auth } from '@clerk/nextjs/server';
import {
  getChatById,
  getMessagesByChatId,
  getStreamIdsByChatId,
} from '@/lib/db/queries';
import type { Chat } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import { createUIMessageStream, JsonToSseTransformStream } from 'ai';
import { getStreamContext } from '@/lib/ai/stream-context';
import { differenceInSeconds } from 'date-fns';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  console.log('Stream API: Received GET request');
  const { id: chatId } = await params;
  console.log('Stream API: Chat ID:', chatId);

  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    console.log('Stream API: No stream context available');
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    console.log('Stream API: No chatId provided');
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const { userId } = await auth();
  console.log('Stream API: Auth result - userId:', userId);

  if (!userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const finalUserId = userId;

  let chat: Chat | null;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== finalUserId) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  let streamIds: Array<string> = [];

  try {
    streamIds = await getStreamIdsByChatId({ chatId });
  } catch (error) {
    console.warn(
      'Stream API: Unable to load stream ids for chat; returning empty response',
      {
        chatId,
        error,
      },
    );

    return new Response(null, { status: 204 });
  }

  if (!streamIds.length) {
    return new Response(null, { status: 204 });
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createUIMessageStream<ChatMessage>({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(recentStreamId, () =>
    emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
  );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({
          type: 'data-appendMessage',
          data: JSON.stringify(mostRecentMessage),
          transient: true,
        });
      },
    });

    return new Response(
      restoredStream.pipeThrough(new JsonToSseTransformStream()),
      { status: 200 },
    );
  }

  return new Response(stream, { status: 200 });
}
