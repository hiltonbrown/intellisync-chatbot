import { db } from "@/lib/db";
import { integrationGrants } from "@/lib/db/schema";
import { TokenService } from "@/lib/integrations/token-service";
import { and, eq, lt } from "drizzle-orm";
import { addMinutes } from "date-fns";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // 1. Find active grants expiring in the next 10 minutes
    const threshold = addMinutes(new Date(), 10);

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

    // 2. Refresh each one
    for (const grant of grants) {
        try {
            await TokenService.refreshGrantSingleFlight(grant.id);
            results.success++;
        } catch (e) {
            console.error(`Keep-Alive: Failed to refresh grant ${grant.id}`, e);
            results.failed++;
        }
    }

    return Response.json({
        message: "Keep-alive job completed",
        stats: results
    });
}
