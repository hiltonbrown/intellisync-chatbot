-- Convert embedding column from json to vector type
-- First, alter the column type (this assumes the table is empty or you want to clear it)
-- If you have existing data, you'll need a custom migration to convert the JSON array to vector format

ALTER TABLE "DocumentChunk" ALTER COLUMN "embedding" TYPE vector(1536) USING embedding::text::vector(1536);
