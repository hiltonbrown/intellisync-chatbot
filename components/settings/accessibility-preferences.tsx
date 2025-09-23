'use client';

import { useEffect, useState } from 'react';
import { Eye, Type, Volume2, Palette } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import type { AccessibilityPreferences } from '@/lib/types/preferences';

interface AccessibilityPreferencesProps {
  initialPreferences?: Partial<AccessibilityPreferences>;
  onPreferencesChange?: (preferences: AccessibilityPreferences) => void;
}

export function AccessibilityPreferencesComponent({
  initialPreferences,
  onPreferencesChange,
}: AccessibilityPreferencesProps) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    highContrast: initialPreferences?.highContrast ?? false,
    colorBlindness: initialPreferences?.colorBlindness ?? false,
    fontSize: initialPreferences?.fontSize ?? 'medium',
    lineSpacing: initialPreferences?.lineSpacing ?? 'normal',
    textToSpeech: initialPreferences?.textToSpeech ?? false,
  });

  useEffect(() => {
    setPreferences({
      highContrast: initialPreferences?.highContrast ?? false,
      colorBlindness: initialPreferences?.colorBlindness ?? false,
      fontSize: initialPreferences?.fontSize ?? 'medium',
      lineSpacing: initialPreferences?.lineSpacing ?? 'normal',
      textToSpeech: initialPreferences?.textToSpeech ?? false,
    });
  }, [initialPreferences]);

  const handlePreferenceChange = (
    key: keyof AccessibilityPreferences,
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
            <Eye className="h-5 w-5" />
            Visual Accessibility
          </CardTitle>
          <CardDescription>
            Customize visual elements for better readability and accessibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">High Contrast Mode</Label>
              <p className="text-muted-foreground text-sm">
                Increase contrast between text and background for better
                visibility.
              </p>
            </div>
            <Switch
              checked={preferences.highContrast}
              onCheckedChange={(checked) =>
                handlePreferenceChange('highContrast', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Color Blindness Support</Label>
              <p className="text-muted-foreground text-sm">
                Adjust colors and patterns to be more accessible for color
                vision deficiencies.
              </p>
            </div>
            <Switch
              checked={preferences.colorBlindness}
              onCheckedChange={(checked) =>
                handlePreferenceChange('colorBlindness', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Text & Reading
          </CardTitle>
          <CardDescription>
            Adjust text size, spacing, and reading preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="font-medium">Font Size</Label>
            <RadioGroup
              value={preferences.fontSize}
              onValueChange={(value) =>
                handlePreferenceChange('fontSize', value)
              }
              className="flex flex-col gap-3"
            >
              <RadioGroup.Option
                value="small"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-sm">Small</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Compact text for more content
                    </div>
                  </div>
                }
              />
              <RadioGroup.Option
                value="medium"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-base">Medium</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Balanced readability
                    </div>
                  </div>
                }
              />
              <RadioGroup.Option
                value="large"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-lg">Large</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Easier reading for longer sessions
                    </div>
                  </div>
                }
              />
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="font-medium">Line Spacing</Label>
            <RadioGroup
              value={preferences.lineSpacing}
              onValueChange={(value) =>
                handlePreferenceChange('lineSpacing', value)
              }
              className="flex flex-col gap-3"
            >
              <RadioGroup.Option
                value="normal"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-sm">Normal</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Standard spacing
                    </div>
                  </div>
                }
              />
              <RadioGroup.Option
                value="relaxed"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-sm">Relaxed</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      More space between lines
                    </div>
                  </div>
                }
              />
              <RadioGroup.Option
                value="loose"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-sm">Loose</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Maximum spacing for easy reading
                    </div>
                  </div>
                }
              />
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Audio & Interaction
          </CardTitle>
          <CardDescription>
            Configure audio feedback and interaction preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Text-to-Speech</Label>
              <p className="text-muted-foreground text-sm">
                Enable voice synthesis for reading text content aloud.
              </p>
            </div>
            <Switch
              checked={preferences.textToSpeech}
              onCheckedChange={(checked) =>
                handlePreferenceChange('textToSpeech', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Screen Reader Optimization</Label>
              <p className="text-muted-foreground text-sm">
                Optimize interface for screen reader compatibility.
              </p>
            </div>
            <Switch
              checked={false} // Default disabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Keyboard Navigation</Label>
              <p className="text-muted-foreground text-sm">
                Enhanced keyboard shortcuts and focus indicators.
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
            <Palette className="h-5 w-5" />
            Color & Theme Adjustments
          </CardTitle>
          <CardDescription>
            Fine-tune color schemes and visual themes for accessibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Reduce Transparency</Label>
              <p className="text-muted-foreground text-sm">
                Make backgrounds more opaque for better text readability.
              </p>
            </div>
            <Switch
              checked={false} // Default disabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Focus Indicators</Label>
              <p className="text-muted-foreground text-sm">
                Highlight interactive elements when navigating with keyboard.
              </p>
            </div>
            <Switch
              checked={true} // Default enabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="space-y-3">
            <Label className="font-medium">Quick Actions</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Reset to Defaults
              </Button>
              <Button variant="outline" size="sm">
                Test Accessibility
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
