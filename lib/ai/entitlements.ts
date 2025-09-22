import type { ChatModel } from './models';
import { DEFAULT_CHAT_MODEL } from './models';

export type UserType = 'free' | 'pro' | 'enterprise';

export interface Entitlements {
  maxMessagesPerDay: number;
  creditLimit: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  free: {
    maxMessagesPerDay: 50,
    creditLimit: 100,
    availableChatModelIds: [
      DEFAULT_CHAT_MODEL,
      'meta-llama/llama-3.3-8b-instruct:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'deepseek/deepseek-chat-v3.1:free',
    ],
  },
  pro: {
    maxMessagesPerDay: 500,
    creditLimit: 5000,
    availableChatModelIds: [
      'openai/gpt-4o-mini',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-r1-distill-llama-70b:free',
      'qwen/qwen3-next-80b-a3b-instruct',
      DEFAULT_CHAT_MODEL,
      'meta-llama/llama-3.3-8b-instruct:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'deepseek/deepseek-chat-v3.1:free',
    ],
  },
  enterprise: {
    maxMessagesPerDay: -1,
    creditLimit: 50000,
    availableChatModelIds: ['*'],
  },
};

export const getEntitlements = (userType: UserType): Entitlements => {
  return entitlementsByUserType[userType] ?? entitlementsByUserType.free;
};
