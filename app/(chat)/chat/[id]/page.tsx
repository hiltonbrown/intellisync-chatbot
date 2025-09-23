import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth, currentUser } from '@clerk/nextjs/server';
import { Chat } from '@/components/chat';
import { FloatingThemeToggle } from '@/components/floating-theme-toggle';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { convertToUIMessages } from '@/lib/utils';
import type { ClerkSession } from '@/lib/types';
import { ChatSDKError } from '@/lib/errors';

type ChatResult = Awaited<ReturnType<typeof getChatById>>;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  let databaseAvailable = true;
  let chat: ChatResult = null;

  try {
    chat = await getChatById({ id });
  } catch (error) {
    if (error instanceof ChatSDKError && error.surface === 'database') {
      databaseAvailable = false;
      chat = null;
    } else {
      throw error;
    }
  }

  if (databaseAvailable && !chat) {
    notFound();
  }

  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  const user = await currentUser();

  // Create a session-like object for compatibility with existing Chat component
  const session: ClerkSession = {
    userId,
    user: {
      id: userId,
      type: 'free',
    },
  };

  if (chat && chat.visibility === 'private') {
    if (!user) {
      return notFound();
    }

    if (user.id !== chat.userId) {
      return notFound();
    }
  }

  let uiMessages: ReturnType<typeof convertToUIMessages> = [];

  if (chat && databaseAvailable) {
    const messagesFromDb = await getMessagesByChatId({
      id,
    });

    uiMessages = convertToUIMessages(messagesFromDb);
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');

  if (!chatModelFromCookie) {
    return (
      <>
        <FloatingThemeToggle />
        <Chat
          id={chat?.id ?? id}
          initialMessages={uiMessages}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType={chat?.visibility ?? 'private'}
          isReadonly={chat ? user?.id !== chat.userId : false}
          session={session}
          autoResume={true}
          initialLastContext={chat?.lastContext ?? undefined}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <FloatingThemeToggle />
      <Chat
        id={chat?.id ?? id}
        initialMessages={uiMessages}
        initialChatModel={chatModelFromCookie.value}
        initialVisibilityType={chat?.visibility ?? 'private'}
        isReadonly={chat ? user?.id !== chat.userId : false}
        session={session}
        autoResume={true}
        initialLastContext={chat?.lastContext ?? undefined}
      />
      <DataStreamHandler />
    </>
  );
}
