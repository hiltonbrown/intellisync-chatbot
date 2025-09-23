'use client';

import type { UIMessage } from 'ai';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
  useMemo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import {
  ArrowUpIcon,
  PaperclipIcon,
  CpuIcon,
  StopIcon,
  ChevronDownIcon,
} from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { SuggestedActions } from './suggested-actions';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from './elements/prompt-input';
import { SelectItem } from '@/components/ui/select';
import * as SelectPrimitive from '@radix-ui/react-select';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage, UsageWithCost } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/types';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { startTransition } from 'react';
import { getContextWindow, normalizeUsage } from 'tokenlens';
import { Context } from './elements/context';
import { myProvider } from '@/lib/ai/providers';
import { generateUUID } from '@/lib/utils';
import { ToolMenu } from './tool-menu';
import { toolDefinitions } from '@/lib/ai/tools/definitions';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  usage,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: UsageWithCost;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (textareaRef.current && !isHydrated) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
      setIsHydrated(true);
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  }, [adjustHeight, localStorageInput, setInput, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      setLocalStorageInput(input);
    }
  }, [input, setLocalStorageInput, isHydrated]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [isToolLoading, setIsToolLoading] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);

  const toolLabelMap = useMemo(
    () => new Map(toolDefinitions.map((definition) => [definition.name, definition.label])),
    [],
  );

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    sendMessage({
      id: generateUUID(),
      role: 'user',
      parts: [
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: 'text',
          text: input,
        },
      ],
    });

    setAttachments([]);
    setInput('');
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    resetHeight,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  }, []);

  const modelResolver = useMemo(() => {
    return myProvider.languageModel(selectedModelId);
  }, [selectedModelId]);

  const contextMax = useMemo(() => {
    // Resolve from selected model; stable across chunks.
    const cw = getContextWindow(modelResolver.modelId);
    return cw.combinedMax ?? cw.inputMax ?? 0;
  }, [modelResolver]);

  const usedTokens = useMemo(() => {
    // Prefer explicit usage data part captured via onData
    if (!usage) return 0; // update only when final usage arrives
    const n = normalizeUsage(usage);
    return typeof n.total === 'number'
      ? n.total
      : (n.input ?? 0) + (n.output ?? 0);
  }, [usage]);

  const contextProps = useMemo(
    () => ({
      maxTokens: contextMax,
      usedTokens,
      usage,
      modelId: modelResolver.modelId,
    }),
    [contextMax, usedTokens, usage, modelResolver],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile],
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  const handleToolInvoke = useCallback(
    async (toolName: string, input: Record<string, unknown>) => {
      if (status !== 'ready') {
        const message =
          'Please wait for the current response to finish before launching a tool.';
        setToolError(message);
        toast.error(message);
        throw new Error(message);
      }

      const toolLabel = toolLabelMap.get(toolName) ?? toolName;
      const toolCallId = generateUUID();

      try {
        setActiveToolName(toolName);
        setIsToolLoading(true);
        setToolError(null);

        window.history.replaceState({}, '', `/chat/${chatId}`);

        await sendMessage({
          id: generateUUID(),
          role: 'user',
          parts: [
            {
              type: `tool-${toolName}` as const,
              toolCallId,
              state: 'input-available' as const,
              input,
            },
          ],
        });

        toast.success(`${toolLabel} request sent`);
        setToolError(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to launch ${toolLabel}.`;
        setToolError(message);
        throw new Error(message);
      } finally {
        setIsToolLoading(false);
        setActiveToolName(null);
      }
    },
    [chatId, sendMessage, status, toolLabelMap],
  );

  const isReasoningModel = selectedModelId === 'mistralai/mistral-large-latest';

  return (
    <div className="relative flex w-full flex-col gap-4">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="-top-12 -translate-x-1/2 absolute left-1/2 z-50"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

      <input
        type="file"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <PromptInput
        className="relative mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-sm transition-all focus-within:border-primary"
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== 'ready') {
            toast.error('Please wait for the model to finish its response!');
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            data-testid="attachments-preview"
            className="flex flex-row items-end gap-2 overflow-x-scroll"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.url}
                attachment={attachment}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url),
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{
                  url: '',
                  name: filename,
                  contentType: '',
                }}
                isUploading={true}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 px-3 pb-3">
          <div className="flex items-center justify-between pt-3">
            <ModelSelectorCompact
              selectedModelId={selectedModelId}
              onModelChange={onModelChange}
            />
            <ToolMenu
              disabled={status !== 'ready' || isReasoningModel}
              isLoading={isToolLoading}
              activeTool={activeToolName}
              lastError={toolError}
              onInvoke={handleToolInvoke}
              onResetError={() => setToolError(null)}
            />
          </div>
          <div className="flex items-end gap-2">
            <PromptInputTextarea
              data-testid="multimodal-input"
              ref={textareaRef}
              placeholder="Send a message..."
              value={input}
              onChange={handleInput}
              minHeight={44}
              maxHeight={200}
              disableAutoResize={true}
              className="flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-none"
              rows={1}
              autoFocus
            />
            <Context {...contextProps} />
          </div>
        </div>
        <PromptInputToolbar className="flex items-center justify-between border-t px-3 py-2">
          <PromptInputTools className="flex items-center gap-1">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              status={status}
              selectedModelId={selectedModelId}
            />
          </PromptInputTools>

          {status === 'submitted' ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <PromptInputSubmit
              status={status}
              disabled={!input.trim() || uploadQueue.length > 0}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground"
            >
              <ArrowUpIcon size={16} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
    if (prevProps.onModelChange !== nextProps.onModelChange) return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>['status'];
  selectedModelId: string;
}) {
  const isReasoningModel = selectedModelId === 'mistralai/mistral-large-latest';

  return (
    <Button
      data-testid="attachments-button"
      className="flex h-8 w-8 items-center justify-center rounded-lg p-1 transition-colors hover:bg-accent"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready' || isReasoningModel}
      variant="ghost"
    >
      <PaperclipIcon size={16} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);

  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => setChatModels(data.models));
  }, []);

  // Sync optimisticModelId with external selectedModelId prop changes
  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId,
  );

  return (
    <PromptInputModelSelect
      value={selectedModel?.name}
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
    >
      <SelectPrimitive.Trigger
        type="button"
        className="flex h-8 items-center gap-2 rounded-lg bg-background px-2 font-medium text-foreground text-xs transition-colors hover:bg-accent focus:outline-none"
      >
        <CpuIcon size={14} />
        <span className="hidden sm:block">{selectedModel?.name}</span>
        <ChevronDownIcon size={14} />
      </SelectPrimitive.Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem
              key={model.id}
              value={model.name}
              className="px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="truncate font-medium text-xs">{model.name}</div>
                <div className="truncate text-[10px] text-muted-foreground leading-tight">
                  {model.description}
                </div>
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(
  PureModelSelectorCompact,
  (prevProps, nextProps) => {
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
    if (prevProps.onModelChange !== nextProps.onModelChange) return false;
    return true;
  },
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground transition-colors hover:bg-muted/80"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={16} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
