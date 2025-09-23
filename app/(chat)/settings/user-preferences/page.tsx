import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

import { PreferencesContent } from './_components/preferences-content';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/types';
import { getStaticModels } from '@/lib/ai/server-models';
import { getUserPreferences } from '@/lib/db/queries';
import {
  createDefaultPreferences,
  serializeUserPreferences,
} from '@/lib/types/preferences';

export default async function UserPreferencesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const currentModelId =
    cookieStore.get('chat-model')?.value ?? DEFAULT_CHAT_MODEL;

  const models = await getStaticModels();
  const storedPreferences = await getUserPreferences(userId);

  const initialPreferences = serializeUserPreferences(
    storedPreferences ?? createDefaultPreferences(),
  );

  return (
    <PreferencesContent
      initialPreferences={initialPreferences}
      initialModelId={currentModelId}
      models={models}
    />
  );
}
