import "server-only";

export interface RateLimitInfo {
	minuteRemaining?: number;
	dayRemaining?: number;
	retryAfter?: number;
	problem?: "minute" | "day";
	resetAt?: Date;
}

export function extractRateLimits(responseHeaders: Headers): RateLimitInfo {
	const info: RateLimitInfo = {};

	const minuteRemaining = responseHeaders.get("X-MinLimit-Remaining");
	const dayRemaining = responseHeaders.get("X-DayLimit-Remaining");
	const problem = responseHeaders.get("X-Rate-Limit-Problem");
	const retryAfter = responseHeaders.get("Retry-After");

	if (minuteRemaining) {
		info.minuteRemaining = Number.parseInt(minuteRemaining, 10);
	}
	if (dayRemaining) {
		info.dayRemaining = Number.parseInt(dayRemaining, 10);
	}
	if (problem) {
		info.problem = problem as "minute" | "day";
	}
	if (retryAfter) {
		const seconds = Number.parseInt(retryAfter, 10);
		info.retryAfter = seconds;
		info.resetAt = new Date(Date.now() + seconds * 1000);
	}

	return info;
}

/**
 * Log rate limits for observability.
 * Ideally this would persist to DB/Redis for coordinated throttling.
 */
export function logRateLimits(tenantId: string, info: RateLimitInfo) {
	if (info.minuteRemaining !== undefined && info.minuteRemaining < 10) {
		console.warn(
			`[RateLimiter] Tenant ${tenantId} approaching MINUTE limit: ${info.minuteRemaining} remaining`,
		);
	}
	if (info.dayRemaining !== undefined && info.dayRemaining < 100) {
		console.warn(
			`[RateLimiter] Tenant ${tenantId} approaching DAY limit: ${info.dayRemaining} remaining`,
		);
	}
}
