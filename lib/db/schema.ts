import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: text("id").primaryKey().notNull(),
  email: varchar("email", { length: 64 }).notNull(),
  systemPrompt: text("systemPrompt"),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    provider: varchar("provider", { length: 32 }).notNull(),
    clerkOrgId: text("clerk_org_id").notNull(),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    externalAccountName: text("external_account_name"),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    expiresAtUtc: timestamp("expires_at_utc").notNull(),
    scopes: text("scopes"),
    state: varchar("state", {
      enum: [
        "connected",
        "active",
        "error",
        "reauth_required",
        "disconnected",
      ],
    })
      .notNull()
      .default("connected"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueProviderExternalAccount: uniqueIndex(
      "integration_connections_provider_external_account_unique"
    ).on(table.provider, table.externalAccountId),
  })
);

export type IntegrationConnection = InferSelectModel<
  typeof integrationConnections
>;

export const integrationSyncJobs = pgTable(
  "integration_sync_jobs",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    provider: varchar("provider", { length: 32 }).notNull(),
    tenantId: text("tenant_id").notNull(),
    entityType: text("entity_type").notNull(),
    resourceId: text("resource_id").notNull(),
    status: varchar("status", {
      enum: ["pending", "processing", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueJob: uniqueIndex("integration_sync_jobs_dedupe_unique").on(
      table.provider,
      table.tenantId,
      table.entityType,
      table.resourceId
    ),
  })
);

export type IntegrationSyncJob = InferSelectModel<typeof integrationSyncJobs>;

export const xeroWebhookEvents = pgTable(
  "xero_webhook_events",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    eventCategory: text("event_category").notNull(),
    eventType: text("event_type").notNull(),
    resourceId: text("resource_id").notNull(),
    eventDateUtc: timestamp("event_date_utc").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueWebhookEvent: uniqueIndex(
      "xero_webhook_events_tenant_event_unique"
    ).on(
      table.tenantId,
      table.eventCategory,
      table.eventType,
      table.resourceId,
      table.eventDateUtc
    ),
  })
);

export type XeroWebhookEvent = InferSelectModel<typeof xeroWebhookEvents>;

export const xeroInvoices = pgTable(
  "xero_invoices",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    xeroResourceId: text("xero_resource_id").notNull(),
    data: json("data").notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueInvoice: uniqueIndex("xero_invoices_tenant_resource_unique").on(
      table.tenantId,
      table.xeroResourceId
    ),
  })
);

export const xeroContacts = pgTable(
  "xero_contacts",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    xeroResourceId: text("xero_resource_id").notNull(),
    data: json("data").notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueContact: uniqueIndex("xero_contacts_tenant_resource_unique").on(
      table.tenantId,
      table.xeroResourceId
    ),
  })
);

export const xeroPayments = pgTable(
  "xero_payments",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    xeroResourceId: text("xero_resource_id").notNull(),
    data: json("data").notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniquePayment: uniqueIndex("xero_payments_tenant_resource_unique").on(
      table.tenantId,
      table.xeroResourceId
    ),
  })
);
