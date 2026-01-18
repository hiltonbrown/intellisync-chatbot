import { test } from 'node:test';
import assert from 'node:assert';
import { encryptToken, decryptToken } from '../../lib/utils/encryption';

// Mock process.env
process.env.TOKEN_ENC_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

test('encryption/decryption roundtrip', () => {
  const original = 'my-secret-token';
  const encrypted = encryptToken(original);

  assert.notStrictEqual(encrypted, original);
  assert.ok(encrypted.includes(':')); // IV:Tag:Content

  const decrypted = decryptToken(encrypted);
  assert.strictEqual(decrypted, original);
});

test('encryption produces different outputs for same input', () => {
    const original = 'same-token';
    const enc1 = encryptToken(original);
    const enc2 = encryptToken(original);

    assert.notStrictEqual(enc1, enc2); // Due to random IV
    assert.strictEqual(decryptToken(enc1), original);
    assert.strictEqual(decryptToken(enc2), original);
});
