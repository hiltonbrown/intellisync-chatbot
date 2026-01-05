import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@clerk/nextjs/server";

const allowedFileTypes = [
  "image/jpeg",
  "image/png",
  "text/plain",
  "text/markdown",
  "text/csv",
];

const MIN_TEXT_LENGTH = 10;

const extractText = async (file: Blob): Promise<string> => {
  try {
    return await file.text();
  } catch {
    return "";
  }
};

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    // Update the file type based on the kind of files you want to accept
    .refine((file) => allowedFileTypes.includes(file.type), {
      message:
        "File type should be JPEG, PNG, plain text, Markdown, or CSV",
    }),
});

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

    // Extract and validate text for non-image uploads before consuming the blob
    if (!isImageUpload) {
      const extractedText = await extractText(file);
      const normalizedText = extractedText.replace(/\s+/g, " ").trim();

      if (normalizedText.length < MIN_TEXT_LENGTH) {
        return NextResponse.json(
          {
            error:
              "The uploaded document does not contain enough text content. Please upload a file with at least 10 characters.",
          },
          { status: 400 }
        );
      }
    }

    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await put(`${filename}`, fileBuffer, {
        access: "public",
      });

      return NextResponse.json(data);
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
