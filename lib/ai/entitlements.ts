export type UserType = 'guest' | 'regular';

import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
    * For users without an account
    */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: ['google/gemini-flash-1.5', 'meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-large-latest'],
  },

  /*
    * For users with an account
    */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: ['google/gemini-flash-1.5', 'meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-large-latest'],
  },

  /*
    * TODO: For users with an account and a paid membership
    */
};
