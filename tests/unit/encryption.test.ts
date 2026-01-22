import assert from "node:assert";
import { test } from "node:test";
import {
	decryptToken,
	encryptToken,
	getTokenVersion,
	reEncryptToken,
} from "../../lib/utils/encryption";

// Mock process.env with current key (v1)
process.env.TOKEN_ENC_KEY_HEX =
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("encryption/decryption roundtrip", () => {
	const original = "my-secret-token";
	const encrypted = encryptToken(original);

	assert.notStrictEqual(encrypted, original);
	assert.ok(encrypted.includes(":")); // Versioned format: v1:IV:Tag:Content
	assert.ok(encrypted.startsWith("v1:")); // Check version prefix

	const decrypted = decryptToken(encrypted);
	assert.strictEqual(decrypted, original);
});

test("encryption produces different outputs for same input", () => {
	const original = "same-token";
	const enc1 = encryptToken(original);
	const enc2 = encryptToken(original);

	assert.notStrictEqual(enc1, enc2); // Due to random IV
	assert.strictEqual(decryptToken(enc1), original);
	assert.strictEqual(decryptToken(enc2), original);
});

test("backward compatibility with legacy format (no version prefix)", () => {
	// Simulate a legacy encrypted token (format: iv:authTag:content)
	const original = "legacy-token";
	const encrypted = encryptToken(original);

	// Remove version prefix to simulate legacy format
	const legacyFormat = encrypted.substring(3); // Remove 'v1:' prefix

	// Should still decrypt correctly
	const decrypted = decryptToken(legacyFormat);
	assert.strictEqual(decrypted, original);

	// Verify it's detected as version 1
	assert.strictEqual(getTokenVersion(legacyFormat), 1);
});

test("getTokenVersion correctly identifies token versions", () => {
	const token = encryptToken("test");

	assert.strictEqual(getTokenVersion(token), 1);

	// Test legacy format (no version)
	const legacyToken = token.substring(3); // Remove 'v1:' prefix
	assert.strictEqual(getTokenVersion(legacyToken), 1);
});

test("reEncryptToken migrates to current version", () => {
	const original = "migration-test-token";

	// Create a token
	const encrypted = encryptToken(original);
	const originalVersion = getTokenVersion(encrypted);

	// Re-encrypt it
	const reEncrypted = reEncryptToken(encrypted);

	// Should decrypt to same value
	assert.strictEqual(decryptToken(reEncrypted), original);

	// Should be current version
	assert.strictEqual(getTokenVersion(reEncrypted), 1);

	// Should be different encrypted strings (different IV)
	assert.notStrictEqual(encrypted, reEncrypted);
});
