'use client';

import { useEffect, useState } from 'react';

import { ThemeSelector } from './theme-selector';
import { AccentColorSelector } from './accent-color-selector';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/src/ui/components/Switch';
import type {
  ThemeMode,
  AccentColor,
  ThemePreferences,
} from '@/lib/types/preferences';

interface AppearancePreferencesProps {
  initialPreferences?: Partial<ThemePreferences>;
  onPreferencesChange?: (preferences: ThemePreferences) => void;
}

export function AppearancePreferences({
  initialPreferences,
  onPreferencesChange,
}: AppearancePreferencesProps) {
  const [preferences, setPreferences] = useState<ThemePreferences>({
    mode: initialPreferences?.mode || 'system',
    accentColor: initialPreferences?.accentColor || 'blue',
    fontSize: initialPreferences?.fontSize || 'medium',
    reducedMotion: initialPreferences?.reducedMotion || false,
  });

  useEffect(() => {
    setPreferences({
      mode: initialPreferences?.mode || 'system',
      accentColor: initialPreferences?.accentColor || 'blue',
      fontSize: initialPreferences?.fontSize || 'medium',
      reducedMotion: initialPreferences?.reducedMotion || false,
    });
  }, [initialPreferences]);

  const handleThemeChange = (mode: ThemeMode) => {
    const newPreferences = { ...preferences, mode };
    setPreferences(newPreferences);
    onPreferencesChange?.(newPreferences);
  };

  const handleAccentColorChange = (accentColor: AccentColor) => {
    const newPreferences = { ...preferences, accentColor };
    setPreferences(newPreferences);
    onPreferencesChange?.(newPreferences);
  };

  const handleReducedMotionChange = (reducedMotion: boolean) => {
    const newPreferences = { ...preferences, reducedMotion };
    setPreferences(newPreferences);
    onPreferencesChange?.(newPreferences);
  };

  return (
    <div className="space-y-6">
      <ThemeSelector
        initialMode={preferences.mode}
        onModeChange={handleThemeChange}
      />

      <AccentColorSelector
        initialColor={preferences.accentColor}
        onColorChange={handleAccentColorChange}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Motion & Animation</CardTitle>
          <CardDescription>
            Control animation and motion effects throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-medium">Reduced Motion</div>
              <div className="text-muted-foreground text-sm">
                Minimize animations and transitions for better accessibility.
              </div>
            </div>
            <Switch
              checked={preferences.reducedMotion}
              onCheckedChange={handleReducedMotionChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
