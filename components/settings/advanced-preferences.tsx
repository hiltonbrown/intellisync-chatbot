'use client';

import { useEffect, useState } from 'react';
import { Settings, Cpu, Database, Code, Zap } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/src/ui/components/Switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/src/ui/components/RadioGroup';
import type { AdvancedPreferences } from '@/lib/types/preferences';

interface AdvancedPreferencesProps {
  initialPreferences?: Partial<AdvancedPreferences>;
  onPreferencesChange?: (preferences: AdvancedPreferences) => void;
}

export function AdvancedPreferencesComponent({
  initialPreferences,
  onPreferencesChange,
}: AdvancedPreferencesProps) {
  const [preferences, setPreferences] = useState<AdvancedPreferences>({
    debugMode: initialPreferences?.debugMode ?? false,
    performanceMode: initialPreferences?.performanceMode ?? 'balanced',
    cachingEnabled: initialPreferences?.cachingEnabled ?? true,
    apiAccess: initialPreferences?.apiAccess ?? false,
    experimentalFeatures: initialPreferences?.experimentalFeatures ?? false,
  });

  useEffect(() => {
    setPreferences({
      debugMode: initialPreferences?.debugMode ?? false,
      performanceMode: initialPreferences?.performanceMode ?? 'balanced',
      cachingEnabled: initialPreferences?.cachingEnabled ?? true,
      apiAccess: initialPreferences?.apiAccess ?? false,
      experimentalFeatures: initialPreferences?.experimentalFeatures ?? false,
    });
  }, [initialPreferences]);

  const handlePreferenceChange = <K extends keyof AdvancedPreferences>(
    key: K,
    value: AdvancedPreferences[K],
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
            <Settings className="h-5 w-5" />
            Developer Options
          </CardTitle>
          <CardDescription>
            Advanced settings for developers and power users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Debug Mode</Label>
              <p className="text-muted-foreground text-sm">
                Enable detailed logging and debugging information.
              </p>
            </div>
            <Switch
              checked={preferences.debugMode}
              onCheckedChange={(checked) =>
                handlePreferenceChange('debugMode', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">API Access</Label>
              <p className="text-muted-foreground text-sm">
                Enable direct API access for integrations and automation.
              </p>
            </div>
            <Switch
              checked={preferences.apiAccess}
              onCheckedChange={(checked) =>
                handlePreferenceChange('apiAccess', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Experimental Features</Label>
              <p className="text-muted-foreground text-sm">
                Try new features that are still in development.
              </p>
            </div>
            <Switch
              checked={preferences.experimentalFeatures}
              onCheckedChange={(checked) =>
                handlePreferenceChange('experimentalFeatures', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Performance Settings
          </CardTitle>
          <CardDescription>
            Optimize performance and resource usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="font-medium">Performance Mode</Label>
            <RadioGroup
              value={preferences.performanceMode}
              onValueChange={(value) =>
                handlePreferenceChange('performanceMode', value)
              }
              className="flex flex-col gap-3"
            >
              <RadioGroup.Option
                value="power-saver"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-sm">Power Saver</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Reduced animations, lower resource usage
                    </div>
                  </div>
                }
              />
              <RadioGroup.Option
                value="balanced"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-sm">Balanced</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Optimal performance and battery life
                    </div>
                  </div>
                }
              />
              <RadioGroup.Option
                value="high-performance"
                label={
                  <div className="flex items-center gap-3">
                    <div className="text-sm">High Performance</div>
                    <div className='ml-auto text-muted-foreground text-xs'>
                      Maximum speed, higher resource usage
                    </div>
                  </div>
                }
              />
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Enable Caching</Label>
              <p className="text-muted-foreground text-sm">
                Cache responses and assets for faster loading.
              </p>
            </div>
            <Switch
              checked={preferences.cachingEnabled}
              onCheckedChange={(checked) =>
                handlePreferenceChange('cachingEnabled', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Manage your data storage and synchronization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Offline Mode</Label>
              <p className="text-muted-foreground text-sm">
                Enable offline functionality and local data storage.
              </p>
            </div>
            <Switch
              checked={false} // Default disabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Auto-Sync</Label>
              <p className="text-muted-foreground text-sm">
                Automatically sync data across devices.
              </p>
            </div>
            <Switch
              checked={true} // Default enabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="space-y-3">
            <Label className="font-medium">Storage Management</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Clear Cache
              </Button>
              <Button variant="outline" size="sm">
                Export Data
              </Button>
              <Button variant="outline" size="sm">
                Import Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Integration Settings
          </CardTitle>
          <CardDescription>
            Configure third-party integrations and API connections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Webhook Support</Label>
              <p className="text-muted-foreground text-sm">
                Enable webhook endpoints for real-time integrations.
              </p>
            </div>
            <Switch
              checked={false} // Default disabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Custom Endpoints</Label>
              <p className="text-muted-foreground text-sm">
                Configure custom API endpoints and authentication.
              </p>
            </div>
            <Switch
              checked={false} // Default disabled
              onCheckedChange={() => {}} // Placeholder for future implementation
            />
          </div>

          <div className="space-y-3">
            <Label className="font-medium">API Keys</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Manage Keys
              </Button>
              <Button variant="outline" size="sm">
                View Logs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            System Diagnostics
          </CardTitle>
          <CardDescription>
            Monitor system performance and troubleshoot issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-medium text-sm">Response Time</Label>
              <div className='font-bold text-2xl'>142ms</div>
              <div className='text-muted-foreground text-xs'>Average</div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-sm">Memory Usage</Label>
              <div className='font-bold text-2xl'>67%</div>
              <div className='text-muted-foreground text-xs'>Current</div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-sm">Cache Hit Rate</Label>
              <div className='font-bold text-2xl'>94%</div>
              <div className='text-muted-foreground text-xs'>Last 24h</div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-sm">Error Rate</Label>
              <div className='font-bold text-2xl'>0.1%</div>
              <div className='text-muted-foreground text-xs'>Last 24h</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Run Diagnostics
            </Button>
            <Button variant="outline" size="sm">
              View Logs
            </Button>
            <Button variant="outline" size="sm">
              Reset Metrics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
