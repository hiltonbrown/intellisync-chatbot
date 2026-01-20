import { SyncQueue } from "@/lib/integrations/sync/queue";
import { SyncWorker } from "@/lib/integrations/sync/worker";
import { redis } from "@/lib/redis/client";

// This endpoint mimics a worker process.
// Ideally, this is called by a recurring cron (e.g. every minute) or triggered by the webhook handler (Vercel Functions).
// To prevent overlapping runs, we can use a simple Redis lock.

export const dynamic = 'force-dynamic'; // No caching

export async function GET(req: Request) {
    // Basic locking
    const lockKey = "worker:process-queue:lock";
    const locked = await redis.set(lockKey, "locked", { NX: true, EX: 50 }); // 50 sec lock

    if (!locked) {
        return new Response("Worker already running", { status: 429 });
    }

    try {
        console.log("Worker starting...");
        let processedCount = 0;
        const maxJobsPerRun = 10; // Process a batch then exit (Lambda limits)

        while (processedCount < maxJobsPerRun) {
            const job = await SyncQueue.dequeue();
            if (!job) break;

            try {
                await SyncWorker.runTenantSyncOnce(job.tenantBindingId);
                processedCount++;
            } catch (e) {
                console.error("Job failed:", e);
                // Retry logic? Push back to queue?
            }
        }

        console.log(`Worker finished. Processed ${processedCount} jobs.`);
        return Response.json({ processed: processedCount });

    } finally {
        await redis.del(lockKey);
    }
}
