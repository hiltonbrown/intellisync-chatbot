'use client';

import * as React from 'react';
import useSWR from 'swr';
import { usePathname, useRouter } from 'next/navigation';
import { type ChatModel, getStaticModels } from '@/lib/ai/models';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon } from './icons';

interface ModelSelectorProps extends React.ComponentProps<'div'> {
  initialModel: string;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch models.');
  const json = await res.json();
  if (!('models' in json) || !Array.isArray(json.models))
    throw new Error('Invalid models response.');
  // Data validation: Only keep valid models
  return (json.models as unknown[]).filter(
    (m): m is ChatModel =>
      !!(
        m &&
        typeof m === 'object' &&
        typeof (m as any).id === 'string' &&
        typeof (m as any).name === 'string'
      ),
  );
}

export function ModelSelector({ initialModel, ...props }: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = React.useState(initialModel);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const {
    data: dynamicModels,
    error,
    isLoading,
    mutate,
  } = useSWR<ChatModel[]>('/api/models', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });

  const [fallbackModels, setFallbackModels] = React.useState<ChatModel[]>([]);

  React.useEffect(() => {
    async function loadStaticModels() {
      const models = await getStaticModels();
      setFallbackModels(models);
    }
    loadStaticModels();
  }, []);

  // Defensive: Always have an array as models
  const models = Array.isArray(dynamicModels) ? dynamicModels : fallbackModels;
  const activeModel = models.find((model) => model.id === selectedModel);

  const handleModelChange = async (modelId: string) => {
    const previous = selectedModel;
    setSelectedModel(modelId);
    setSaving(true);
    setSaveError(null);
    try {
      const resp = await fetch('/api/chat/save-model', {
        method: 'POST',
        body: JSON.stringify({ model: modelId }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error('Failed to save model selection.');
      // Optionally, server responds with confirmation. Could check here.
      if (pathname === '/') {
        router.refresh();
      }
    } catch (err) {
      setSelectedModel(previous); // Revert on error
      setSaveError('Could not save model. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // --- UI States --- //
  if (error) {
    // Network/error state for fetching models
    return (
      <div {...props}>
        <div className="mb-2 flex items-center text-red-600">
          Failed to load models.&nbsp;
          <button
            type="button"
            onClick={() => mutate()}
            className="text-blue-700 underline"
            disabled={isLoading}
          >
            Retry
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled>Model selection unavailable</Button>
          </DropdownMenuTrigger>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div {...props}>
      {isLoading && (
        <div className="mb-2 text-neutral-500 text-sm">
          Loading available models…
        </div>
      )}
      {saveError && <div className="mb-2 text-red-600">{saveError}</div>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="flex h-8 max-w-[120px] items-center px-2 text-xs"
            aria-label="Select model"
            disabled={isLoading || saving}
            variant="outline"
          >
            <span className='overflow-hidden truncate text-ellipsis whitespace-nowrap'>
              {activeModel ? activeModel.name : 'Select model'}
            </span>
            <span className="ml-1 flex-shrink-0">
              <ChevronDownIcon size={12} />
            </span>
            {saving && (
              <svg
                className='ml-1 h-3 w-3 flex-shrink-0 animate-spin text-gray-400'
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Select a model</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={selectedModel}
            onValueChange={handleModelChange}
          >
            {models.length === 0 ? (
              <DropdownMenuRadioItem value="" disabled>
                No models found
              </DropdownMenuRadioItem>
            ) : (
              models.map((model) => (
                <DropdownMenuRadioItem
                  key={model.id}
                  value={model.id}
                  disabled={saving}
                >
                  <strong>{model.name}</strong>
                  <div className="text-muted-foreground text-xs">
                    {model.description}
                  </div>
                </DropdownMenuRadioItem>
              ))
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <div className="mt-2 text-xs text-yellow-600">
          Showing static fallback models due to loading error.
        </div>
      )}
    </div>
  );
}
