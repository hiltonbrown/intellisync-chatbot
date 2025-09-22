import { NextResponse } from 'next/server';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'standardwebhooks';

import { handleClerkWebhook } from '@/lib/services/clerk-webhook-handler';

const MISSING_SECRET_MESSAGE =
  'CLERK_WEBHOOK_SECRET is not configured; skipping signature verification.';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

async function verifyRequest(request: Request): Promise<{ event: WebhookEvent; success: boolean }> {
  const payload = await request.text();

  if (!webhookSecret) {
    console.warn(MISSING_SECRET_MESSAGE);
    return { event: JSON.parse(payload) as WebhookEvent, success: false };
  }

  const signature =
    request.headers.get('webhook-signature') ??
    request.headers.get('svix-signature') ??
    undefined;

  if (!signature) {
    throw new Error('Webhook signature header missing.');
  }

  const webhook = new Webhook(webhookSecret);
  const event = webhook.verify(payload, signature) as WebhookEvent;
  return { event, success: true };
}

export async function POST(request: Request) {
  try {
    const { event, success: verified } = await verifyRequest(request);

    if (!event) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    if (!verified) {
      console.warn('Processing Clerk webhook without signature verification. Enable CLERK_WEBHOOK_SECRET for production.');
    }

    await handleClerkWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Failed to process Clerk webhook', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 });
  }
}
