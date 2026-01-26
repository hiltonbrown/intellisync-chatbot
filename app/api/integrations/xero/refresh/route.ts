import { auth } from "@clerk/nextjs/server";
import { TokenService } from "@/lib/integrations/token-service";

/**
 * Proactive token refresh endpoint.
 * Called by the frontend on page loads to ensure Xero tokens are fresh.
 *
 * This endpoint:
 * 1. Checks all active Xero connections for the current org
 * 2. Proactively refreshes tokens that are near expiry
 * 3. Returns connection status and any errors
 *
 * Safe to call frequently - has built-in throttling and caching.
 */
export async function POST() {
	try {
		const { orgId } = await auth();

		// No org context means user isn't in an organization
		// This is fine - just return no bindings
		if (!orgId) {
			return Response.json({
				success: true,
				hasActiveBindings: false,
				refreshedCount: 0,
				errors: [],
				message: "No organization context",
			});
		}

		// Perform proactive refresh
		const result = await TokenService.proactiveRefreshForOrg(orgId);

		return Response.json({
			...result,
			message: result.success
				? "Token refresh check completed successfully"
				: "Token refresh completed with some errors",
		});
	} catch (error) {
		console.error("[Xero Refresh API] Unexpected error:", error);

		return Response.json(
			{
				success: false,
				hasActiveBindings: false,
				refreshedCount: 0,
				errors: [
					{
						bindingId: "unknown",
						error: error instanceof Error ? error.message : "Unknown error",
					},
				],
				message: "Failed to refresh tokens",
			},
			{ status: 500 },
		);
	}
}
