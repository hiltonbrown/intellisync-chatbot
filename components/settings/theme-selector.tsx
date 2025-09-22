'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { RadioGroup } from '@/src/ui/components/RadioGroup';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ThemeMode } from '@/lib/types/preferences';

interface ThemeSelectorProps {
  initialMode?: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
}

const themeOptions = [
  {
    value: 'light' as const,
    label: 'Light',
    description: 'Always use light theme',
    icon: Sun,
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    description: 'Always use dark theme',
    icon: Moon,
  },
  {
    value: 'system' as const,
    label: 'System',
    description: 'Follow system preference',
    icon: Monitor,
  },
];

export function ThemeSelector({
  initialMode,
  onModeChange,
}: ThemeSelectorProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as ThemeMode);
    onModeChange?.(newTheme as ThemeMode);
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Theme</CardTitle>
        <CardDescription>
          Choose your preferred theme or follow your system setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme || 'system'}
          onValueChange={handleThemeChange}
          className="flex flex-col gap-4"
        >
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <RadioGroup.Option
                key={option.value}
                value={option.value}
                label={
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-muted-foreground text-sm">
                        {option.description}
                      </span>
                    </div>
                  </div>
                }
              />
            );
          })}
        </RadioGroup>
        <div className="mt-4 text-muted-foreground text-sm">
          Current theme:{' '}
          <span className='font-medium capitalize'>{resolvedTheme}</span>
        </div>
      </CardContent>
    </Card>
  );
}
