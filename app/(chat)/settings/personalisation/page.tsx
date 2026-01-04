import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SettingsHeader } from "@/components/settings-header";
import { Button } from "@/components/ui/button";

export default function PersonalisationPage() {
  return (
    <>
      <SettingsHeader />
      <div className="flex flex-col gap-8 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Personalisation</h1>
        </div>
        
        <div className="flex flex-col gap-6">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">System Prompt</h2>
            <p className="text-muted-foreground mb-4">
              Customize the AI's behavior by modifying the system prompt. This affects how the AI responds to your queries.
            </p>
            <div className="text-sm text-muted-foreground">
              Coming soon: Custom system prompt editor
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">AI Preferences</h2>
            <p className="text-muted-foreground mb-4">
              Configure how the AI interacts with you, including response style, verbosity, and tone.
            </p>
            <div className="text-sm text-muted-foreground">
              Coming soon: AI preference controls
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
