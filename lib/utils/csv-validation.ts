/**
 * CSV Validation and Sanitization Utility
 *
 * Validates and sanitizes CSV content from LLM output to ensure
 * consistent formatting and prevent parsing errors in the UI.
 */

export interface CSVValidationResult {
	isValid: boolean;
	sanitizedCSV: string;
	errors: string[];
	warnings: string[];
	rowCount: number;
	columnCount: number;
}

/**
 * Parses CSV content into a 2D array of strings.
 * Handles quoted fields, escaped quotes, and various line endings.
 */
function parseCSVRows(csv: string): string[][] {
	const rows: string[][] = [];
	let currentRow: string[] = [];
	let currentCell = "";
	let inQuotes = false;

	for (let i = 0; i < csv.length; i++) {
		const char = csv[i];
		const nextChar = csv[i + 1];

		if (inQuotes) {
			if (char === '"' && nextChar === '"') {
				// Escaped quote - add single quote and skip next
				currentCell += '"';
				i++;
			} else if (char === '"') {
				// End of quoted field
				inQuotes = false;
			} else {
				currentCell += char;
			}
		} else {
			if (char === '"') {
				// Start of quoted field
				inQuotes = true;
			} else if (char === ",") {
				// Field separator
				currentRow.push(currentCell.trim());
				currentCell = "";
			} else if (char === "\n") {
				// Row separator
				currentRow.push(currentCell.trim());
				if (currentRow.length > 0 && currentRow.some((cell) => cell !== "")) {
					rows.push(currentRow);
				}
				currentRow = [];
				currentCell = "";
			} else if (char === "\r") {
			} else {
				currentCell += char;
			}
		}
	}

	// Don't forget the last cell/row
	if (currentCell || currentRow.length > 0) {
		currentRow.push(currentCell.trim());
		if (currentRow.length > 0 && currentRow.some((cell) => cell !== "")) {
			rows.push(currentRow);
		}
	}

	return rows;
}

/**
 * Escapes a cell value for CSV output.
 * Quotes the value if it contains special characters.
 */
function escapeCSVCell(cell: string): string {
	// Check if quoting is needed
	const needsQuoting =
		cell.includes(",") ||
		cell.includes('"') ||
		cell.includes("\n") ||
		cell.includes("\r");

	if (needsQuoting) {
		// Escape internal quotes by doubling them
		const escaped = cell.replace(/"/g, '""');
		return `"${escaped}"`;
	}

	return cell;
}

/**
 * Validates and sanitizes CSV content from LLM output.
 * Ensures consistent column counts and proper formatting.
 *
 * @param rawCSV - The raw CSV string from LLM output
 * @returns Validation result with sanitized CSV and any errors/warnings
 */
export function validateAndSanitizeCSV(rawCSV: string): CSVValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Handle empty input
	if (!rawCSV || rawCSV.trim() === "") {
		return {
			isValid: false,
			sanitizedCSV: "",
			errors: ["Empty CSV content"],
			warnings: [],
			rowCount: 0,
			columnCount: 0,
		};
	}

	// Normalize the input - handle escaped newlines from LLM
	const csv = rawCSV
		.replace(/\\n/g, "\n") // Convert escaped newlines to actual
		.replace(/\r\n/g, "\n") // Normalize Windows line endings
		.replace(/\r/g, "\n") // Normalize old Mac line endings
		.trim();

	// Parse into rows
	const rows = parseCSVRows(csv);

	if (rows.length === 0) {
		return {
			isValid: false,
			sanitizedCSV: "",
			errors: ["No valid data rows found in CSV"],
			warnings: [],
			rowCount: 0,
			columnCount: 0,
		};
	}

	// Validate column consistency
	const columnCounts = rows.map((row) => row.length);
	const expectedColumns = columnCounts[0] ?? 0;
	const inconsistentRows: number[] = [];

	for (let i = 0; i < columnCounts.length; i++) {
		if (columnCounts[i] !== expectedColumns) {
			inconsistentRows.push(i + 1);
		}
	}

	if (inconsistentRows.length > 0) {
		warnings.push(
			`Inconsistent column count in rows: ${inconsistentRows.join(", ")} (expected ${expectedColumns} columns)`,
		);
	}

	// Pad shorter rows to match expected column count
	const normalizedRows = rows.map((row) => {
		if (row.length < expectedColumns) {
			return [...row, ...Array(expectedColumns - row.length).fill("")];
		}
		return row;
	});

	// Rebuild sanitized CSV
	const sanitizedCSV = normalizedRows
		.map((row) => row.map((cell) => escapeCSVCell(cell)).join(","))
		.join("\n");

	// Determine validity - valid if no errors (warnings are acceptable)
	const isValid = errors.length === 0 && rows.length > 0;

	return {
		isValid,
		sanitizedCSV,
		errors,
		warnings,
		rowCount: normalizedRows.length,
		columnCount: expectedColumns,
	};
}

/**
 * Quick validation check for CSV content.
 * Returns true if the CSV appears to be valid.
 */
export function isValidCSV(csv: string): boolean {
	const result = validateAndSanitizeCSV(csv);
	return result.isValid;
}

/**
 * Formats a number as Australian currency for CSV (without $ symbol).
 * Used for ensuring consistent currency formatting in spreadsheets.
 */
export function formatCurrencyForCSV(amount: number | string): string {
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	if (Number.isNaN(num)) {
		return "0.00";
	}
	return num.toFixed(2);
}

/**
 * Formats a date as DD/MM/YYYY for Australian business CSV.
 */
export function formatDateForCSV(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) {
		return "";
	}
	const day = d.getDate().toString().padStart(2, "0");
	const month = (d.getMonth() + 1).toString().padStart(2, "0");
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}
