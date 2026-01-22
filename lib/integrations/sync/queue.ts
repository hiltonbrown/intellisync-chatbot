import { redis } from "@/lib/redis/client";

export const QUEUE_KEY = "xero-sync-queue";

interface SyncJob {
	tenantBindingId: string;
	eventId?: string; // Optional: ID of the webhook event that triggered this
	resourceType?: string; // e.g. "Invoice"
	resourceId?: string;
}

export class SyncQueue {
	static async enqueue(job: SyncJob) {
		// Enqueue to Redis List (Right Push)
		await redis.rPush(QUEUE_KEY, JSON.stringify(job));
	}

	static async dequeue(): Promise<SyncJob | null> {
		// Dequeue from Redis List (Left Pop)
		const item = await redis.lPop(QUEUE_KEY);
		if (!item) return null;
		return JSON.parse(item);
	}
}
