import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { FloatingModelSelector } from '@/components/floating-model-selector';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '@clerk/nextjs/server';
import type { ClerkSession } from '@/lib/types';

export default async function Page() {
  const { userId } = await auth();

  // Clerk middleware handles authentication, so userId should always be available
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  // Create a session-like object for compatibility with existing Chat component
  const session: ClerkSession = {
    userId,
    user: {
      id: userId,
      type: 'regular', // All Clerk users are regular users
    },
  };

  if (!modelIdFromCookie) {
    return (
      <>
        <FloatingModelSelector selectedModelId={DEFAULT_CHAT_MODEL} />
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <FloatingModelSelector selectedModelId={modelIdFromCookie.value} />
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={modelIdFromCookie.value}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}
