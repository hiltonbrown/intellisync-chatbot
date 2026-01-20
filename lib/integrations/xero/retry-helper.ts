import "server-only";

import { TokenError } from "@/lib/integrations/errors";
import { TokenService } from "@/lib/integrations/token-service";

/**
 * Executes a Xero API operation with automatic retry on 401 unauthorized errors.
 * If a 401 occurs, forces a token refresh and retries once.
 *
 * @param tenantBindingId - The tenant binding ID
 * @param orgId - The Clerk organization ID that owns the tenant binding
 * @param operation - The operation to execute with the API client
 * @returns The result of the operation
 */
export async function withTokenRefreshRetry<T>(
	tenantBindingId: string,
	orgId: string,
	operation: (
		client: Awaited<ReturnType<typeof TokenService.getClientForTenantBinding>>,
	) => Promise<T>,
): Promise<T> {
	try {
		// First attempt with normal token check
		console.log(
			`[Retry Helper] First attempt for binding ${tenantBindingId.substring(0, 8)}...`,
		);
		const client = await TokenService.getClientForTenantBinding(
			tenantBindingId,
			orgId,
			false,
		);
		return await operation(client);
	} catch (error) {
		// Don't retry on insufficient_scope errors - token refresh won't help
		if (error instanceof TokenError && error.code === "INSUFFICIENT_SCOPE") {
			console.log(
				`[Retry Helper] Insufficient scope error - re-authorization required, not retrying`,
			);
			throw error;
		}

		// If we get a 401 unauthorized error, force refresh and retry once
		if (
			error instanceof TokenError &&
			error.code === "API_UNAUTHORIZED" &&
			error.statusCode === 401
		) {
			console.log(
				`[Retry Helper] Got 401 from Xero API for binding ${tenantBindingId.substring(0, 8)}...`,
			);
			console.log("[Retry Helper] Forcing token refresh and retrying...", {
				errorCode: error.code,
				errorMessage: error.message,
				errorContext: error.context,
			});
			try {
				const client = await TokenService.getClientForTenantBinding(
					tenantBindingId,
					orgId,
					true,
				);
				console.log(
					"[Retry Helper] Retrying operation with refreshed token...",
				);
				const result = await operation(client);
				console.log("[Retry Helper] Retry succeeded!");
				return result;
			} catch (retryError) {
				// If retry also fails, throw the retry error
				console.error(
					"[Retry Helper] Retry after token refresh also failed:",
					retryError instanceof Error
						? {
								message: retryError.message,
								name: retryError.name,
								code: (retryError as any).code,
								statusCode: (retryError as any).statusCode,
								context: (retryError as any).context,
							}
						: retryError,
				);
				throw retryError;
			}
		}
		// For other errors, just throw them
		console.log(
			`[Retry Helper] Non-401 error, not retrying:`,
			error instanceof Error
				? {
						message: error.message,
						name: error.name,
					}
				: error,
		);
		throw error;
	}
}
