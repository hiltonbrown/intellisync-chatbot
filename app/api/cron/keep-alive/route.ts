import "server-only";

import { db } from "@/lib/db";
import { integrationGrants } from "@/lib/db/schema";
import { TokenService } from "@/lib/integrations/token-service";
import { and, eq, lt } from "drizzle-orm";
import { addMinutes } from "date-fns";

export const dynamic = 'force-dynamic';

const KEEP_ALIVE_THRESHOLD_MINUTES = 10;

export async function GET(req: Request) {
    // 1. Find active grants expiring in the next 10 minutes
    const threshold = addMinutes(new Date(), KEEP_ALIVE_THRESHOLD_MINUTES);

    const grants = await db
        .select()
        .from(integrationGrants)
        .where(
            and(
                eq(integrationGrants.status, "active"),
                lt(integrationGrants.expiresAt, threshold)
            )
        );

    console.log(`Keep-Alive: Found ${grants.length} grants expiring soon.`);

    const results = {
        success: 0,
        failed: 0
    };

    // 2. Refresh each one in parallel (allSettled)
    const refreshPromises = grants.map(grant => TokenService.refreshGrantSingleFlight(grant.id));
    const outcomes = await Promise.allSettled(refreshPromises);

    for (const outcome of outcomes) {
        if (outcome.status === 'fulfilled') {
            results.success++;
        } else {
            console.error(`Keep-Alive: Failed to refresh grant`, outcome.reason);
            results.failed++;
        }
    }

    return Response.json({
        message: "Keep-alive job completed",
        stats: results
    });
}
