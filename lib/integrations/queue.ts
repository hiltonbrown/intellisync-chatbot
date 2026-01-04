import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { integrationSyncJobs } from "@/lib/db/schema";
import type { IntegrationProvider, SyncEntityType } from "./types";

export type SyncJobInput = {
  provider: IntegrationProvider;
  tenantId: string;
  entityType: SyncEntityType;
  resourceId: string;
};

export async function enqueueSyncJob(input: SyncJobInput): Promise<boolean> {
  const inserted = await db
    .insert(integrationSyncJobs)
    .values({
      provider: input.provider,
      tenantId: input.tenantId,
      entityType: input.entityType,
      resourceId: input.resourceId,
    })
    .onConflictDoNothing()
    .returning({ id: integrationSyncJobs.id });

  return inserted.length > 0;
}

export async function markJobStatus({
  id,
  status,
  error,
}: {
  id: string;
  status: "processing" | "completed" | "failed";
  error?: string;
}) {
  await db
    .update(integrationSyncJobs)
    .set({ status, error, updatedAt: new Date() })
    .where(eq(integrationSyncJobs.id, id));
}
