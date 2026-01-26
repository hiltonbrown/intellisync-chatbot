"use client";

import { useEffect, useRef, useState } from "react";

interface TokenRefreshResult {
	success: boolean;
	hasActiveBindings: boolean;
	refreshedCount: number;
	errors: Array<{ bindingId: string; error: string }>;
	message: string;
}

interface UseXeroTokenRefreshOptions {
	/**
	 * Whether to automatically refresh on mount.
	 * @default true
	 */
	autoRefresh?: boolean;

	/**
	 * Enable periodic background refresh while user is active.
	 * Checks and refreshes tokens every 5 minutes.
	 * @default true
	 */
	enableBackgroundRefresh?: boolean;

	/**
	 * Callback when refresh completes successfully
	 */
	onSuccess?: (result: TokenRefreshResult) => void;

	/**
	 * Callback when refresh fails
	 */
	onError?: (error: Error) => void;
}

/**
 * Hook to proactively refresh Xero tokens on page load.
 *
 * This ensures tokens are always fresh before users start interacting with Xero tools.
 * Safe to call on every page load - has built-in throttling and caching.
 *
 * @example
 * ```tsx
 * function ChatPage() {
 *   const { isRefreshing, error, refresh } = useXeroTokenRefresh();
 *
 *   if (error) {
 *     console.warn('Token refresh failed:', error);
 *   }
 *
 *   return <Chat />;
 * }
 * ```
 */
export function useXeroTokenRefresh(options: UseXeroTokenRefreshOptions = {}) {
	const { autoRefresh = true, enableBackgroundRefresh = true, onSuccess, onError } = options;

	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
	const [result, setResult] = useState<TokenRefreshResult | null>(null);

	// Use ref to prevent double-refresh in strict mode
	const hasRefreshedRef = useRef(false);

	const refresh = async () => {
		// Throttle: Don't refresh if we just did (within 30 seconds)
		if (lastRefreshTime && Date.now() - lastRefreshTime < 30000) {
			console.log(
				"[useXeroTokenRefresh] Skipping refresh - last refresh was < 30s ago",
			);
			return;
		}

		setIsRefreshing(true);
		setError(null);

		try {
			console.log("[useXeroTokenRefresh] Starting proactive token refresh...");

			const response = await fetch("/api/integrations/xero/refresh", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(
					`Token refresh request failed: ${response.status} ${response.statusText}`,
				);
			}

			const data: TokenRefreshResult = await response.json();

			console.log("[useXeroTokenRefresh] Refresh complete:", {
				success: data.success,
				hasActiveBindings: data.hasActiveBindings,
				refreshedCount: data.refreshedCount,
				errorCount: data.errors.length,
			});

			setResult(data);
			setLastRefreshTime(Date.now());

			if (data.success) {
				onSuccess?.(data);
			} else if (data.errors.length > 0) {
				const error = new Error(
					`Token refresh completed with ${data.errors.length} error(s)`,
				);
				setError(error);
				onError?.(error);
			}
		} catch (err) {
			console.error("[useXeroTokenRefresh] Refresh failed:", err);
			const error =
				err instanceof Error ? err : new Error("Unknown token refresh error");
			setError(error);
			onError?.(error);
		} finally {
			setIsRefreshing(false);
		}
	};

	// Auto-refresh on mount (if enabled)
	useEffect(() => {
		if (autoRefresh && !hasRefreshedRef.current) {
			hasRefreshedRef.current = true;
			// Run in background - don't block rendering
			refresh();
		}
	}, [autoRefresh]);

	// Background refresh interval (if enabled)
	// Periodically checks and refreshes tokens while user is active
	useEffect(() => {
		if (!enableBackgroundRefresh) {
			return;
		}

		// Refresh every 5 minutes
		const BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000;

		console.log(
			"[useXeroTokenRefresh] Starting background refresh timer (5 min interval)",
		);

		const intervalId = setInterval(() => {
			console.log(
				"[useXeroTokenRefresh] Background refresh timer triggered",
			);
			refresh();
		}, BACKGROUND_REFRESH_INTERVAL);

		return () => {
			console.log("[useXeroTokenRefresh] Clearing background refresh timer");
			clearInterval(intervalId);
		};
	}, [enableBackgroundRefresh]);

	return {
		/**
		 * Whether a refresh is currently in progress
		 */
		isRefreshing,

		/**
		 * Error from last refresh attempt (if any)
		 */
		error,

		/**
		 * Result from last successful refresh
		 */
		result,

		/**
		 * Timestamp of last refresh (ms since epoch)
		 */
		lastRefreshTime,

		/**
		 * Manually trigger a token refresh
		 */
		refresh,
	};
}
