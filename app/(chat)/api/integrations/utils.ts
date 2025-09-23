import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';

import { ChatSDKError } from '@/lib/errors';

export async function requireUserId(request: NextRequest): Promise<string> {
  try {
    const session = await auth();

    if (session?.userId) {
      return session.userId;
    }
  } catch (error) {
    console.error('Failed to resolve Clerk session', error);
  }

  if (process.env.NODE_ENV !== 'production') {
    const mockUser = request.headers.get('x-test-user');

    if (mockUser) {
      return mockUser;
    }
  }

  throw new ChatSDKError('unauthorized:chat', 'Authentication required');
}
