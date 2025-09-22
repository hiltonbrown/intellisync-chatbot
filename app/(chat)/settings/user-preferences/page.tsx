import { cookies } from 'next/headers';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DefaultModelSelector } from '@/components/settings/default-model-selector';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/types';
import { getStaticModels } from '@/lib/ai/server-models';

export default async function UserPreferencesPage() {
  const cookieStore = await cookies();
  const currentModelId =
    cookieStore.get('chat-model')?.value ?? DEFAULT_CHAT_MODEL;

  const models = await getStaticModels();

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>User Preferences</CardTitle>
          <CardDescription>
            Personalize your workspace defaults and chat experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="default-model-selector">Default chat model</Label>
              <p className="text-muted-foreground text-sm">
                Pick the model you want to start new chats with. You can still
                switch models from the chat composer at any time.
              </p>
            </div>
            <DefaultModelSelector
              initialModelId={currentModelId}
              models={models}
              className="max-w-xl"
              selectorId="default-model-selector"
            />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
