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
    availableChatModelIds: [
      'openai/gpt-oss-120b:free',
      'meta-llama/llama-4-maverick:free',
      'google/gemma-3-27b-it:free',
    ],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      'openai/gpt-oss-120b:free',
      'meta-llama/llama-4-maverick:free',
      'google/gemma-3-27b-it:free',
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
