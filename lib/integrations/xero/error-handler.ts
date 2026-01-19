import "server-only";

import { TokenError } from "@/lib/integrations/errors";

/**
 * Standard error response for Xero integration tools
 */
export interface XeroToolErrorResponse {
	error: string;
	hint?: string;
	details?: Record<string, unknown>;
	needsReauth?: boolean;
}

/**
 * Handles errors from Xero integration tools and returns user-friendly error messages
 * with guidance on how to resolve the issue.
 *
 * @param error - The error that occurred
 * @param context - Additional context for error logging
 * @returns A formatted error response
 */
export function handleXeroToolError(
	error: unknown,
	context?: { toolName: string; operation?: string },
): XeroToolErrorResponse {
	const logContext = context
		? { tool: context.toolName, operation: context.operation }
		: undefined;

	console.error("Error in Xero tool:", {
		...logContext,
		error:
			error instanceof Error
				? {
						name: error.name,
						message: error.message,
						code: (error as any).code,
						statusCode: (error as any).statusCode,
						context: (error as any).context,
					}
				: error,
	});

	// Handle INSUFFICIENT_SCOPE - missing required OAuth permissions
	if (error instanceof TokenError && error.code === "INSUFFICIENT_SCOPE") {
		return {
			error:
				"Your Xero connection is missing required permissions. The app has been updated to request additional scopes.",
			hint: "Please visit /settings/integrations and reconnect your Xero account to grant the new permissions (accounting.reports.read). This is needed to access financial reports like P&L and Balance Sheet.",
			details: {
				missingScope: "accounting.reports.read",
				...error.context,
			},
			needsReauth: true,
		};
	}

	// Handle API_UNAUTHORIZED - token cannot be refreshed
	if (error instanceof TokenError && error.code === "API_UNAUTHORIZED") {
		return {
			error:
				"Your Xero connection needs to be re-authorized. The access token has expired and cannot be refreshed.",
			hint: "Please visit /settings/integrations to reconnect your Xero account. This usually happens when the refresh token expires (after 60 days of inactivity) or if the connection was revoked in Xero.",
			needsReauth: true,
		};
	}

	// Handle TOKEN_REFRESH_FAILED - refresh token is invalid
	if (error instanceof TokenError && error.code === "TOKEN_REFRESH_FAILED") {
		return {
			error: `Failed to refresh Xero access token: ${error.message}`,
			hint: "The refresh token may have expired or been revoked. Please reconnect your Xero account in Settings > Integrations.",
			details: error.context,
			needsReauth: true,
		};
	}

	// Handle other TokenErrors
	if (error instanceof TokenError) {
		return {
			error: `Authentication error: ${error.message}`,
			hint: "There was a problem with your Xero authentication. Please try reconnecting in Settings > Integrations.",
			details: {
				code: error.code,
				...error.context,
			},
			needsReauth: true,
		};
	}

	// Generic error fallback
	const operation = context?.operation || "operation";
	return {
		error:
			error instanceof Error
				? error.message
				: `An unknown error occurred while performing ${operation}`,
	};
}
