export class XeroApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "XeroApiError";
    this.status = status;
  }
}

export type XeroWebhookEventPayload = {
  tenantId: string;
  eventCategory: string;
  eventType: string;
  resourceId: string;
  eventDateUtc: string;
};

export type XeroWebhookPayload = {
  events: XeroWebhookEventPayload[];
};
