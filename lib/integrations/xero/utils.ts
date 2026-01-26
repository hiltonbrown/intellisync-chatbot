import { parseISO } from "date-fns";

export function parseXeroDate(dateString: string | undefined | null): Date | null {
	if (!dateString) return null;

	// Xero format: /Date(1234567890000)/ or /Date(1234567890000+0000)/
	const timestampMatch = dateString.match(/\/Date\((\d+)([+-]\d+)?\)\//);
	if (timestampMatch) {
		return new Date(Number.parseInt(timestampMatch[1], 10));
	}

	// ISO format
	try {
		return parseISO(dateString);
	} catch (error) {
		console.error(
			`[parseXeroDate] Invalid date format: "${dateString}"`,
			{ error: error instanceof Error ? error.message : String(error) },
		);
		return null;
	}
}
