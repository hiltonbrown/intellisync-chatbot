import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  integrationConnections,
  xeroWebhookEvents,
} from "@/lib/db/schema";
import { enqueueSyncJob } from "@/lib/integrations/queue";
import type { SyncEntityType } from "@/lib/integrations/types";
import {
  parseXeroWebhookPayload,
  verifyXeroWebhookSignature,
} from "@/lib/integrations/xero/webhook";

function mapEntityType(category: string): SyncEntityType | null {
  const upper = category.toUpperCase();
  if (upper.includes("INVOICE")) {
    return "invoice";
  }
  if (upper.includes("CONTACT")) {
    return "contact";
  }
  if (upper.includes("PAYMENT")) {
    return "payment";
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-xero-signature");

  const isValid = verifyXeroWebhookSignature({ rawBody, signature });
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = parseXeroWebhookPayload(rawBody);

  for (const event of payload.events) {
    const [connection] = await db
      .select({
        id: integrationConnections.id,
        state: integrationConnections.state,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.provider, "xero"),
          eq(integrationConnections.externalAccountId, event.tenantId)
        )
      )
      .limit(1);

    if (!connection || connection.state === "disconnected") {
      continue;
    }

    const inserted = await db
      .insert(xeroWebhookEvents)
      .values({
        tenantId: event.tenantId,
        eventCategory: event.eventCategory,
        eventType: event.eventType,
        resourceId: event.resourceId,
        eventDateUtc: new Date(event.eventDateUtc),
      })
      .onConflictDoNothing()
      .returning({ id: xeroWebhookEvents.id });

    if (inserted.length === 0) {
      continue;
    }

    const entityType = mapEntityType(event.eventCategory);
    if (!entityType) {
      continue;
    }

    await enqueueSyncJob({
      provider: "xero",
      tenantId: event.tenantId,
      entityType,
      resourceId: event.resourceId,
    });
  }

  return new Response("ok", { status: 200 });
}
