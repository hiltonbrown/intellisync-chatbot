import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { integrationWebhookEvents, integrationTenantBindings } from "@/lib/db/schema";
import { SyncQueue } from "@/lib/integrations/sync/queue";
import { eq } from "drizzle-orm";

const XERO_WEBHOOK_KEY = process.env.XERO_WEBHOOK_KEY || "";

export async function POST(req: Request) {
    if (!XERO_WEBHOOK_KEY) {
        // During dev, if not set, we might skip validation or fail.
        console.warn("XERO_WEBHOOK_KEY not set");
    }

    // 1. Verify Signature
    const signature = req.headers.get("x-xero-signature");
    if (!signature) {
        return new Response("Missing signature", { status: 401 });
    }

    const bodyText = await req.text();

    if (XERO_WEBHOOK_KEY) {
        const hmac = createHmac("sha256", XERO_WEBHOOK_KEY);
        hmac.update(bodyText);
        const computedSignature = hmac.digest("base64");

        if (signature !== computedSignature) {
            return new Response("Invalid signature", { status: 401 });
        }
    }

    // 2. Parse Payload
    const payload = JSON.parse(bodyText);
    const events = payload.events || [];

    console.log(`Received ${events.length} Xero events`);

    for (const event of events) {
        // dedupe key
        const externalEventId = `${event.eventId}`;

        try {
            // 3. Dedupe & Persist
            await db.insert(integrationWebhookEvents).values({
                externalEventId,
                payload: event,
                provider: "xero"
            });
            // If duplicate, it throws (unique constraint), catch and ignore.

            // 4. Resolve Tenant Binding
            const tenantId = event.tenantId;
            const binding = await db.query.integrationTenantBindings.findFirst({
                where: eq(integrationTenantBindings.externalTenantId, tenantId)
            });

            if (binding) {
                // 5. Enqueue Sync Job
                await SyncQueue.enqueue({
                    tenantBindingId: binding.id,
                    eventId: externalEventId,
                    resourceType: event.eventCategory,
                    resourceId: event.resourceId
                });
            } else {
                console.warn(`Webhook received for unknown tenant ${tenantId}`);
            }

        } catch (e: any) {
             if (e.code === '23505') { // Unique violation
                 console.log(`Duplicate event ${externalEventId} skipped`);
             } else {
                 console.error("Webhook processing error:", e);
             }
        }
    }

    // Xero expects 200 OK fast
    return new Response(null, { status: 200 });
}
