'use client';

import { useEffect, useState } from 'react';
import { Bell, Monitor, MessageSquare, Clock } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/src/ui/components/Switch';
import { Label } from '@/components/ui/label';
import { TextField } from '@/src/ui/components/TextField';
import type { NotificationPreferences } from '@/lib/types/preferences';

interface NotificationPreferencesProps {
  initialPreferences?: Partial<NotificationPreferences>;
  onPreferencesChange?: (preferences: NotificationPreferences) => void;
}

export function NotificationPreferencesComponent({
  initialPreferences,
  onPreferencesChange,
}: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: initialPreferences?.emailNotifications ?? true,
    browserNotifications: initialPreferences?.browserNotifications ?? true,
    mentionNotifications: initialPreferences?.mentionNotifications ?? true,
    systemUpdates: initialPreferences?.systemUpdates ?? false,
    quietHours: initialPreferences?.quietHours ?? {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  });

  useEffect(() => {
    setPreferences({
      emailNotifications: initialPreferences?.emailNotifications ?? true,
      browserNotifications: initialPreferences?.browserNotifications ?? true,
      mentionNotifications: initialPreferences?.mentionNotifications ?? true,
      systemUpdates: initialPreferences?.systemUpdates ?? false,
      quietHours: initialPreferences?.quietHours ?? {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    });
  }, [initialPreferences]);

  const handlePreferenceChange = (
    key: keyof NotificationPreferences,
    value: any,
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    onPreferencesChange?.(newPreferences);
  };

  const handleQuietHoursChange = (
    field: 'enabled' | 'start' | 'end',
    value: boolean | string,
  ) => {
    const newQuietHours = { ...preferences.quietHours, [field]: value };
    handlePreferenceChange('quietHours', newQuietHours);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Configure when you receive email notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">New Messages</Label>
              <p className="text-muted-foreground text-sm">
                Get notified when you receive new messages.
              </p>
            </div>
            <Switch
              checked={preferences.emailNotifications}
              onCheckedChange={(checked) =>
                handlePreferenceChange('emailNotifications', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">@Mentions</Label>
              <p className="text-muted-foreground text-sm">
                Get notified when someone mentions you.
              </p>
            </div>
            <Switch
              checked={preferences.mentionNotifications}
              onCheckedChange={(checked) =>
                handlePreferenceChange('mentionNotifications', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">System Updates</Label>
              <p className="text-muted-foreground text-sm">
                Receive updates about new features and maintenance.
              </p>
            </div>
            <Switch
              checked={preferences.systemUpdates}
              onCheckedChange={(checked) =>
                handlePreferenceChange('systemUpdates', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Browser Notifications
          </CardTitle>
          <CardDescription>
            Control desktop notifications in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Browser Alerts</Label>
              <p className="text-muted-foreground text-sm">
                Show desktop notifications for new messages and mentions.
              </p>
            </div>
            <Switch
              checked={preferences.browserNotifications}
              onCheckedChange={(checked) =>
                handlePreferenceChange('browserNotifications', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat Notifications
          </CardTitle>
          <CardDescription>
            Customize in-app notification behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Sound Effects</Label>
              <p className="text-muted-foreground text-sm">
                Play sounds for new messages and notifications.
              </p>
            </div>
            <Switch
              checked={preferences.browserNotifications} // Using same setting for now
              onCheckedChange={(checked) =>
                handlePreferenceChange('browserNotifications', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Message Previews</Label>
              <p className="text-muted-foreground text-sm">
                Show message content in notifications.
              </p>
            </div>
            <Switch
              checked={true} // Default enabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set times when you don't want to receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Enable Quiet Hours</Label>
              <p className="text-muted-foreground text-sm">
                Pause notifications during specified hours.
              </p>
            </div>
            <Switch
              checked={preferences.quietHours.enabled}
              onCheckedChange={(checked) =>
                handleQuietHoursChange('enabled', checked)
              }
            />
          </div>

          {preferences.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <TextField label="Start Time">
                  <TextField.Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) =>
                      handleQuietHoursChange('start', e.target.value)
                    }
                  />
                </TextField>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <TextField label="End Time">
                  <TextField.Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) =>
                      handleQuietHoursChange('end', e.target.value)
                    }
                  />
                </TextField>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
