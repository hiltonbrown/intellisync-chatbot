'use client';

import { useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from '@/components/data-stream-provider';

export interface UseAutoResumeParams {
  autoResume: boolean;
  initialMessages: ChatMessage[];
  resumeStream: UseChatHelpers<ChatMessage>['resumeStream'];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}

export function useAutoResume({
  autoResume,
  initialMessages,
  resumeStream,
  setMessages,
}: UseAutoResumeParams) {
  const { dataStream } = useDataStream();
  const lastProcessedIndexRef = useRef(-1);

  useEffect(() => {
    if (!autoResume) return;

    const mostRecentMessage = initialMessages.at(-1);

    if (mostRecentMessage?.role === 'user') {
      resumeStream();
    }

    // we intentionally run this once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  useEffect(() => {
    if (!dataStream || dataStream.length === 0) {
      lastProcessedIndexRef.current = -1;
      return;
    }

    const startIndex = lastProcessedIndexRef.current + 1;
    const newParts = dataStream.slice(startIndex);

    newParts.forEach((dataPart) => {
      if (dataPart.type !== 'data-appendMessage') {
        return;
      }

      if (!('data' in dataPart)) {
        return;
      }

      const rawData = (dataPart as { data?: unknown }).data;

      if (typeof rawData === 'undefined') {
        return;
      }

      const rawMessage =
        typeof rawData === 'string'
          ? safeParseChatMessage(rawData)
          : rawData;

      if (!isChatMessage(rawMessage)) {
        return;
      }

      setMessages((previousMessages) => {
        const existingIndex = previousMessages.findIndex(
          (message) => message.id === rawMessage.id,
        );

        if (existingIndex !== -1) {
          const nextMessages = [...previousMessages];
          nextMessages[existingIndex] = rawMessage;
          return nextMessages;
        }

        return [...previousMessages, rawMessage];
      });
    });

    lastProcessedIndexRef.current = dataStream.length - 1;
  }, [dataStream, setMessages]);
}

function safeParseChatMessage(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch (error) {
    console.warn('Failed to parse chat message payload from data stream', error);
    return null;
  }
}

function isChatMessage(candidate: unknown): candidate is ChatMessage {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const potentialMessage = candidate as {
    id?: unknown;
    role?: unknown;
    parts?: unknown;
  };

  return (
    typeof potentialMessage.id === 'string' &&
    typeof potentialMessage.role === 'string' &&
    Array.isArray(potentialMessage.parts)
  );
}
