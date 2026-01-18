import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { integrationWebhookEvents, integrationTenantBindings } from "@/lib/db/schema";
import { SyncQueue } from "@/lib/integrations/sync/queue";
import { eq } from "drizzle-orm";
import { ConfigError, WebhookError, logError } from "@/lib/integrations/errors";

const XERO_WEBHOOK_KEY = process.env.XERO_WEBHOOK_KEY;
const MAX_WEBHOOK_SIZE = 1024 * 1024; // 1MB limit
const POSTGRES_UNIQUE_VIOLATION = "23505";

interface XeroWebhookEvent {
	eventId: string;
	tenantId: string;
	eventCategory: string;
	resourceId: string;
}

interface XeroWebhookPayload {
	events: XeroWebhookEvent[];
}

export async function POST(req: Request) {
    if (!XERO_WEBHOOK_KEY) {
        const error = new ConfigError("XERO_WEBHOOK_KEY not configured");
        logError(error);
        return new Response("Webhook endpoint not configured", { status: 503 });
    }

    try {
        // 1. Check content length before reading body (prevents memory exhaustion)
        const contentLength = req.headers.get("content-length");
        if (contentLength && Number.parseInt(contentLength, 10) > MAX_WEBHOOK_SIZE) {
            throw new WebhookError(
                "Webhook payload too large",
                "PAYLOAD_TOO_LARGE",
                413,
                { size: contentLength },
            );
        }

        // 2. Verify Signature exists before reading body
        const signature = req.headers.get("x-xero-signature");
        if (!signature) {
            throw new WebhookError(
                "Missing webhook signature",
                "MISSING_SIGNATURE",
                401,
            );
        }

        // 3. Read and verify body
        const bodyText = await req.text();

        // Additional size check after reading
        if (bodyText.length > MAX_WEBHOOK_SIZE) {
            throw new WebhookError(
                "Webhook payload too large",
                "PAYLOAD_TOO_LARGE",
                413,
                { size: bodyText.length },
            );
        }

        const hmac = createHmac("sha256", XERO_WEBHOOK_KEY);
        hmac.update(bodyText);
        const computedSignature = hmac.digest("base64");

        const signatureBuffer = Buffer.from(signature);
        const computedBuffer = Buffer.from(computedSignature);

        if (signatureBuffer.length !== computedBuffer.length ||
            !timingSafeEqual(signatureBuffer, computedBuffer)) {
            throw new WebhookError(
                "Invalid webhook signature",
                "INVALID_SIGNATURE",
                401,
            );
        }

        // 4. Parse Payload
        let payload: XeroWebhookPayload;
        try {
            payload = JSON.parse(bodyText);
        } catch (e) {
            throw new WebhookError(
                "Invalid webhook JSON payload",
                "INVALID_JSON",
                400,
            );
        }

        const events = payload.events || [];
        console.log(`Received ${events.length} Xero events`);

        // 5. Process events
        for (const event of events) {
            const externalEventId = `${event.eventId}`;

            try {
                // Dedupe & Persist
                await db.insert(integrationWebhookEvents).values({
                    externalEventId,
                    payload: event,
                    provider: "xero"
                });

                // Resolve Tenant Binding
                const tenantId = event.tenantId;
                const binding = await db.query.integrationTenantBindings.findFirst({
                    where: eq(integrationTenantBindings.externalTenantId, tenantId)
                });

                if (binding) {
                    // Enqueue Sync Job
                    await SyncQueue.enqueue({
                        tenantBindingId: binding.id,
                        eventId: externalEventId,
                        resourceType: event.eventCategory,
                        resourceId: event.resourceId
                    });
                } else {
                    console.warn("Webhook received for unknown tenant", tenantId, {
                        tenantId,
                        eventId: externalEventId,
                    });
                }

            } catch (e: unknown) {
                // Check if it's a duplicate event (unique constraint violation)
                if (typeof e === "object" && e !== null && "code" in e && e.code === POSTGRES_UNIQUE_VIOLATION) {
                    console.log(`Duplicate event ${externalEventId} skipped`);
                } else {
                    // Log error but don't fail the webhook - Xero expects 200 OK
                    logError(e, {
                        context: "webhook_event_processing",
                        eventId: externalEventId,
                        tenantId: event.tenantId,
                    });
                }
            }
        }

        // Xero expects 200 OK fast
        return new Response(null, { status: 200 });

    } catch (error) {
        // Handle webhook-level errors
        logError(error, { context: "webhook_validation" });

        if (error instanceof WebhookError) {
            return new Response(error.toClientResponse().error, {
                status: error.statusCode,
            });
        }

        // Generic error response
        return new Response("Webhook processing failed", { status: 500 });
    }
}
