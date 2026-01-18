import { expect, test } from "@playwright/test";

test.describe("File Upload API", () => {
	test("successfully uploads valid text file", async ({ page, context }) => {
		const response = await context.request.post("/api/files/upload", {
			multipart: {
				file: {
					name: "valid-text.txt",
					mimeType: "text/plain",
					buffer: Buffer.from(
						"This is a valid text file with enough content for validation.",
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
						"# Markdown File\n\nThis is a valid markdown file with sufficient content.",
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
						"name,age,city\nJohn,30,New York\nJane,25,Los Angeles",
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

	test("successfully uploads valid PDF file", async ({ page, context }) => {
		const response = await context.request.post("/api/files/upload", {
			multipart: {
				file: {
					name: "valid.pdf",
					mimeType: "application/pdf",
					buffer: Buffer.from(
						"This is a valid PDF file with enough content for validation.",
					),
				},
				chatId: "test-chat-id",
			},
		});

		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data).toHaveProperty("url");
		expect(data).toHaveProperty("documentId");
	});

	test("rejects file larger than 10MB", async ({ page, context }) => {
		// Create a buffer larger than 10MB
		const largeBuffer = Buffer.alloc(11 * 1024 * 1024, "a");

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
		expect(data.error).toContain("File size should be less than 10MB");
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
