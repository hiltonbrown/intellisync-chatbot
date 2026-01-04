import "server-only";

import crypto from "node:crypto";

const KEY_ENV = "INTEGRATIONS_ENCRYPTION_KEY";
const IV_LENGTH = 12;

function loadKey(): Buffer {
  const rawKey = process.env[KEY_ENV];
  if (!rawKey) {
    throw new Error(`${KEY_ENV} is not set`);
  }

  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} must be 32 bytes base64-encoded`);
  }

  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = loadKey();
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buffer.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
