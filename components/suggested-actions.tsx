'use client';

import { motion } from 'framer-motion';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { ChatMessage } from '@/lib/types';
import { Suggestion } from './elements/suggestion';
import { generateUUID } from '@/lib/utils';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  sendMessage,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const suggestedActions = [
    'Explain quantum computing in simple terms',
    'Write a Python function to reverse a string',
    'Help me plan a healthy meal prep for the week',
    'What are the latest developments in AI?',
    'Create a creative story about time travel',
    'Explain how photosynthesis works',
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={suggestedAction}
        >
          <Suggestion
            suggestion={suggestedAction}
            onClick={(suggestion) => {
              window.history.replaceState({}, '', `/chat/${chatId}`);
              sendMessage({
                id: generateUUID(),
                role: 'user',
                parts: [{ type: 'text', text: suggestion }],
              });
            }}
            className="h-auto w-full whitespace-normal p-3 text-left"
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
