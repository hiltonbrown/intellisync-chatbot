import "server-only";

import crypto from "node:crypto";
import { z } from "zod";
import type { XeroWebhookPayload } from "./types";

const signatureSchema = z.object({
  events: z.array(
    z.object({
      tenantId: z.string(),
      eventCategory: z.string(),
      eventType: z.string(),
      resourceId: z.string(),
      eventDateUtc: z.string(),
    })
  ),
});

const WEBHOOK_SECRET_ENV = "XERO_WEBHOOK_SECRET";

function getWebhookSecret(): string {
  const secret = process.env[WEBHOOK_SECRET_ENV];
  if (!secret) {
    throw new Error(`${WEBHOOK_SECRET_ENV} is not set`);
  }
  return secret;
}

export function verifyXeroWebhookSignature({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: string | null;
}): boolean {
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", getWebhookSecret())
    .update(rawBody, "utf8")
    .digest("base64");

  const signatureBuffer = Buffer.from(signature, "base64");
  const expectedBuffer = Buffer.from(expected, "base64");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function parseXeroWebhookPayload(
  rawBody: string
): XeroWebhookPayload {
  const json = JSON.parse(rawBody) as unknown;
  return signatureSchema.parse(json);
}
