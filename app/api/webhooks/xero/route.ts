import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { integrationWebhookEvents, integrationTenantBindings } from "@/lib/db/schema";
import { SyncQueue } from "@/lib/integrations/sync/queue";
import { eq } from "drizzle-orm";

const XERO_WEBHOOK_KEY = process.env.XERO_WEBHOOK_KEY;

export async function POST(req: Request) {
    if (!XERO_WEBHOOK_KEY) {
        console.error("XERO_WEBHOOK_KEY not configured - webhooks disabled");
        return new Response("Webhook endpoint not configured", { status: 503 });
    }

    // 1. Verify Signature
    const signature = req.headers.get("x-xero-signature");
    if (!signature) {
        return new Response("Missing signature", { status: 401 });
    }

    const bodyText = await req.text();

    const hmac = createHmac("sha256", XERO_WEBHOOK_KEY);
    hmac.update(bodyText);
    const computedSignature = hmac.digest("base64");

    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);

    if (signatureBuffer.length !== computedBuffer.length ||
        !timingSafeEqual(signatureBuffer, computedBuffer)) {
        return new Response("Invalid signature", { status: 401 });
    }

    // 2. Parse Payload
    let payload: any;
    try {
        payload = JSON.parse(bodyText);
    } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
    }

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
