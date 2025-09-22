import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Chat } from '@/components/chat';
import { FloatingThemeToggle } from '@/components/floating-theme-toggle';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '@clerk/nextjs/server';
import type { ClerkSession } from '@/lib/types';

export default async function Page() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }
  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  // Create a session-like object for compatibility with existing Chat component
  const session: ClerkSession = {
    userId,
    user: {
      id: userId,
      type: 'free',
    },
  };

  if (!modelIdFromCookie) {
    return (
      <>
        <FloatingThemeToggle />
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
      <FloatingThemeToggle />
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
