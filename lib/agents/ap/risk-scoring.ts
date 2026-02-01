import "server-only";

/**
 * AP Risk Scoring System
 *
 * Calculates vendor risk based on multiple factors:
 * - Missing ABN/Tax Number: +25 points
 * - Missing Tax Invoice Number: +20 points
 * - Unapproved Bill (not AUTHORISED): +30 points
 * - Blocked Supplier (ARCHIVED/GDPRREQUEST): +60 points
 *
 * Risk Levels:
 * - Low: 0-19
 * - Medium: 20-44
 * - High: 45-69
 * - Critical: ≥70
 *
 * Bank Change Detection:
 * Separate flag if bill bank account differs from supplier's stored bank account.
 * NOTE: Due to Xero API limitations, bank account names are not available,
 * only account numbers can be compared.
 */

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface VendorRiskResult {
	riskScore: number;
	riskLevel: RiskLevel;
	hasBankChange: boolean;
	riskFactors: string[]; // Human-readable list of risk factors
}

/**
 * Detect if bank account has changed between supplier record and bill
 */
export function detectBankAccountChange(
	supplierBankAccount: string | null,
	billBankAccount: string | null,
): boolean {
	// If both are null or undefined, no change
	if (!supplierBankAccount && !billBankAccount) {
		return false;
	}

	// If only one is null, that's a change
	if (!supplierBankAccount || !billBankAccount) {
		return true;
	}

	// Compare account numbers (case-insensitive, trimmed)
	return (
		supplierBankAccount.trim().toLowerCase() !==
		billBankAccount.trim().toLowerCase()
	);
}

/**
 * Calculate risk level from score
 */
function getRiskLevel(score: number): RiskLevel {
	if (score >= 70) return "Critical";
	if (score >= 45) return "High";
	if (score >= 20) return "Medium";
	return "Low";
}

/**
 * Calculate vendor risk score and level for a single bill
 */
export function calculateVendorRisk(params: {
	taxNumber: string | null;
	invoiceNumber: string | null;
	billStatus: string | null;
	contactStatus: string | null;
	supplierBankAccount: string | null;
	billBankAccount: string | null;
}): VendorRiskResult {
	const {
		taxNumber,
		invoiceNumber,
		billStatus,
		contactStatus,
		supplierBankAccount,
		billBankAccount,
	} = params;

	let score = 0;
	const riskFactors: string[] = [];

	// Missing ABN/Tax Number: +25 points
	if (!taxNumber) {
		score += 25;
		riskFactors.push("Missing ABN/Tax Number");
	}

	// Missing Tax Invoice Number: +20 points
	if (!invoiceNumber) {
		score += 20;
		riskFactors.push("Missing Tax Invoice Number");
	}

	// Unapproved Bill: +30 points
	// Only AUTHORISED and PAID are considered approved
	if (billStatus && billStatus !== "AUTHORISED" && billStatus !== "PAID") {
		score += 30;
		riskFactors.push(`Unapproved Bill (${billStatus})`);
	}

	// Blocked Supplier: +60 points
	if (contactStatus === "ARCHIVED" || contactStatus === "GDPRREQUEST") {
		score += 60;
		riskFactors.push(`Blocked Supplier (${contactStatus})`);
	}

	// Bank account change detection (separate flag, not part of score)
	const hasBankChange = detectBankAccountChange(
		supplierBankAccount,
		billBankAccount,
	);

	if (hasBankChange) {
		riskFactors.push("Bank Account Changed");
	}

	// Cap score at 100
	const finalScore = Math.min(score, 100);
	const riskLevel = getRiskLevel(finalScore);

	return {
		riskScore: finalScore,
		riskLevel,
		hasBankChange,
		riskFactors,
	};
}

/**
 * Aggregate risk across multiple bills for a vendor
 * Uses the highest risk score found across all bills
 */
export function aggregateVendorRisk(
	billRisks: VendorRiskResult[],
): VendorRiskResult {
	if (billRisks.length === 0) {
		return {
			riskScore: 0,
			riskLevel: "Low",
			hasBankChange: false,
			riskFactors: [],
		};
	}

	// Use the highest risk score across all bills
	const maxRisk = billRisks.reduce((max, current) =>
		current.riskScore > max.riskScore ? current : max,
	);

	// Combine all unique risk factors
	const allFactors = new Set<string>();
	for (const risk of billRisks) {
		for (const factor of risk.riskFactors) {
			allFactors.add(factor);
		}
	}

	// Check if any bill has a bank change
	const anyBankChange = billRisks.some((r) => r.hasBankChange);

	return {
		riskScore: maxRisk.riskScore,
		riskLevel: maxRisk.riskLevel,
		hasBankChange: anyBankChange,
		riskFactors: Array.from(allFactors),
	};
}
