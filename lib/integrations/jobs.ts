import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { integrationSyncJobs } from "@/lib/db/schema";
import { markJobStatus } from "@/lib/integrations/queue";
import type { SyncEntityType } from "@/lib/integrations/types";
import { syncContact, syncInvoice, syncPayment } from "./xero/sync";

const handlers: Record<SyncEntityType, (input: {
  tenantId: string;
  resourceId: string;
}) => Promise<void>> = {
  invoice: syncInvoice,
  contact: syncContact,
  payment: syncPayment,
};

export async function processPendingSyncJobs(limit = 10) {
  const jobs = await db
    .select()
    .from(integrationSyncJobs)
    .where(eq(integrationSyncJobs.status, "pending"))
    .limit(limit);

  for (const job of jobs) {
    await markJobStatus({ id: job.id, status: "processing" });

    try {
      const handler = handlers[job.entityType as SyncEntityType];
      if (job.provider === "xero" && handler) {
        await handler({ tenantId: job.tenantId, resourceId: job.resourceId });
      }

      await markJobStatus({ id: job.id, status: "completed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markJobStatus({ id: job.id, status: "failed", error: message });
    }
  }
}
