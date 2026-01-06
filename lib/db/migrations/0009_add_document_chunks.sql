ALTER TABLE "Document" ADD COLUMN "textContent" text;
ALTER TABLE "Document" ADD COLUMN "summary" text;
ALTER TABLE "Document" ADD COLUMN "blobUrl" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifactId" uuid NOT NULL,
	"userId" text NOT NULL,
	"chatId" uuid NOT NULL,
	"chunkIndex" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
