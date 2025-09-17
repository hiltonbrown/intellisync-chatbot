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
import { chatModels } from '@/lib/ai/models';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { startTransition } from 'react';

interface FloatingModelSelectorProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  selectedModelId: string;
}

export function FloatingModelSelector({
  selectedModelId,
  ...props
}: FloatingModelSelectorProps) {
  const [optimisticModelId, setOptimisticModelId] =
    React.useState(selectedModelId);

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
            className='h-auto rounded-full border-gray-200 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white/95'
          >
            <div className="flex items-center gap-2">
              <div className='flex h-6 w-6 items-center justify-center rounded-full bg-[#0FA47F] text-white'>
                <CpuIcon size={14} />
              </div>
              <span className='font-medium text-gray-700 text-sm'>
                {selectedModel?.name || 'Select Model'}
              </span>
              <div className="text-gray-500">
                <ChevronDownIcon size={14} />
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 p-2" align="end">
          <DropdownMenuLabel className='mb-2 font-medium text-gray-500 text-xs'>
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
                className='flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-gray-50'
              >
                <div className='mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#0FA47F] text-white'>
                  <CpuIcon size={16} />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='font-medium text-gray-900 text-sm'>
                    {model.name}
                  </div>
                  <div className='mt-1 text-gray-500 text-xs leading-relaxed'>
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
