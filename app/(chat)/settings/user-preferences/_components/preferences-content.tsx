'use client';

import { useCallback, useMemo, useState } from 'react';
import equal from 'fast-deep-equal';

import { PreferencesSearch } from '@/components/settings/preferences-search';
import { PreferencesManager } from '@/components/settings/preferences-manager';
import { PreferencesFilter } from '@/components/settings/preferences-filter';
import { DefaultModelSelector } from '@/components/settings/default-model-selector';
import { AppearancePreferences } from '@/components/settings/appearance-preferences';
import { NotificationPreferencesComponent } from '@/components/settings/notification-preferences';
import { PrivacyPreferencesComponent } from '@/components/settings/privacy-preferences';
import { AccessibilityPreferencesComponent } from '@/components/settings/accessibility-preferences';
import { AdvancedPreferencesComponent } from '@/components/settings/advanced-preferences';
import {
  createDefaultPreferences,
  deserializeUserPreferences,
  serializeUserPreferences,
  type SerializedUserPreferences,
  type UserPreferences,
} from '@/lib/types/preferences';
import type { ChatModel } from '@/lib/ai/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface PreferencesContentProps {
  initialPreferences: SerializedUserPreferences;
  initialModelId: string;
  models: ChatModel[];
}

export function PreferencesContent({
  initialPreferences,
  initialModelId,
  models,
}: PreferencesContentProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    deserializeUserPreferences(initialPreferences),
  );
  const [savedPreferences, setSavedPreferences] = useState<SerializedUserPreferences>(
    initialPreferences,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const hasUnsavedChanges = useMemo(() => {
    return !equal(serializeUserPreferences(preferences), savedPreferences);
  }, [preferences, savedPreferences]);

  const handleAppearanceChange = useCallback(
    (next: UserPreferences['theme']) => {
      setPreferences((prev) => ({ ...prev, theme: next }));
    },
    [],
  );

  const handleNotificationChange = useCallback(
    (next: UserPreferences['notifications']) => {
      setPreferences((prev) => ({ ...prev, notifications: next }));
    },
    [],
  );

  const handlePrivacyChange = useCallback(
    (next: UserPreferences['privacy']) => {
      setPreferences((prev) => ({ ...prev, privacy: next }));
    },
    [],
  );

  const handleAccessibilityChange = useCallback(
    (next: UserPreferences['accessibility']) => {
      setPreferences((prev) => ({ ...prev, accessibility: next }));
    },
    [],
  );

  const handleAdvancedChange = useCallback(
    (next: UserPreferences['advanced']) => {
      setPreferences((prev) => ({ ...prev, advanced: next }));
    },
    [],
  );

  const handlePreferencesReset = useCallback(() => {
    setPreferences(createDefaultPreferences());
  }, []);

  const handlePreferencesImport = useCallback((imported: UserPreferences) => {
    setPreferences(imported);
  }, []);

  const handlePreferencesSaved = useCallback((saved: UserPreferences) => {
    setPreferences(saved);
    setSavedPreferences(serializeUserPreferences(saved));
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleCategoryFilter = useCallback((categories: string[]) => {
    setSelectedCategories(categories);
  }, []);

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className='font-semibold text-3xl'>User Preferences</h1>
          <p className="text-muted-foreground">
            Personalize your workspace defaults and chat experience.
          </p>
        </div>

        <PreferencesSearch
          onSearchChange={handleSearchChange}
          onCategoryFilter={handleCategoryFilter}
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        />

        <PreferencesManager
          currentPreferences={preferences}
          onPreferencesReset={handlePreferencesReset}
          onPreferencesImport={handlePreferencesImport}
          onPreferencesSaved={handlePreferencesSaved}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </div>

      <div className="space-y-12">
        <PreferencesFilter
          category="general"
          title="General"
          description="Chat defaults and key workspace preferences."
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        >
          <Card>
            <CardHeader>
              <CardTitle>Default chat model</CardTitle>
              <CardDescription>
                Pick the model you want to start new chats with. You can still
                switch models from the chat composer at any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="default-model-selector">Model</Label>
                <DefaultModelSelector
                  initialModelId={initialModelId}
                  models={models}
                  className="max-w-xl"
                  selectorId="default-model-selector"
                />
              </div>
            </CardContent>
          </Card>
        </PreferencesFilter>

        <PreferencesFilter
          category="appearance"
          title="Appearance"
          description="Theme, colors, and layout preferences."
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        >
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className='font-semibold text-2xl'>Appearance</h2>
              <p className="text-muted-foreground">
                Personalize the interface to suit your style and focus.
              </p>
            </div>
            <AppearancePreferences
              initialPreferences={preferences.theme}
              onPreferencesChange={handleAppearanceChange}
            />
          </section>
        </PreferencesFilter>

        <PreferencesFilter
          category="notifications"
          title="Notifications"
          description="Email, browser, and chat alert settings."
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        >
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className='font-semibold text-2xl'>Notifications</h2>
              <p className="text-muted-foreground">
                Stay informed about conversations and system updates on your
                terms.
              </p>
            </div>
            <NotificationPreferencesComponent
              initialPreferences={preferences.notifications}
              onPreferencesChange={handleNotificationChange}
            />
          </section>
        </PreferencesFilter>

        <PreferencesFilter
          category="privacy"
          title="Privacy"
          description="Data sharing, analytics, and security controls."
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        >
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className='font-semibold text-2xl'>Privacy</h2>
              <p className="text-muted-foreground">
                Configure how your data is collected, shared, and exposed.
              </p>
            </div>
            <PrivacyPreferencesComponent
              initialPreferences={preferences.privacy}
              onPreferencesChange={handlePrivacyChange}
            />
          </section>
        </PreferencesFilter>

        <PreferencesFilter
          category="accessibility"
          title="Accessibility"
          description="Visual and interaction accommodations."
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        >
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className='font-semibold text-2xl'>Accessibility</h2>
              <p className="text-muted-foreground">
                Tailor the experience for comfort and usability.
              </p>
            </div>
            <AccessibilityPreferencesComponent
              initialPreferences={preferences.accessibility}
              onPreferencesChange={handleAccessibilityChange}
            />
          </section>
        </PreferencesFilter>

        <PreferencesFilter
          category="advanced"
          title="Advanced"
          description="Developer tools and system tuning."
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        >
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className='font-semibold text-2xl'>Advanced</h2>
              <p className="text-muted-foreground">
                Unlock developer options and performance controls.
              </p>
            </div>
            <AdvancedPreferencesComponent
              initialPreferences={preferences.advanced}
              onPreferencesChange={handleAdvancedChange}
            />
          </section>
        </PreferencesFilter>
      </div>
    </div>
  );
}
