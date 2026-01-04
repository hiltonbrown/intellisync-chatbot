export type IntegrationProvider = "xero";

export type IntegrationState =
  | "connected"
  | "active"
  | "error"
  | "reauth_required"
  | "disconnected";

export type SyncEntityType = "invoice" | "contact" | "payment";
