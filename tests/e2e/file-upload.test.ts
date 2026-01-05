import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEST_FILES_DIR = join(__dirname, "..", "..", "tmp", "test-files");

// Setup test files
test.beforeAll(() => {
  if (!existsSync(TEST_FILES_DIR)) {
    mkdirSync(TEST_FILES_DIR, { recursive: true });
  }

  // Create valid text file with sufficient content
  writeFileSync(
    join(TEST_FILES_DIR, "valid-text.txt"),
    "This is a valid text file with enough content for validation."
  );

  // Create text file with insufficient content (less than 10 characters)
  writeFileSync(join(TEST_FILES_DIR, "short-text.txt"), "Short");

  // Create empty text file
  writeFileSync(join(TEST_FILES_DIR, "empty-text.txt"), "");

  // Create valid markdown file
  writeFileSync(
    join(TEST_FILES_DIR, "valid-markdown.md"),
    "# Markdown File\n\nThis is a valid markdown file with sufficient content."
  );

  // Create valid CSV file
  writeFileSync(
    join(TEST_FILES_DIR, "valid-csv.csv"),
    "name,age,city\nJohn,30,New York\nJane,25,Los Angeles"
  );

  // Create a file with only whitespace
  writeFileSync(join(TEST_FILES_DIR, "whitespace.txt"), "   \n\n\t\t  ");
});

test.describe("File Upload API", () => {
  test("successfully uploads valid text file", async ({ page, context }) => {
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "valid-text.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(
            "This is a valid text file with enough content for validation."
          ),
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("url");
  });

  test("successfully uploads valid markdown file", async ({
    page,
    context,
  }) => {
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "valid-markdown.md",
          mimeType: "text/markdown",
          buffer: Buffer.from(
            "# Markdown File\n\nThis is a valid markdown file with sufficient content."
          ),
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("url");
  });

  test("successfully uploads valid CSV file", async ({ page, context }) => {
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "valid-csv.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            "name,age,city\nJohn,30,New York\nJane,25,Los Angeles"
          ),
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("url");
  });

  test("rejects text file with insufficient content", async ({
    page,
    context,
  }) => {
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "short-text.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Short"),
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("does not contain enough text content");
    expect(data.error).toContain("at least 10 characters");
  });

  test("rejects empty text file", async ({ page, context }) => {
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "empty-text.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(""),
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("does not contain enough text content");
  });

  test("rejects text file with only whitespace", async ({ page, context }) => {
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "whitespace.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("   \n\n\t\t  "),
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("does not contain enough text content");
  });

  test("rejects file with invalid MIME type", async ({ page, context }) => {
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "invalid.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("PDF content"),
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("File type should be");
  });

  test("rejects file larger than 5MB", async ({ page, context }) => {
    // Create a buffer larger than 5MB
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, "a");

    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "large-file.txt",
          mimeType: "text/plain",
          buffer: largeBuffer,
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("File size should be less than 5MB");
  });

  test("requires authentication", async ({ context }) => {
    // Make request without authentication
    const response = await context.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "test.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Test content"),
        },
      },
    });

    // Should return 401 Unauthorized
    expect(response.status()).toBe(401);
  });
});
