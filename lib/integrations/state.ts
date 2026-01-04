import "server-only";

import crypto from "node:crypto";

const STATE_SECRET_ENV = "INTEGRATIONS_STATE_SECRET";

export type SignedStatePayload = {
  clerkOrgId: string;
  clerkUserId: string;
  issuedAt: number;
};

function getStateSecret(): string {
  const secret = process.env[STATE_SECRET_ENV];
  if (!secret) {
    throw new Error(`${STATE_SECRET_ENV} is not set`);
  }
  return secret;
}

export function signState(payload: SignedStatePayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", getStateSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyState(state: string): SignedStatePayload | null {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", getStateSecret())
    .update(encodedPayload)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const decodedPayload = Buffer.from(encodedPayload, "base64url").toString(
    "utf8"
  );

  try {
    return JSON.parse(decodedPayload) as SignedStatePayload;
  } catch {
    return null;
  }
}
