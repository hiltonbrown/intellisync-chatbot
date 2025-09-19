'use client';

import { useMemo, useState, useTransition } from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  DEFAULT_CHAT_MODEL,
  type ChatModel,
} from '@/lib/ai/models';
import { cn } from '@/lib/utils';

interface DefaultModelSelectorProps {
  models: Array<ChatModel>;
  initialModelId: string;
  className?: string;
  selectorId?: string;
}

const allowedModelIds = new Set<string>([
  DEFAULT_CHAT_MODEL,
  ...entitlementsByUserType.regular.availableChatModelIds,
]);

const modelMetadata: Record<string, { name: string; description: string }> = {
  'google/gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'Balanced default model tuned for fast, high-quality replies.',
  },
  'openai/gpt-oss-120b:free': {
    name: 'GPT-OSS 120B',
    description: 'OpenRouter community model built for broad general-purpose tasks.',
  },
  'meta-llama/llama-4-maverick:free': {
    name: 'Llama 4 Maverick',
    description: 'Meta’s flagship model offering creative and structured responses.',
  },
  'google/gemma-3-27b-it:free': {
    name: 'Gemma 3 27B Instruct',
    description: 'Google Gemma instruct model optimized for thoughtful reasoning.',
  },
};

export function DefaultModelSelector({
  models,
  initialModelId,
  className,
  selectorId,
}: DefaultModelSelectorProps) {
  const [selectedModelId, setSelectedModelId] = useState(initialModelId);
  const [isPending, startTransition] = useTransition();
  const triggerId = selectorId ?? 'default-model-selector';

  const displayModels = useMemo(() => {
    const mappedModels = new Map<string, ChatModel>();

    const withOverrides = (model: ChatModel): ChatModel => {
      const overrides = modelMetadata[model.id];
      return overrides ? { ...model, ...overrides } : model;
    };

    for (const model of models) {
      if (allowedModelIds.has(model.id) || model.id === initialModelId) {
        mappedModels.set(model.id, withOverrides(model));
      }
    }

    for (const modelId of allowedModelIds) {
      if (!mappedModels.has(modelId)) {
        const overrides = modelMetadata[modelId];
        mappedModels.set(modelId, {
          id: modelId,
          name: overrides?.name ?? humanizeModelId(modelId),
          description:
            overrides?.description ?? 'Choose this model for your chats.',
        });
      }
    }

    if (!mappedModels.has(initialModelId)) {
      const overrides = modelMetadata[initialModelId];
      mappedModels.set(initialModelId, {
        id: initialModelId,
        name: overrides?.name ?? humanizeModelId(initialModelId),
        description:
          overrides?.description ?? 'Choose this model for your chats.',
      });
    }

    return Array.from(mappedModels.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [models, initialModelId]);

  const selectedModel = displayModels.find(
    (model) => model.id === selectedModelId,
  );

  const handleChange = (modelId: string) => {
    setSelectedModelId(modelId);

    startTransition(() => {
      saveChatModelAsCookie(modelId);
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <Select
          value={selectedModelId}
          onValueChange={handleChange}
          disabled={isPending}
        >
          <SelectTrigger
            className="w-full"
            aria-label="Preferred chat model"
            data-testid={triggerId}
            id={triggerId}
          >
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {displayModels.map((model) => (
              <SelectItem
                key={model.id}
                value={model.id}
                textValue={model.name}
                className="py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{model.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {model.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-muted-foreground text-sm">
        {isPending
          ? 'Saving your preference...'
          : selectedModel?.description ??
            'Choose a model to personalize your default chat experience.'}
      </p>
    </div>
  );
}

function humanizeModelId(modelId: string): string {
  const withoutVendor = modelId.split('/').pop() ?? modelId;
  const cleaned = withoutVendor.replace(/[:_-]/g, ' ');
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
