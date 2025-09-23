'use client';

import { useEffect, useState } from 'react';
import { Shield, Eye, Database, Lock } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/src/ui/components/Switch';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/src/ui/components/RadioGroup';
import type { PrivacyPreferences } from '@/lib/types/preferences';

interface PrivacyPreferencesProps {
  initialPreferences?: Partial<PrivacyPreferences>;
  onPreferencesChange?: (preferences: PrivacyPreferences) => void;
}

export function PrivacyPreferencesComponent({
  initialPreferences,
  onPreferencesChange,
}: PrivacyPreferencesProps) {
  const [preferences, setPreferences] = useState<PrivacyPreferences>({
    analytics: initialPreferences?.analytics ?? true,
    crashReporting: initialPreferences?.crashReporting ?? true,
    dataSharing: initialPreferences?.dataSharing ?? false,
    chatVisibility: initialPreferences?.chatVisibility ?? 'private',
  });

  useEffect(() => {
    setPreferences({
      analytics: initialPreferences?.analytics ?? true,
      crashReporting: initialPreferences?.crashReporting ?? true,
      dataSharing: initialPreferences?.dataSharing ?? false,
      chatVisibility: initialPreferences?.chatVisibility ?? 'private',
    });
  }, [initialPreferences]);

  const handlePreferenceChange = (
    key: keyof PrivacyPreferences,
    value: any,
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    onPreferencesChange?.(newPreferences);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Collection & Analytics
          </CardTitle>
          <CardDescription>
            Control how we collect and use your data to improve our services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Usage Analytics</Label>
              <p className="text-muted-foreground text-sm">
                Help us improve by sharing anonymous usage data and feature
                usage patterns.
              </p>
            </div>
            <Switch
              checked={preferences.analytics}
              onCheckedChange={(checked) =>
                handlePreferenceChange('analytics', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Crash Reporting</Label>
              <p className="text-muted-foreground text-sm">
                Automatically send crash reports to help us fix issues and
                improve stability.
              </p>
            </div>
            <Switch
              checked={preferences.crashReporting}
              onCheckedChange={(checked) =>
                handlePreferenceChange('crashReporting', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Data Sharing with Partners</Label>
              <p className="text-muted-foreground text-sm">
                Share anonymized data with trusted partners for research and
                development.
              </p>
            </div>
            <Switch
              checked={preferences.dataSharing}
              onCheckedChange={(checked) =>
                handlePreferenceChange('dataSharing', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Chat Visibility
          </CardTitle>
          <CardDescription>
            Control who can see your chat conversations and activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={preferences.chatVisibility}
            onValueChange={(value) =>
              handlePreferenceChange('chatVisibility', value)
            }
            className="flex flex-col gap-4"
          >
            <RadioGroup.Option
              value="private"
              label={
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Private</span>
                    <span className="text-muted-foreground text-sm">
                      Only you can see your chats and activity.
                    </span>
                  </div>
                </div>
              }
            />
            <RadioGroup.Option
              value="public"
              label={
                <div className="flex items-center gap-3">
                  <Eye className="h-4 w-4" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Public</span>
                    <span className="text-muted-foreground text-sm">
                      Your chats may be visible to others (not recommended).
                    </span>
                  </div>
                </div>
              }
            />
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security & Privacy
          </CardTitle>
          <CardDescription>
            Additional privacy and security settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Enhanced Privacy Mode</Label>
              <p className="text-muted-foreground text-sm">
                Limit data collection and disable non-essential features for
                maximum privacy.
              </p>
            </div>
            <Switch
              checked={false} // Default disabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Data Export</Label>
              <p className="text-muted-foreground text-sm">
                Download a copy of all your data stored in our systems.
              </p>
            </div>
            <button
              className='rounded-md bg-secondary px-3 py-1 text-sm transition-colors hover:bg-secondary/80'
              type="button"
            >
              Export Data
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Delete Account</Label>
              <p className="text-muted-foreground text-sm">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <button
              className='rounded-md bg-destructive px-3 py-1 text-destructive-foreground text-sm transition-colors hover:bg-destructive/80'
              type="button"
            >
              Delete Account
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
