'use client';

import { useState, useCallback } from 'react';
import { Save, RotateCcw, Download, Upload, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/toast';
import {
  deserializeUserPreferences,
  isSerializedUserPreferences,
  serializeUserPreferences,
  type UserPreferences,
} from '@/lib/types/preferences';

interface PreferencesManagerProps {
  currentPreferences: UserPreferences;
  onPreferencesReset: () => void;
  onPreferencesImport: (preferences: UserPreferences) => void;
  onPreferencesSaved?: (preferences: UserPreferences) => void;
  hasUnsavedChanges: boolean;
}

export function PreferencesManager({
  currentPreferences,
  onPreferencesReset,
  onPreferencesImport,
  onPreferencesSaved,
  hasUnsavedChanges,
}: PreferencesManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeUserPreferences(currentPreferences)),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const data = await response.json();

      if (!isSerializedUserPreferences(data)) {
        throw new Error('Received malformed preferences');
      }

      const savedPreferences = deserializeUserPreferences(data);

      onPreferencesSaved?.(savedPreferences);

      toast({
        type: 'success',
        description: 'Your preferences have been saved successfully.',
      });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to save your preferences. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentPreferences, onPreferencesSaved]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      onPreferencesReset();

      toast({
        type: 'success',
        description: 'All preferences have been reset to default values.',
      });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to reset preferences. Please try again.',
      });
    } finally {
      setIsResetting(false);
    }
  }, [onPreferencesReset]);

  const handleExport = useCallback(() => {
    try {
      const dataStr = JSON.stringify(
        serializeUserPreferences(currentPreferences),
        null,
        2,
      );
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

      const exportFileDefaultName = `user-preferences-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      toast({
        type: 'success',
        description: 'Your preferences have been exported successfully.',
      });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to export preferences. Please try again.',
      });
    }
  }, [currentPreferences]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);

          if (!isSerializedUserPreferences(parsed)) {
            throw new Error('Invalid preferences file structure');
          }

          const importedPreferences = deserializeUserPreferences(parsed);

          onPreferencesImport(importedPreferences);

          toast({
            type: 'success',
            description: 'Your preferences have been imported successfully.',
          });
        } catch (error) {
          toast({
            type: 'error',
            description:
              'Failed to import preferences. Please check the file format.',
          });
        }
      };
      reader.readAsText(file);

      // Reset the input
      event.target.value = '';
    },
    [onPreferencesImport],
  );

  return (
    <div className='flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-4'>
      <div className='flex items-center gap-2 text-muted-foreground text-sm'>
        {hasUnsavedChanges && (
          <div className='flex items-center gap-1 text-amber-600'>
            <AlertTriangle className="h-4 w-4" />
            <span>Unsaved changes</span>
          </div>
        )}
      </div>

      <div className='ml-auto flex items-center gap-2'>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
          className='flex items-center gap-2'
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isResetting}
              className='flex items-center gap-2'
            >
              <RotateCcw className="h-4 w-4" />
              {isResetting ? 'Resetting...' : 'Reset to Defaults'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Preferences</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all your preferences to their default values.
                This action cannot be undone.
                {hasUnsavedChanges && ' Any unsaved changes will be lost.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                Reset Preferences
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className='flex items-center gap-2'
        >
          <Download className="h-4 w-4" />
          Export
        </Button>

        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
            id="import-preferences"
          />
          <Button
            variant="outline"
            size="sm"
            className='flex items-center gap-2'
            asChild
          >
            <label htmlFor="import-preferences" className="cursor-pointer">
              <Upload className="h-4 w-4" />
              Import
            </label>
          </Button>
        </div>
      </div>
    </div>
  );
}
