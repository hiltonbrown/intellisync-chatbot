-- Drop foreign key constraints
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_userId_User_id_fk";
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_User_id_fk";
ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_userId_User_id_fk";

-- Change user ID column types
ALTER TABLE "User" ALTER COLUMN "id" SET DATA TYPE varchar(255);
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Chat" ALTER COLUMN "userId" SET DATA TYPE varchar(255);
ALTER TABLE "Document" ALTER COLUMN "userId" SET DATA TYPE varchar(255);
ALTER TABLE "Suggestion" ALTER COLUMN "userId" SET DATA TYPE varchar(255);

-- Recreate foreign key constraints
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id");
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id");
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id");