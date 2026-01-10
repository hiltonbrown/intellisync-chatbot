import { put } from "@vercel/blob";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { parse } from "papaparse";
import { PDFParse } from "pdf-parse";
import { z } from "zod";

import { auth } from "@clerk/nextjs/server";
import { chunkText, createEmbeddings } from "@/lib/ai/rag";
import {
	getChatById,
	saveChat,
	saveDocument,
	saveDocumentChunks,
} from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

const MIN_TEXT_LENGTH = 10;

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: "File size should be less than 10MB",
    })
    // Update the file type based on the kind of files you want to accept
    .refine(
      (file) =>
        [
          "image/jpeg",
          "image/png",
          "application/pdf",
          "text/plain",
          "text/csv",
          "text/tab-separated-values",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(file.type),
      {
        message:
          "File type should be JPEG, PNG, PDF, DOCX, TXT, CSV, or TSV",
      }
    ),
});

const summarizeSheet = (content: string) => {
  const parsed = parse<string[]>(content, {
    skipEmptyLines: true,
  });
  const rows = parsed.data.filter((row) =>
    row.some((cell) => cell.trim() !== "")
  );

  if (rows.length === 0) {
    return "Empty spreadsheet";
  }

  const header = rows[0] ?? [];
  const rowCount = Math.max(rows.length - 1, 0);
  const validColumns = header.filter(
    (cell) => typeof cell === "string" && cell.trim() !== ""
  );

  if (validColumns.length === 0) {
    return `Spreadsheet with ${rowCount} rows and no column headers.`;
  }

  const columnCount = validColumns.length;
  const columns = validColumns.join(", ");
  return `Spreadsheet with ${rowCount} rows and ${columnCount} columns. Columns: ${columns}`;
};

const extractText = async (
  fileBuffer: Buffer,
  fileType: string
): Promise<string> => {

  if (fileType === "text/plain") {
    return fileBuffer.toString("utf-8");
  }

  if (fileType === "text/csv" || fileType === "text/tab-separated-values") {
    return fileBuffer.toString("utf-8");
  }

  if (fileType === "application/pdf") {
    let pdfParser: PDFParse | null = null;
    try {
      pdfParser = new PDFParse({ data: fileBuffer });
      const result = await pdfParser.getText();
      return result.text;
    } catch (error) {
      console.error("PDF parsing error:", error);
      return ""; // Triggers validation error downstream
    } finally {
      if (pdfParser) {
        await pdfParser.destroy(); // REQUIRED for memory cleanup
      }
    }
  }

  if (
    fileType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  return "";
};

const resolveDocumentKind = (fileType: string) => {
  if (fileType === "application/pdf") {
    return "pdf";
  }

  if (
    fileType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  if (fileType === "text/csv" || fileType === "text/tab-separated-values") {
    return "sheet";
  }

  return "text";
};

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;
    const chatId = formData.get("chatId")?.toString() ?? "";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.issues
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get("file") as File).name;
    const isImageUpload = file.type.startsWith("image/");

    // CRITICAL: Read blob once and convert to Buffer (single source of truth)
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Extract and validate text for non-image uploads
    let extractedText = "";
    if (!isImageUpload) {
      extractedText = await extractText(fileBuffer, file.type);
      const normalizedText = extractedText.replace(/\s+/g, " ").trim();

      if (normalizedText.length < MIN_TEXT_LENGTH) {
        return NextResponse.json(
          {
            error:
              `The uploaded document does not contain enough text content. Please upload a file with at least ${MIN_TEXT_LENGTH} characters.`,
          },
          { status: 400 }
        );
      }
    }

    try {
      const data = await put(`${filename}`, fileBuffer, {
        access: "public",
        addRandomSuffix: true, // Generate unique filename to prevent overwrites
      });

      if (file.type.startsWith("image/")) {
        return NextResponse.json(data);
      }

      if (!chatId) {
        return NextResponse.json(
          { error: "chatId is required for document uploads" },
          { status: 400 }
        );
      }

      // Verify that the chat exists and belongs to the authenticated user
      // If it doesn't exist, create it (this handles file uploads on the main page before first message)
      let existingChat = await getChatById({ id: chatId });

      if (!existingChat) {
        // Create the chat with a temporary title (will be updated when first message is sent)
        await saveChat({
          id: chatId,
          userId,
          title: "New Chat",
          visibility: "private",
        });
        existingChat = await getChatById({ id: chatId });
      }

      if (existingChat && existingChat.userId !== userId) {
        return NextResponse.json(
          { error: "Unauthorized: Chat does not belong to user" },
          { status: 403 }
        );
      }

      // Reuse extracted text from earlier validation
      const normalizedText = extractedText.trim();
      const documentId = generateUUID();
      const kind = resolveDocumentKind(file.type);
      const summary =
        kind === "sheet" ? summarizeSheet(normalizedText) : null;

      const shouldStoreContent = kind === "text" || kind === "sheet";

      await saveDocument({
        id: documentId,
        title: filename,
        kind,
        content: shouldStoreContent ? normalizedText : "",
        textContent: normalizedText,
        summary,
        blobUrl: data.url,
        userId,
        chatId,
      });

      if (normalizedText.length >= MIN_TEXT_LENGTH) {
        const chunks = chunkText(normalizedText);
        const embeddings = await createEmbeddings(chunks);

        if (embeddings.length !== chunks.length) {
          console.error("Embeddings length mismatch", {
            chunksLength: chunks.length,
            embeddingsLength: embeddings.length,
            documentId,
          });
          return NextResponse.json(
            { error: "Failed to generate embeddings for all chunks" },
            { status: 500 }
          );
        }

        const createdAt = new Date();

        await saveDocumentChunks({
          chunks: chunks.map((content, index) => ({
            artifactId: documentId,
            userId,
            chatId,
            chunkIndex: index,
            content,
            embedding: embeddings[index] ?? [],
            createdAt,
          })),
        });
      }

      return NextResponse.json({
        ...data,
        documentId,
      });
    } catch (error) {
      console.error("Upload failed:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("Failed to process request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
