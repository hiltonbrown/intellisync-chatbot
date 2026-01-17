import { streamObject } from "ai";
import { z } from "zod";
import { intellisyncSheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { validateAndSanitizeCSV } from "@/lib/utils/csv-validation";

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
	kind: "sheet",
	onCreateDocument: async ({ title, description, dataStream }) => {
		let draftContent = "";

		// If description contains CSV data (from uploaded file), use it directly
		// Otherwise, generate new CSV based on title
		if (
			description &&
			(description.includes(",") || description.includes("\n"))
		) {
			// This appears to be actual CSV content from an upload
			// Validate and sanitize the CSV content
			const validation = validateAndSanitizeCSV(description);
			draftContent = validation.sanitizedCSV || description;

			if (validation.warnings.length > 0) {
				console.warn("CSV validation warnings:", validation.warnings);
			}

			dataStream.write({
				type: "data-sheetDelta",
				data: draftContent,
				transient: true,
			});

			return draftContent;
		}

		// Generate new CSV content using AI
		const { fullStream } = streamObject({
			model: getArtifactModel(),
			system: intellisyncSheetPrompt,
			prompt: description || title,
			schema: z.object({
				csv: z
					.string()
					.describe(
						"CSV data with proper newlines and Australian date/currency formatting",
					),
			}),
		});

		for await (const delta of fullStream) {
			const { type } = delta;

			if (type === "object") {
				const { object } = delta;
				const { csv } = object;

				if (csv) {
					dataStream.write({
						type: "data-sheetDelta",
						data: csv,
						transient: true,
					});

					draftContent = csv;
				}
			}
		}

		// Validate and sanitize the final CSV output
		const validation = validateAndSanitizeCSV(draftContent);
		if (validation.warnings.length > 0) {
			console.warn("Generated CSV validation warnings:", validation.warnings);
		}
		const sanitizedContent = validation.sanitizedCSV || draftContent;

		dataStream.write({
			type: "data-sheetDelta",
			data: sanitizedContent,
			transient: true,
		});

		return sanitizedContent;
	},
	onUpdateDocument: async ({ document, description, dataStream }) => {
		let draftContent = "";

		const { fullStream } = streamObject({
			model: getArtifactModel(),
			system: updateDocumentPrompt(document.content, "sheet"),
			prompt: description,
			schema: z.object({
				csv: z
					.string()
					.describe(
						"CSV data with proper newlines and Australian date/currency formatting",
					),
			}),
		});

		for await (const delta of fullStream) {
			const { type } = delta;

			if (type === "object") {
				const { object } = delta;
				const { csv } = object;

				if (csv) {
					dataStream.write({
						type: "data-sheetDelta",
						data: csv,
						transient: true,
					});

					draftContent = csv;
				}
			}
		}

		// Validate and sanitize the final CSV output
		const validation = validateAndSanitizeCSV(draftContent);
		if (validation.warnings.length > 0) {
			console.warn("Updated CSV validation warnings:", validation.warnings);
		}

		return validation.sanitizedCSV || draftContent;
	},
});
