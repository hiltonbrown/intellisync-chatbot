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
import { entitlementsByUserType, getEntitlements } from '@/lib/ai/entitlements';
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

const defaultAllowedModels = new Set<string>([
  DEFAULT_CHAT_MODEL,
  ...entitlementsByUserType.free.availableChatModelIds,
]);

const modelMetadata: Record<string, { name: string; description: string }> = {
  'meta-llama/llama-3.2-3b-instruct': {
    name: 'Llama 3.2 3B Instruct',
    description: 'Meta’s 2025 lightweight instruct model tuned for fast helpful replies.',
  },
  'meta-llama/llama-3.3-8b-instruct:free': {
    name: 'Llama 3.3 8B (Free)',
    description: 'Free access to Meta’s larger Llama 3.3 assistant for richer answers.',
  },
  'mistralai/mistral-small-3.1-24b-instruct:free': {
    name: 'Mistral Small 3.1 Instruct (Free)',
    description: '24B Mixture-of-Experts model ideal for analytical and multilingual work.',
  },
  'deepseek/deepseek-chat-v3.1:free': {
    name: 'DeepSeek V3.1 (Free)',
    description: 'Hybrid reasoning chat model with long-context and agentic tooling.',
  },
  'deepseek/deepseek-r1-distill-llama-70b:free': {
    name: 'DeepSeek R1 Distill Llama 70B (Free)',
    description: 'Reasoning-focused 70B distillation that excels at STEM and coding tasks.',
  },
  'openai/gpt-4o-mini': {
    name: 'GPT-4o mini',
    description: 'OpenAI’s latest cost-efficient multimodal model for everyday assistants.',
  },
  'google/gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'Google’s flagship 2.5 release balancing speed, quality, and tool use.',
  },
  'qwen/qwen3-next-80b-a3b-instruct': {
    name: 'Qwen3 Next 80B',
    description: 'Alibaba’s Next-gen 80B model tuned for stable multi-turn automation.',
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

    const userEntitlements = getEntitlements('free');
    const allowedModelIds = new Set([
      DEFAULT_CHAT_MODEL,
      ...defaultAllowedModels,
      ...userEntitlements.availableChatModelIds,
    ]);

    for (const model of models) {
      const allowAll = allowedModelIds.has('*');
      if (allowedModelIds.has(model.id) || allowAll || model.id === initialModelId) {
        mappedModels.set(model.id, withOverrides(model));
      }
    }

    for (const modelId of allowedModelIds) {
      if (modelId === '*') {
        continue;
      }
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
