'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { CpuIcon, ChevronDownIcon } from './icons';
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
import { getStaticModels, type ChatModel } from '@/lib/ai/models';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { startTransition } from 'react';

interface FloatingModelSelectorProps
  extends Omit<HTMLMotionProps<'div'>, 'children'> {
  selectedModelId: string;
}

export function FloatingModelSelector({
  selectedModelId,
  ...props
}: FloatingModelSelectorProps) {
  const [optimisticModelId, setOptimisticModelId] =
    React.useState(selectedModelId);
  const [chatModels, setChatModels] = React.useState<ChatModel[]>([]);

  React.useEffect(() => {
    getStaticModels().then(setChatModels);
  }, []);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId,
  );

  const handleModelChange = (modelId: string) => {
    setOptimisticModelId(modelId);
    startTransition(() => {
      saveChatModelAsCookie(modelId);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 right-4 z-50"
      {...props}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-auto max-w-[140px] rounded-full border-gray-200 bg-white/90 px-2 py-1 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white/95"
          >
            <div className="flex items-center gap-1">
              <div className='flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#0FA47F] text-white'>
                <CpuIcon size={10} />
              </div>
              <span className='overflow-hidden truncate text-ellipsis whitespace-nowrap font-medium text-gray-700 text-xs'>
                {selectedModel?.name || 'Select Model'}
              </span>
              <div className='flex-shrink-0 text-gray-500'>
                <ChevronDownIcon size={10} />
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60 p-2" align="end">
          <DropdownMenuLabel className="mb-2 font-medium text-gray-500 text-xs">
            Choose a model
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={optimisticModelId}
            onValueChange={handleModelChange}
          >
            {chatModels.map((model) => (
              <DropdownMenuRadioItem
                key={model.id}
                value={model.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-gray-50"
              >
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#0FA47F] text-white">
                  <CpuIcon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 text-sm">
                    {model.name}
                  </div>
                  <div className="mt-1 text-gray-500 text-xs leading-relaxed">
                    {model.description}
                  </div>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
