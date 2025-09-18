import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ModelSelector } from '@/components/model-selector';
import { getStaticModels } from '@/lib/ai/models';

export default async function AssistantSettingsPage() {
  // Get the first static model as initial model for the selector
  const models = await getStaticModels();
  const initialModel = models[0]?.id || '';

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Assistant Settings</CardTitle>
          <CardDescription>
            Configure your AI assistant preferences and select your preferred
            model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 font-medium text-lg">Default Model</h3>
            <p className="mb-4 text-muted-foreground text-sm">
              Choose the AI model that will be used by default for your
              conversations.
            </p>
            <ModelSelector initialModel={initialModel} />
          </div>

          <div>
            <h3 className="mb-2 font-medium text-lg">Additional Settings</h3>
            <p className="text-muted-foreground text-sm">
              More assistant configuration options will be available here in
              future updates.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
