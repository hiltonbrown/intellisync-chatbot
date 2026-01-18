import type { XeroApiClient } from "../adapter";
import type {
	XeroReportProfitLoss,
	XeroReportBalanceSheet,
	XeroReportTrialBalance,
	XeroReportAgedReceivables,
} from "../types";

export interface ReportOptions {
	fromDate?: string; // YYYY-MM-DD
	toDate?: string; // YYYY-MM-DD
	date?: string; // YYYY-MM-DD
	periods?: number;
	timeframe?:
		| "MONTH"
		| "QUARTER"
		| "YEAR";
	trackingOptionID1?: string;
	trackingOptionID2?: string;
	standardLayout?: boolean;
	paymentsOnly?: boolean;
}

/**
 * Get Profit & Loss report
 */
export async function getProfitLoss(
	client: XeroApiClient,
	options?: ReportOptions,
): Promise<XeroReportProfitLoss> {
	const params = new URLSearchParams();

	if (options?.fromDate) {
		params.set("fromDate", options.fromDate);
	}

	if (options?.toDate) {
		params.set("toDate", options.toDate);
	}

	if (options?.periods) {
		params.set("periods", options.periods.toString());
	}

	if (options?.timeframe) {
		params.set("timeframe", options.timeframe);
	}

	if (options?.trackingOptionID1) {
		params.set("trackingOptionID1", options.trackingOptionID1);
	}

	if (options?.trackingOptionID2) {
		params.set("trackingOptionID2", options.trackingOptionID2);
	}

	if (options?.standardLayout !== undefined) {
		params.set("standardLayout", options.standardLayout.toString());
	}

	if (options?.paymentsOnly !== undefined) {
		params.set("paymentsOnly", options.paymentsOnly.toString());
	}

	const path = `/Reports/ProfitAndLoss${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch Profit & Loss report: ${error}`);
	}

	const data = await response.json();
	return data.Reports?.[0] || data;
}

/**
 * Get Balance Sheet report
 */
export async function getBalanceSheet(
	client: XeroApiClient,
	options?: ReportOptions,
): Promise<XeroReportBalanceSheet> {
	const params = new URLSearchParams();

	if (options?.date) {
		params.set("date", options.date);
	}

	if (options?.periods) {
		params.set("periods", options.periods.toString());
	}

	if (options?.timeframe) {
		params.set("timeframe", options.timeframe);
	}

	if (options?.trackingOptionID1) {
		params.set("trackingOptionID1", options.trackingOptionID1);
	}

	if (options?.trackingOptionID2) {
		params.set("trackingOptionID2", options.trackingOptionID2);
	}

	if (options?.standardLayout !== undefined) {
		params.set("standardLayout", options.standardLayout.toString());
	}

	if (options?.paymentsOnly !== undefined) {
		params.set("paymentsOnly", options.paymentsOnly.toString());
	}

	const path = `/Reports/BalanceSheet${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch Balance Sheet report: ${error}`);
	}

	const data = await response.json();
	return data.Reports?.[0] || data;
}

/**
 * Get Trial Balance report
 */
export async function getTrialBalance(
	client: XeroApiClient,
	options?: { date?: string },
): Promise<XeroReportTrialBalance> {
	const params = new URLSearchParams();

	if (options?.date) {
		params.set("date", options.date);
	}

	const path = `/Reports/TrialBalance${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch Trial Balance report: ${error}`);
	}

	const data = await response.json();
	return data.Reports?.[0] || data;
}

/**
 * Get Aged Receivables report (Debtors)
 */
export async function getAgedReceivables(
	client: XeroApiClient,
	options?: { date?: string; fromDate?: string; toDate?: string },
): Promise<XeroReportAgedReceivables> {
	const params = new URLSearchParams();

	if (options?.date) {
		params.set("date", options.date);
	}

	if (options?.fromDate) {
		params.set("fromDate", options.fromDate);
	}

	if (options?.toDate) {
		params.set("toDate", options.toDate);
	}

	const path = `/Reports/AgedReceivablesByContact${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch Aged Receivables report: ${error}`);
	}

	const data = await response.json();
	return data.Reports?.[0] || data;
}

/**
 * Get Aged Payables report (Creditors)
 */
export async function getAgedPayables(
	client: XeroApiClient,
	options?: { date?: string; fromDate?: string; toDate?: string },
): Promise<XeroReportAgedReceivables> {
	const params = new URLSearchParams();

	if (options?.date) {
		params.set("date", options.date);
	}

	if (options?.fromDate) {
		params.set("fromDate", options.fromDate);
	}

	if (options?.toDate) {
		params.set("toDate", options.toDate);
	}

	const path = `/Reports/AgedPayablesByContact${params.toString() ? `?${params}` : ""}`;
	const response = await client.fetch(path);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch Aged Payables report: ${error}`);
	}

	const data = await response.json();
	return data.Reports?.[0] || data;
}
