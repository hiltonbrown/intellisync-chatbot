import {
	boolean,
	foreignKey,
	integer,
	json,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
	vector,
	unique,
    index,
} from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";

export const user = pgTable("User", {
	id: text("id").primaryKey().notNull(),
	email: varchar("email", { length: 64 }).notNull(),
	systemPrompt: text("systemPrompt"),
});

export type User = InferSelectModel<typeof user>;

export const userSettings = pgTable("UserSettings", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	userId: text("userId")
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: "cascade" }),
	companyName: varchar("companyName", { length: 256 }),
	timezone: varchar("timezone", { length: 64 }).default("Australia/Brisbane"),
	baseCurrency: varchar("baseCurrency", { length: 3 }).default("AUD"),
	dateFormat: varchar("dateFormat", { length: 20 }).default("DD/MM/YYYY"),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type UserSettings = InferSelectModel<typeof userSettings>;

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
	},
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
	},
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
	"Document",
	{
		id: uuid("id").notNull().defaultRandom(),
		createdAt: timestamp("createdAt").notNull(),
		title: text("title").notNull(),
		content: text("content"),
		textContent: text("textContent"),
		summary: text("summary"),
		blobUrl: text("blobUrl"),
		kind: varchar("text", {
			enum: ["text", "code", "image", "sheet", "pdf", "docx"],
		})
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
	},
);

export type Document = InferSelectModel<typeof document>;

export const documentChunk = pgTable("DocumentChunk", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	artifactId: uuid("artifactId").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	chatId: uuid("chatId")
		.notNull()
		.references(() => chat.id),
	chunkIndex: integer("chunkIndex").notNull(),
	content: text("content").notNull(),
	embedding: vector("embedding", { dimensions: 1536 }).notNull(),
	createdAt: timestamp("createdAt").notNull(),
});

export type DocumentChunk = InferSelectModel<typeof documentChunk>;

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
	}),
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
	}),
);

export type Stream = InferSelectModel<typeof stream>;

// --- Integration Schema ---

export const integrationGrants = pgTable("integration_grants", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	authorisedByClerkUserId: text("authorised_by_clerk_user_id").notNull(),
	clerkOrgId: text("clerk_org_id").notNull(),
	provider: varchar("provider", { length: 50 }).notNull().default("xero"),
	accessTokenEnc: text("access_token_enc").notNull(),
	refreshTokenEnc: text("refresh_token_enc").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	status: varchar("status", {
		enum: ["active", "superseded", "revoked", "refresh_failed"],
	})
		.notNull()
		.default("active"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	lastUsedAt: timestamp("last_used_at"),
}, (table) => ({
    orgIdx: index("integration_grants_org_idx").on(table.clerkOrgId),
    expiryIdx: index("integration_grants_expiry_idx").on(table.expiresAt, table.status),
}));

export type IntegrationGrant = InferSelectModel<typeof integrationGrants>;

export const integrationTenantBindings = pgTable(
	"integration_tenant_bindings",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		clerkOrgId: text("clerk_org_id").notNull(),
		provider: varchar("provider", { length: 50 }).notNull().default("xero"),
		externalTenantId: text("external_tenant_id").notNull(),
		externalTenantName: text("external_tenant_name"),
		activeGrantId: uuid("active_grant_id")
			.notNull()
			.references(() => integrationGrants.id),
		status: varchar("status", {
			enum: ["active", "suspended", "revoked", "needs_reauth"],
		})
			.notNull()
			.default("active"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		unq: unique().on(table.provider, table.externalTenantId),
        orgIdx: index("integration_tenant_bindings_org_idx").on(table.clerkOrgId),
		grantStatusIdx: index("integration_tenant_bindings_grant_status_idx").on(
			table.activeGrantId,
			table.status,
		),
	}),
);

export type IntegrationTenantBinding = InferSelectModel<
	typeof integrationTenantBindings
>;

export const integrationWebhookEvents = pgTable("integration_webhook_events", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	provider: varchar("provider", { length: 50 }).notNull().default("xero"),
	externalEventId: text("external_event_id").notNull().unique(), // for dedupe
	payload: json("payload").notNull(),
	processedAt: timestamp("processed_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const integrationSyncState = pgTable("integration_sync_state", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	tenantBindingId: uuid("tenant_binding_id")
		.notNull()
		.references(() => integrationTenantBindings.id)
		.unique(),
	dataType: varchar("data_type", { length: 50 }).notNull(), // e.g. "invoices", "contacts"
	cursor: text("cursor"),
	lastSyncAt: timestamp("last_sync_at"),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
