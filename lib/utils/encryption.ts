import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encryption Key Versioning System
// Supports key rotation by maintaining multiple encryption keys with version identifiers
// Format: v{version}:iv:authTag:encrypted (e.g., v1:abc123:def456:ghijkl)
// Legacy format (no version prefix): iv:authTag:encrypted

const CURRENT_KEY_VERSION = 1;
const GCM_IV_LENGTH = 12; // GCM standard IV size in bytes
const AES_256_KEY_LENGTH = 32; // AES-256 requires 32-byte key

interface KeyConfig {
	version: number;
	keyBuffer: Buffer;
}

function getKeyConfig(version?: number): KeyConfig {
	const targetVersion = version ?? CURRENT_KEY_VERSION;

	// For v1, use TOKEN_ENC_KEY_HEX (current key)
	// For older versions, check TOKEN_ENC_KEY_V{N}_HEX (e.g., TOKEN_ENC_KEY_V0_HEX)
	const envVarName =
		targetVersion === 1
			? "TOKEN_ENC_KEY_HEX"
			: `TOKEN_ENC_KEY_V${targetVersion}_HEX`;

	const KEY_HEX = process.env[envVarName] || "";
	if (!KEY_HEX) {
		throw new Error(`${envVarName} is not defined`);
	}

	// Decode hex string to buffer
	const keyBuffer = Buffer.from(KEY_HEX, "hex");

	if (keyBuffer.length < AES_256_KEY_LENGTH) {
		throw new Error(
			`${envVarName} must be at least ${AES_256_KEY_LENGTH} bytes (${AES_256_KEY_LENGTH * 2} hex chars)`,
		);
	}

	// Use first 32 bytes for AES-256
	return {
		version: targetVersion,
		keyBuffer: keyBuffer.subarray(0, AES_256_KEY_LENGTH),
	};
}

// Legacy function for backward compatibility
function getKey(): Buffer {
	return getKeyConfig(CURRENT_KEY_VERSION).keyBuffer;
}

export function encryptToken(text: string): string {
	const { version, keyBuffer } = getKeyConfig(CURRENT_KEY_VERSION);
	const iv = randomBytes(GCM_IV_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	const authTag = cipher.getAuthTag().toString("hex");

	// Format: v{version}:iv:authTag:encrypted
	return `v${version}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(encryptedText: string): string {
	const parts = encryptedText.split(":");

	// Detect format: versioned (v1:iv:authTag:encrypted) or legacy (iv:authTag:encrypted)
	let version: number;
	let ivHex: string;
	let authTagHex: string;
	let contentHex: string;

	if (parts.length === 4 && parts[0].startsWith("v")) {
		// Versioned format: v{N}:iv:authTag:encrypted
		const versionStr = parts[0].substring(1); // Remove 'v' prefix
		version = Number.parseInt(versionStr, 10);
		if (Number.isNaN(version)) {
			throw new Error("Invalid encryption version format");
		}
		[, ivHex, authTagHex, contentHex] = parts;
	} else if (parts.length === 3) {
		// Legacy format (no version): iv:authTag:encrypted
		// Assume this was encrypted with the original key (before versioning)
		// For backward compatibility, treat as version 1
		version = 1;
		[ivHex, authTagHex, contentHex] = parts;
	} else {
		throw new Error("Invalid encrypted token format");
	}

	// Get the appropriate key for this version
	const { keyBuffer } = getKeyConfig(version);

	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);

	decipher.setAuthTag(authTag);
	let decrypted = decipher.update(contentHex, "hex", "utf8");
	decrypted += decipher.final("utf8");

	return decrypted;
}

/**
 * Re-encrypts a token with the current key version
 * Use this during key rotation to migrate tokens to the latest encryption key
 *
 * @param encryptedText - The encrypted token to re-encrypt
 * @returns The token encrypted with the current key version
 *
 * @example
 * // During key rotation migration
 * const oldToken = grant.accessTokenEnc;
 * const newToken = reEncryptToken(oldToken);
 * await updateGrant(grantId, { accessTokenEnc: newToken });
 */
export function reEncryptToken(encryptedText: string): string {
	// Decrypt with old key
	const plaintext = decryptToken(encryptedText);
	// Re-encrypt with current key
	return encryptToken(plaintext);
}

/**
 * Gets the version of an encrypted token without decrypting it
 * Useful for identifying tokens that need re-encryption
 *
 * @param encryptedText - The encrypted token to check
 * @returns The version number, or 1 for legacy tokens
 */
export function getTokenVersion(encryptedText: string): number {
	const parts = encryptedText.split(":");

	if (parts.length === 4 && parts[0].startsWith("v")) {
		const versionStr = parts[0].substring(1);
		const version = Number.parseInt(versionStr, 10);
		return Number.isNaN(version) ? 1 : version;
	}

	// Legacy format (no version prefix)
	return 1;
}
