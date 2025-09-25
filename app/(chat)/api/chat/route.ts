import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  type LanguageModelUsage,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth } from '@clerk/nextjs/server';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  createUser,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { updateChatLastContextById } from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createToolRegistry } from '@/lib/ai/tools/registry';
import { createUserProvider, myProvider } from '@/lib/ai/providers';
import { getEntitlements, type UserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import { getStreamContext } from '@/lib/ai/stream-context';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage, ClerkSession, UsageWithCost } from '@/lib/types';
import { OpenRouterKeyService } from '@/lib/services/openrouter-keys';
import { isProductionEnvironment, isTestEnvironment } from '@/lib/constants';

export const maxDuration = 60;

type UserRecord = Awaited<ReturnType<typeof getUserById>> extends Array<
  infer Item
>
  ? Item
  : never;

export async function POST(request: Request) {
  console.log('Chat API: Received POST request');
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
    console.log('Chat API: Parsed request body successfully');
  } catch (error) {
    console.log('Chat API: Failed to parse request body', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    } = requestBody;

    console.log(
      'Chat API: Extracted request data - id:',
      id,
      'model:',
      selectedChatModel,
    );

    type RequestMessagePart = PostRequestBody['message']['parts'][number];

    const isTextPart = (
      part: RequestMessagePart,
    ): part is Extract<RequestMessagePart, { type: 'text'; text: string }> => {
      return part.type === 'text' && 'text' in part && typeof part.text === 'string';
    };

    const messageContainsText = (message.parts ?? []).some((part) => {
      return isTextPart(part) && part.text.trim().length > 0;
    });

    if (!messageContainsText) {
      return new ChatSDKError(
        'bad_request:chat',
        'Please include some text with your message before sending.',
      ).toResponse();
    }

    const { userId } = await auth();
    console.log('Chat API: Auth result - userId:', userId);

    if (!userId) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const finalUserId = userId;

    let databaseAvailable = true;

    const handleDatabaseError = (error: unknown, context: string) => {
      if (!databaseAvailable) {
        return;
      }

      databaseAvailable = false;

      if (error instanceof ChatSDKError && error.surface === 'database') {
        console.warn(
          'Chat API: Database operation failed; continuing without persistence',
          {
            chatId: id,
            userId: finalUserId,
            context,
            error,
          },
        );
        return;
      }

      console.warn(
        'Chat API: Unexpected error while interacting with the database; continuing without persistence',
        {
          chatId: id,
          userId: finalUserId,
          context,
          error,
        },
      );
    };

    const runWithDatabase = async <T>(
      context: string,
      operation: () => Promise<T>,
    ): Promise<T | undefined> => {
      if (!databaseAvailable) {
        return undefined;
      }

      try {
        return await operation();
      } catch (error) {
        handleDatabaseError(error, context);
        return undefined;
      }
    };

    let userRecord: UserRecord | undefined;
    const userRows = await runWithDatabase('getUserById', () =>
      getUserById(finalUserId),
    );

    if (userRows?.length) {
      userRecord = userRows[0];
    }

    if (databaseAvailable && !userRecord) {
      console.log('Creating new user:', finalUserId);
      await runWithDatabase('createUser', () =>
        createUser(`${finalUserId}@clerk.local`, finalUserId),
      );
      const refreshedRows = await runWithDatabase('getUserById', () =>
        getUserById(finalUserId),
      );
      if (refreshedRows?.length) {
        userRecord = refreshedRows[0];
      }
    }

    const userType = (userRecord?.userType as UserType) ?? 'free';
    const entitlements = getEntitlements(userType);

    const messageCount =
      (await runWithDatabase('getMessageCountByUserId', () =>
        getMessageCountByUserId({
          id: finalUserId,
          differenceInHours: 24,
        }),
      )) ?? 0;

    if (
      databaseAvailable &&
      entitlements.maxMessagesPerDay > -1 &&
      messageCount >= entitlements.maxMessagesPerDay
    ) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const storedCreditLimit =
      userRecord?.creditLimit && userRecord.creditLimit > 0
        ? userRecord.creditLimit
        : entitlements.creditLimit;
    let existingUsageCredits = userRecord?.currentUsage ?? 0;

    let keyService: OpenRouterKeyService | null = null;
    let providerClient = myProvider;
    let creditLimit = storedCreditLimit;
    let usingSharedKey = false;

    if (databaseAvailable) {
      try {
        keyService = new OpenRouterKeyService();

        const keyDetails = await keyService.ensureUserApiKey({
          userId: finalUserId,
          userType,
          creditLimit: storedCreditLimit,
        });

        creditLimit = keyDetails.limit ?? storedCreditLimit;
        providerClient = createUserProvider(keyDetails.apiKey);
      } catch (error) {
        usingSharedKey = true;
        creditLimit = 0;
        existingUsageCredits = 0;
        console.warn('Falling back to shared OpenRouter API key', error);
      }
    } else {
      usingSharedKey = true;
      creditLimit = 0;
      existingUsageCredits = 0;
    }

    if (
      !usingSharedKey &&
      creditLimit > 0 &&
      existingUsageCredits >= creditLimit
    ) {
      return new ChatSDKError(
        'rate_limit:chat',
        'Daily credit allowance exhausted. Upgrade your plan to continue.',
      ).toResponse();
    }

    const allowedModels = entitlements.availableChatModelIds;
    const allowAllModels =
      !databaseAvailable || allowedModels.includes('*');
    if (!allowAllModels && !allowedModels.includes(selectedChatModel)) {
      return new ChatSDKError(
        'forbidden:chat',
        'This model is not available on your current subscription tier.',
      ).toResponse();
    }

    const existingChat = await runWithDatabase('getChatById', () =>
      getChatById({ id }),
    );
    const chat = existingChat ?? null;

    if (databaseAvailable) {
      if (!chat) {
        const title = await generateTitleFromUserMessage({
          message: message as ChatMessage,
        });

        await runWithDatabase('saveChat', () =>
          saveChat({
            id,
            userId: finalUserId,
            title,
            visibility: selectedVisibilityType,
          }),
        );
      } else if (chat.userId !== finalUserId) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    // Create a session-like object for compatibility with existing tools
    const session: ClerkSession = {
      userId: finalUserId,
      user: {
        id: finalUserId,
        type: userType,
        creditLimit:
          !usingSharedKey && creditLimit > 0 ? creditLimit : undefined,
        currentUsage: !usingSharedKey ? existingUsageCredits : undefined,
      },
    };

    const messagesFromDb =
      (await runWithDatabase('getMessagesByChatId', () =>
        getMessagesByChatId({ id }),
      )) ?? [];
    const uiMessages = [
      ...convertToUIMessages(messagesFromDb),
      message as ChatMessage,
    ];
    const languageModel = providerClient.languageModel(selectedChatModel);
    const effectiveCreditLimit = creditLimit > 0 ? creditLimit : undefined;

    let finalUsage: UsageWithCost | undefined;
    let usageCostCredits = 0;
    let usageCostUSD: number | undefined;
    let usagePromptTokens: number | undefined;
    let usageCompletionTokens: number | undefined;
    let usageTotalTokens: number | undefined;
    let usageCachedTokens: number | undefined;
    let usageReasoningTokens: number | undefined;

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude: (longitude || 153.4307).toString(), // Default to Gold Coast, Australia coordinates if geolocation unavailable
      latitude: (latitude || -28.0167).toString(),
      city: city || 'Gold Coast',
      country: country || 'Australia',
    };

    await runWithDatabase('saveMessages:user', () =>
      saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: 'user',
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      }),
    );

    let streamId: string | null = null;

    if (databaseAvailable) {
      const generatedStreamId = generateUUID();
      await runWithDatabase('createStreamId', () =>
        createStreamId({ streamId: generatedStreamId, chatId: id }),
      );

      if (databaseAvailable) {
        streamId = generatedStreamId;
      } else {
        console.warn(
          'Chat API: Unable to persist stream metadata – disabling resumable stream for this request',
          {
            chatId: id,
          },
        );
      }
    }

    if (!streamId && !databaseAvailable) {
      console.warn(
        'Chat API: Resumable streaming disabled because the database is unavailable',
        {
          chatId: id,
        },
      );
    }

    const providerOptions = isTestEnvironment
      ? undefined
      : {
          openai: {
            usage: {
              include: true,
            },
            user: `intellisync_${finalUserId}`,
          },
        };

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: languageModel,
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel.includes(':free') &&
            selectedChatModel.includes('gemma')
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                  'analyzeEmailFraud',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: createToolRegistry({
            session,
            dataStream,
            chatId: id,
            selectedModel: selectedChatModel,
            providerClient,
          }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
          providerOptions,
          onFinish: ({ usage }) => {
            const metrics = extractUsageMetrics(usage);

            usagePromptTokens = metrics.promptTokens;
            usageCompletionTokens = metrics.completionTokens;
            usageTotalTokens = metrics.totalTokens;
            usageCachedTokens = metrics.cachedTokens;
            usageReasoningTokens = metrics.reasoningTokens;
            usageCostUSD = metrics.costUSD;

            usageCostCredits = metrics.costUSD
              ? Math.max(0, Math.ceil(metrics.costUSD * 100))
              : 0;

            const predictedTotalCredits =
              existingUsageCredits + usageCostCredits;

            finalUsage = {
              ...(usage as UsageWithCost),
              provider: 'openrouter',
              cost: metrics.costUSD,
              promptTokens: metrics.promptTokens,
              completionTokens: metrics.completionTokens,
              totalTokens: metrics.totalTokens,
              cachedTokens: metrics.cachedTokens,
              reasoningTokens: metrics.reasoningTokens,
              currency: 'USD',
              creditLimit: effectiveCreditLimit,
              currentUsage: usingSharedKey ? undefined : predictedTotalCredits,
              remainingCredits:
                effectiveCreditLimit !== undefined
                  ? Math.max(effectiveCreditLimit - predictedTotalCredits, 0)
                  : undefined,
            };

            dataStream.write({ type: 'data-usage', data: finalUsage });
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await runWithDatabase('saveMessages:onFinish', () =>
          saveMessages({
            messages: messages.map((message) => ({
              id: message.id,
              role: message.role,
              parts: message.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          }),
        );

        if (finalUsage) {
          const usageForPersistence = finalUsage;
          try {
            if (keyService && !usingSharedKey) {
              const latestUsageTotal = await runWithDatabase('recordUsage', () =>
                keyService.recordUsage({
                  userId: finalUserId,
                  cost: usageCostCredits,
                  chatId: id,
                  modelId: selectedChatModel,
                  promptTokens: usagePromptTokens,
                  completionTokens: usageCompletionTokens,
                  totalTokens: usageTotalTokens,
                  cachedTokens: usageCachedTokens,
                  reasoningTokens: usageReasoningTokens,
                }),
              );

              if (typeof latestUsageTotal === 'number') {
                usageForPersistence.currentUsage = latestUsageTotal;
                usageForPersistence.remainingCredits =
                  creditLimit > 0
                    ? Math.max(creditLimit - latestUsageTotal, 0)
                    : undefined;
              }
            }

            await runWithDatabase('updateChatLastContextById', () =>
              updateChatLastContextById({
                chatId: id,
                context: usageForPersistence,
              }),
            );
          } catch (err) {
            console.warn('Unable to persist last usage for chat', id, err);
          }
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = streamId ? getStreamContext() : null;

    if (streamContext && streamId) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    console.error('Error name:', (error as any)?.name);
    console.error('Error message:', (error as any)?.message);
    console.error('Error stack:', (error as any)?.stack);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    console.log('Chat DELETE: No authenticated user, denying access');
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== userId) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}

type UsageMetrics = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  costUSD?: number;
};

function extractUsageMetrics(
  usage: LanguageModelUsage | undefined,
): UsageMetrics {
  if (!usage) {
    return {};
  }

  const usageAny = usage as any;
  const providerUsage =
    usageAny?.openai?.usage ?? usageAny?.usage ?? usageAny?.openrouter ?? {};

  const promptTokensRaw =
    providerUsage.prompt_tokens ??
    providerUsage.promptTokens ??
    usage.inputTokens;
  const completionTokensRaw =
    providerUsage.completion_tokens ??
    providerUsage.completionTokens ??
    usage.outputTokens;
  const totalTokensRaw =
    providerUsage.total_tokens ??
    providerUsage.totalTokens ??
    usage.totalTokens ??
    (typeof promptTokensRaw === 'number' &&
    typeof completionTokensRaw === 'number'
      ? promptTokensRaw + completionTokensRaw
      : undefined);

  const cachedTokensRaw =
    providerUsage.prompt_tokens_details?.cached_tokens ??
    providerUsage.cached_tokens ??
    providerUsage.cachedTokens;

  const reasoningTokensRaw =
    providerUsage.completion_tokens_details?.reasoning_tokens ??
    providerUsage.reasoning_tokens ??
    providerUsage.reasoningTokens;

  let costUSD: number | undefined =
    providerUsage.cost ?? providerUsage.total_cost;

  if (costUSD === undefined && providerUsage.total_cost_usd !== undefined) {
    costUSD = providerUsage.total_cost_usd;
  }

  if (
    costUSD === undefined &&
    providerUsage.total_cost_usd_cents !== undefined &&
    Number.isFinite(providerUsage.total_cost_usd_cents)
  ) {
    costUSD = providerUsage.total_cost_usd_cents / 100;
  }

  return {
    promptTokens:
      typeof promptTokensRaw === 'number' ? promptTokensRaw : undefined,
    completionTokens:
      typeof completionTokensRaw === 'number' ? completionTokensRaw : undefined,
    totalTokens:
      typeof totalTokensRaw === 'number' ? totalTokensRaw : undefined,
    cachedTokens:
      typeof cachedTokensRaw === 'number' ? cachedTokensRaw : undefined,
    reasoningTokens:
      typeof reasoningTokensRaw === 'number' ? reasoningTokensRaw : undefined,
    costUSD: typeof costUSD === 'number' ? costUSD : undefined,
  };
}
