import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// The key provided is a 128-char hex string (64 bytes = 512 bits).
// AES-256-GCM requires a 32-byte (256-bit) key.
// We will use the first 32 bytes of the hex-decoded key.

function getKey(): Buffer {
	const KEY_HEX = process.env.TOKEN_ENC_KEY_HEX || "";
	if (!KEY_HEX) {
		throw new Error("TOKEN_ENC_KEY_HEX is not defined");
	}
	// Decode hex string to buffer
	const keyBuffer = Buffer.from(KEY_HEX, "hex");

	if (keyBuffer.length < 32) {
		throw new Error("TOKEN_ENC_KEY_HEX must be at least 32 bytes (64 hex chars)");
	}

	// Use first 32 bytes for AES-256
	return keyBuffer.subarray(0, 32);
}

export function encryptToken(text: string): string {
	const key = getKey();
	const iv = randomBytes(12); // GCM standard IV size is 12 bytes
	const cipher = createCipheriv("aes-256-gcm", key, iv);

	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	const authTag = cipher.getAuthTag().toString("hex");

	// Format: iv:authTag:encrypted
	return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(encryptedText: string): string {
	const key = getKey();
	const parts = encryptedText.split(":");
	if (parts.length !== 3) {
		throw new Error("Invalid encrypted token format");
	}

	const [ivHex, authTagHex, contentHex] = parts;
	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const decipher = createDecipheriv("aes-256-gcm", key, iv);

	decipher.setAuthTag(authTag);
	let decrypted = decipher.update(contentHex, "hex", "utf8");
	decrypted += decipher.final("utf8");

	return decrypted;
}
