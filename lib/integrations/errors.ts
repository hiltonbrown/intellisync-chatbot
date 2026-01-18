import "server-only";

/**
 * Base class for all integration-related errors
 * Provides consistent error handling across the integration layer
 */
export class IntegrationError extends Error {
	public readonly code: string;
	public readonly statusCode: number;
	public readonly isOperational: boolean;
	public readonly context?: Record<string, unknown>;

	constructor(
		message: string,
		code: string,
		statusCode = 500,
		isOperational = true,
		context?: Record<string, unknown>,
	) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		this.context = context;

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Returns a safe error message for client responses
	 * Hides sensitive details in production
	 */
	toClientResponse(): { error: string; code: string } {
		return {
			error: this.isOperational ? this.message : "An unexpected error occurred",
			code: this.code,
		};
	}
}

/**
 * OAuth and authentication errors
 */
export class AuthError extends IntegrationError {
	constructor(
		message: string,
		code = "AUTH_ERROR",
		statusCode = 401,
		context?: Record<string, unknown>,
	) {
		super(message, code, statusCode, true, context);
	}
}

/**
 * Token refresh and management errors
 */
export class TokenError extends IntegrationError {
	constructor(
		message: string,
		code = "TOKEN_ERROR",
		statusCode = 401,
		context?: Record<string, unknown>,
	) {
		super(message, code, statusCode, true, context);
	}
}

/**
 * External API errors (Xero, QuickBooks, etc.)
 */
export class ExternalAPIError extends IntegrationError {
	public readonly provider: string;
	public readonly apiStatusCode?: number;

	constructor(
		message: string,
		provider: string,
		apiStatusCode?: number,
		context?: Record<string, unknown>,
	) {
		super(
			message,
			"EXTERNAL_API_ERROR",
			apiStatusCode && apiStatusCode < 500 ? 400 : 502,
			true,
			{ ...context, provider, apiStatusCode },
		);
		this.provider = provider;
		this.apiStatusCode = apiStatusCode;
	}
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends IntegrationError {
	public readonly retryAfter?: number;

	constructor(
		message = "Rate limit exceeded",
		retryAfter?: number,
		context?: Record<string, unknown>,
	) {
		super(message, "RATE_LIMIT_ERROR", 429, true, {
			...context,
			retryAfter,
		});
		this.retryAfter = retryAfter;
	}
}

/**
 * Configuration errors
 */
export class ConfigError extends IntegrationError {
	constructor(
		message: string,
		context?: Record<string, unknown>,
	) {
		super(message, "CONFIG_ERROR", 500, false, context);
	}
}

/**
 * Sync operation errors
 */
export class SyncError extends IntegrationError {
	constructor(
		message: string,
		code = "SYNC_ERROR",
		context?: Record<string, unknown>,
	) {
		super(message, code, 500, true, context);
	}
}

/**
 * Webhook processing errors
 */
export class WebhookError extends IntegrationError {
	constructor(
		message: string,
		code = "WEBHOOK_ERROR",
		statusCode = 400,
		context?: Record<string, unknown>,
	) {
		super(message, code, statusCode, true, context);
	}
}

/**
 * Type guard to check if an error is an IntegrationError
 */
export function isIntegrationError(error: unknown): error is IntegrationError {
	return error instanceof IntegrationError;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "An unknown error occurred";
}

/**
 * Safely extract error code from unknown error
 */
export function getErrorCode(error: unknown): string {
	if (isIntegrationError(error)) {
		return error.code;
	}
	if (error instanceof Error) {
		return error.name;
	}
	return "UNKNOWN_ERROR";
}

/**
 * Log error with appropriate level based on severity
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
	if (isIntegrationError(error)) {
		const logContext = {
			...error.context,
			...context,
			code: error.code,
			statusCode: error.statusCode,
			operational: error.isOperational,
		};

		if (error.isOperational) {
			console.error(`[${error.code}] ${error.message}`, logContext);
		} else {
			// Non-operational errors are critical and need immediate attention
			console.error(
				`[CRITICAL] [${error.code}] ${error.message}`,
				logContext,
				error.stack,
			);
		}
	} else if (error instanceof Error) {
		console.error(`[UNEXPECTED] ${error.message}`, context, error.stack);
	} else {
		console.error("[UNKNOWN_ERROR]", { error, ...context });
	}
}
