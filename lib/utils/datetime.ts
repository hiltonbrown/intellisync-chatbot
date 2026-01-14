/**
 * Date/Time Utility for Intellisync
 *
 * Provides timezone-aware date/time context for the AI system prompt.
 * Designed for Australian business use cases including:
 * - MCP accounting system integration (profit/loss statements)
 * - Document dating
 * - Scheduling/calendar features
 * - Audit trail timestamps
 */

/**
 * Structured date/time context for system prompt injection.
 */
export interface DateTimeContext {
	// ISO 8601 timestamp for precise calculations
	isoTimestamp: string;

	// Formatted current date (DD/MM/YYYY)
	currentDate: string;

	// Formatted current time (HH:MM AM/PM)
	currentTime: string;

	// Day of week (e.g., "Monday")
	dayOfWeek: string;

	// Timezone identifier (e.g., "Australia/Brisbane")
	timezone: string;

	// Timezone abbreviation (e.g., "AEST")
	timezoneAbbreviation: string;

	// UTC offset (e.g., "+10:00")
	utcOffset: string;

	// Australian Financial Year context
	financialYear: {
		// Current FY (e.g., "2024-25")
		current: string;
		// Start date of current FY
		startDate: string;
		// End date of current FY
		endDate: string;
		// Quarter within the FY (1-4)
		quarter: number;
		// Month within the FY (1-12, where July = 1)
		monthInFY: number;
	};

	// Relative time references for natural language processing
	relativeContext: {
		// "last month" date range (DD/MM/YYYY - DD/MM/YYYY)
		lastMonth: { start: string; end: string; name: string };
		// "this month" date range
		thisMonth: { start: string; end: string; name: string };
		// "last quarter" (based on FY quarters)
		lastQuarter: { start: string; end: string; name: string };
		// "this quarter" (based on FY quarters)
		thisQuarter: { start: string; end: string; name: string };
		// "last financial year"
		lastFinancialYear: { start: string; end: string; name: string };
	};
}

/**
 * Maps timezone identifiers to their abbreviations.
 * Note: Australia/Brisbane doesn't observe DST, so AEST year-round.
 */
const TIMEZONE_ABBREVIATIONS: Record<string, { standard: string; dst: string }> = {
	"Australia/Brisbane": { standard: "AEST", dst: "AEST" }, // No DST
	"Australia/Sydney": { standard: "AEST", dst: "AEDT" },
	"Australia/Melbourne": { standard: "AEST", dst: "AEDT" },
	"Australia/Hobart": { standard: "AEST", dst: "AEDT" },
	"Australia/Adelaide": { standard: "ACST", dst: "ACDT" },
	"Australia/Darwin": { standard: "ACST", dst: "ACST" }, // No DST
	"Australia/Perth": { standard: "AWST", dst: "AWST" }, // No DST
};

/**
 * Checks if a given date is in Daylight Saving Time for the specified timezone.
 */
function isDST(date: Date, timezone: string): boolean {
	// Brisbane, Darwin, and Perth don't observe DST
	if (["Australia/Brisbane", "Australia/Darwin", "Australia/Perth"].includes(timezone)) {
		return false;
	}

	// For other Australian timezones, DST is typically first Sunday of October
	// to first Sunday of April
	const jan = new Date(date.getFullYear(), 0, 1);
	const jul = new Date(date.getFullYear(), 6, 1);

	const janOffset = new Date(
		jan.toLocaleString("en-US", { timeZone: timezone }),
	).getTime() - jan.getTime();
	const julOffset = new Date(
		jul.toLocaleString("en-US", { timeZone: timezone }),
	).getTime() - jul.getTime();

	const currentOffset = new Date(
		date.toLocaleString("en-US", { timeZone: timezone }),
	).getTime() - date.getTime();

	// If current offset matches the larger offset (summer), DST is active
	return currentOffset === Math.max(janOffset, julOffset);
}

/**
 * Gets the timezone abbreviation for a given timezone and date.
 */
function getTimezoneAbbreviation(timezone: string, date: Date): string {
	const abbrevs = TIMEZONE_ABBREVIATIONS[timezone];
	if (!abbrevs) {
		// Fallback: extract from formatted string
		const formatted = date.toLocaleString("en-AU", {
			timeZone: timezone,
			timeZoneName: "short",
		});
		const match = formatted.match(/([A-Z]{3,4})$/);
		return match ? match[1] : "UTC";
	}
	return isDST(date, timezone) ? abbrevs.dst : abbrevs.standard;
}

/**
 * Gets the UTC offset string for a timezone (e.g., "+10:00").
 */
function getUTCOffset(date: Date, timezone: string): string {
	const formatter = new Intl.DateTimeFormat("en-AU", {
		timeZone: timezone,
		timeZoneName: "longOffset",
	});
	const parts = formatter.formatToParts(date);
	const offsetPart = parts.find((p) => p.type === "timeZoneName");
	if (offsetPart) {
		// Extract offset from "GMT+10:00" format
		const match = offsetPart.value.match(/GMT([+-]\d{1,2}:?\d{0,2})/);
		if (match) {
			let offset = match[1];
			// Ensure format is +HH:MM
			if (!offset.includes(":")) {
				offset = offset.replace(/([+-])(\d{1,2})/, "$1$2:00");
			}
			if (offset.length === 3) {
				offset = offset.replace(/([+-])(\d)/, "$10$2");
			}
			return offset;
		}
	}
	return "+00:00";
}

/**
 * Formats a date to DD/MM/YYYY in the specified timezone.
 */
function formatDate(date: Date, timezone: string): string {
	return date.toLocaleDateString("en-AU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: timezone,
	});
}

/**
 * Formats a time to HH:MM AM/PM in the specified timezone.
 */
function formatTime(date: Date, timezone: string): string {
	return date.toLocaleTimeString("en-AU", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: timezone,
	});
}

/**
 * Gets the day of week name in the specified timezone.
 */
function getDayOfWeek(date: Date, timezone: string): string {
	return date.toLocaleDateString("en-AU", {
		weekday: "long",
		timeZone: timezone,
	});
}

/**
 * Gets the month name for a given month number (0-11).
 */
function getMonthName(month: number): string {
	const months = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	];
	return months[month];
}

/**
 * Calculates Australian Financial Year context.
 * Australian FY runs from 1 July to 30 June.
 */
function getFinancialYearContext(
	date: Date,
	timezone: string,
): DateTimeContext["financialYear"] {
	// Get the local date components in the target timezone
	const localDateStr = date.toLocaleDateString("en-AU", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		timeZone: timezone,
	});
	const [day, month, year] = localDateStr.split("/").map(Number);

	// Australian FY: July 1 - June 30
	// If current month is July-December, FY started this calendar year
	// If current month is January-June, FY started last calendar year
	const fyStartYear = month >= 7 ? year : year - 1;
	const fyEndYear = fyStartYear + 1;

	const fyStart = `01/07/${fyStartYear}`;
	const fyEnd = `30/06/${fyEndYear}`;
	const fyCurrent = `${fyStartYear}-${String(fyEndYear).slice(-2)}`;

	// Calculate FY quarter (July-Sep = Q1, Oct-Dec = Q2, Jan-Mar = Q3, Apr-Jun = Q4)
	let quarter: number;
	if (month >= 7 && month <= 9) {
		quarter = 1;
	} else if (month >= 10 && month <= 12) {
		quarter = 2;
	} else if (month >= 1 && month <= 3) {
		quarter = 3;
	} else {
		quarter = 4;
	}

	// Month within FY (July = 1, August = 2, ..., June = 12)
	const monthInFY = month >= 7 ? month - 6 : month + 6;

	return {
		current: fyCurrent,
		startDate: fyStart,
		endDate: fyEnd,
		quarter,
		monthInFY,
	};
}

/**
 * Gets FY quarter date range.
 */
function getFYQuarterRange(
	year: number,
	quarter: number,
): { start: string; end: string; name: string } {
	const quarters: Record<number, { startMonth: number; startDay: number; endMonth: number; endDay: number; name: string }> = {
		1: { startMonth: 7, startDay: 1, endMonth: 9, endDay: 30, name: "Q1" },
		2: { startMonth: 10, startDay: 1, endMonth: 12, endDay: 31, name: "Q2" },
		3: { startMonth: 1, startDay: 1, endMonth: 3, endDay: 31, name: "Q3" },
		4: { startMonth: 4, startDay: 1, endMonth: 6, endDay: 30, name: "Q4" },
	};

	const q = quarters[quarter];
	// For Q3 and Q4, the year is the end year of the FY
	const startYear = quarter <= 2 ? year : year + 1;
	const endYear = startYear;

	const pad = (n: number) => String(n).padStart(2, "0");

	return {
		start: `${pad(q.startDay)}/${pad(q.startMonth)}/${startYear}`,
		end: `${pad(q.endDay)}/${pad(q.endMonth)}/${endYear}`,
		name: `FY${year}-${String(year + 1).slice(-2)} ${q.name}`,
	};
}

/**
 * Calculates relative time context for natural language date references.
 */
function getRelativeContext(
	date: Date,
	timezone: string,
): DateTimeContext["relativeContext"] {
	// Get local date in timezone
	const localDateStr = date.toLocaleDateString("en-AU", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		timeZone: timezone,
	});
	const [, month, year] = localDateStr.split("/").map(Number);

	const pad = (n: number) => String(n).padStart(2, "0");

	// This month
	const thisMonthStart = `01/${pad(month)}/${year}`;
	const lastDayThisMonth = new Date(year, month, 0).getDate();
	const thisMonthEnd = `${pad(lastDayThisMonth)}/${pad(month)}/${year}`;
	const thisMonthName = getMonthName(month - 1);

	// Last month
	const lastMonth = month === 1 ? 12 : month - 1;
	const lastMonthYear = month === 1 ? year - 1 : year;
	const lastDayLastMonth = new Date(lastMonthYear, lastMonth, 0).getDate();
	const lastMonthStart = `01/${pad(lastMonth)}/${lastMonthYear}`;
	const lastMonthEnd = `${pad(lastDayLastMonth)}/${pad(lastMonth)}/${lastMonthYear}`;
	const lastMonthName = getMonthName(lastMonth - 1);

	// Current FY quarter
	const fyContext = getFinancialYearContext(date, timezone);
	const fyStartYear = month >= 7 ? year : year - 1;
	const thisQuarter = getFYQuarterRange(fyStartYear, fyContext.quarter);

	// Last quarter
	let lastQuarterNum = fyContext.quarter - 1;
	let lastQuarterFYYear = fyStartYear;
	if (lastQuarterNum === 0) {
		lastQuarterNum = 4;
		lastQuarterFYYear = fyStartYear - 1;
	}
	const lastQuarter = getFYQuarterRange(lastQuarterFYYear, lastQuarterNum);

	// Last financial year
	const lastFYStartYear = fyStartYear - 1;
	const lastFYEndYear = fyStartYear;
	const lastFY = {
		start: `01/07/${lastFYStartYear}`,
		end: `30/06/${lastFYEndYear}`,
		name: `FY${lastFYStartYear}-${String(lastFYEndYear).slice(-2)}`,
	};

	return {
		lastMonth: { start: lastMonthStart, end: lastMonthEnd, name: lastMonthName },
		thisMonth: { start: thisMonthStart, end: thisMonthEnd, name: thisMonthName },
		lastQuarter,
		thisQuarter,
		lastFinancialYear: lastFY,
	};
}

/**
 * Generates complete date/time context for the specified timezone.
 *
 * @param timezone - IANA timezone identifier (e.g., "Australia/Brisbane")
 * @param referenceDate - Optional date to use (defaults to current date/time)
 * @returns Complete DateTimeContext object for system prompt injection
 *
 * @example
 * const context = getDateTimeContext("Australia/Brisbane");
 * console.log(context.currentDate); // "14/01/2026"
 * console.log(context.financialYear.current); // "2025-26"
 * console.log(context.relativeContext.lastMonth.name); // "December"
 */
export function getDateTimeContext(
	timezone: string = "Australia/Brisbane",
	referenceDate?: Date,
): DateTimeContext {
	const date = referenceDate || new Date();

	return {
		isoTimestamp: date.toISOString(),
		currentDate: formatDate(date, timezone),
		currentTime: formatTime(date, timezone),
		dayOfWeek: getDayOfWeek(date, timezone),
		timezone,
		timezoneAbbreviation: getTimezoneAbbreviation(timezone, date),
		utcOffset: getUTCOffset(date, timezone),
		financialYear: getFinancialYearContext(date, timezone),
		relativeContext: getRelativeContext(date, timezone),
	};
}

/**
 * Formats DateTimeContext as a string suitable for system prompt injection.
 *
 * @param context - DateTimeContext object from getDateTimeContext()
 * @returns Formatted string for system prompt inclusion
 *
 * @example
 * const context = getDateTimeContext("Australia/Brisbane");
 * const promptText = formatDateTimeForPrompt(context);
 * // Outputs:
 * // <datetime_context>
 * // **Current Date & Time:** Tuesday, 14/01/2026 at 10:30 AM AEST (Australia/Brisbane, UTC+10:00)
 * // **Financial Year:** FY2025-26 (01/07/2025 - 30/06/2026), Q3, Month 7
 * // **Relative References:**
 * // - "Last month" = December 2025 (01/12/2025 - 31/12/2025)
 * // ...
 * // </datetime_context>
 */
export function formatDateTimeForPrompt(context: DateTimeContext): string {
	const { financialYear: fy, relativeContext: rel } = context;

	return `<datetime_context>
**Current Date & Time:** ${context.dayOfWeek}, ${context.currentDate} at ${context.currentTime} ${context.timezoneAbbreviation} (${context.timezone}, UTC${context.utcOffset})

**Australian Financial Year:** FY${fy.current} (${fy.startDate} - ${fy.endDate}), Quarter ${fy.quarter}, Month ${fy.monthInFY} of FY

**Relative Date References (for natural language queries):**
- "Last month" = ${rel.lastMonth.name} (${rel.lastMonth.start} - ${rel.lastMonth.end})
- "This month" = ${rel.thisMonth.name} (${rel.thisMonth.start} - ${rel.thisMonth.end})
- "Last quarter" = ${rel.lastQuarter.name} (${rel.lastQuarter.start} - ${rel.lastQuarter.end})
- "This quarter" = ${rel.thisQuarter.name} (${rel.thisQuarter.start} - ${rel.thisQuarter.end})
- "Last financial year" = ${rel.lastFinancialYear.name} (${rel.lastFinancialYear.start} - ${rel.lastFinancialYear.end})
</datetime_context>`;
}

/**
 * Convenience function that generates and formats date/time context in one call.
 *
 * @param timezone - IANA timezone identifier (defaults to "Australia/Brisbane")
 * @returns Formatted string ready for system prompt injection
 */
export function getDateTimePrompt(timezone: string = "Australia/Brisbane"): string {
	return formatDateTimeForPrompt(getDateTimeContext(timezone));
}
