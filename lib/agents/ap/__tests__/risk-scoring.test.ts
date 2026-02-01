import { describe, expect, it } from "@jest/globals";
import {
	aggregateVendorRisk,
	calculateVendorRisk,
	detectBankAccountChange,
} from "../risk-scoring";

describe("AP Risk Scoring", () => {
	describe("detectBankAccountChange", () => {
		it("should return false when both accounts are null", () => {
			expect(detectBankAccountChange(null, null)).toBe(false);
		});

		it("should return true when only supplier account is null", () => {
			expect(detectBankAccountChange(null, "123456")).toBe(true);
		});

		it("should return true when only bill account is null", () => {
			expect(detectBankAccountChange("123456", null)).toBe(true);
		});

		it("should return false when accounts match", () => {
			expect(detectBankAccountChange("123456", "123456")).toBe(false);
		});

		it("should return false when accounts match (case-insensitive)", () => {
			expect(detectBankAccountChange("ABC123", "abc123")).toBe(false);
		});

		it("should return false when accounts match (with whitespace)", () => {
			expect(detectBankAccountChange(" 123456 ", "123456")).toBe(false);
		});

		it("should return true when accounts differ", () => {
			expect(detectBankAccountChange("123456", "789012")).toBe(true);
		});
	});

	describe("calculateVendorRisk", () => {
		it("should return zero risk when all factors present and valid", () => {
			const result = calculateVendorRisk({
				taxNumber: "12345678901",
				invoiceNumber: "INV-001",
				billStatus: "AUTHORISED",
				contactStatus: "ACTIVE",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});

			expect(result.riskScore).toBe(0);
			expect(result.riskLevel).toBe("Low");
			expect(result.hasBankChange).toBe(false);
			expect(result.riskFactors).toHaveLength(0);
		});

		it("should add 25 points for missing ABN", () => {
			const result = calculateVendorRisk({
				taxNumber: null,
				invoiceNumber: "INV-001",
				billStatus: "AUTHORISED",
				contactStatus: "ACTIVE",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});

			expect(result.riskScore).toBe(25);
			expect(result.riskLevel).toBe("Medium");
			expect(result.riskFactors).toContain("Missing ABN/Tax Number");
		});

		it("should add 20 points for missing invoice number", () => {
			const result = calculateVendorRisk({
				taxNumber: "12345678901",
				invoiceNumber: null,
				billStatus: "AUTHORISED",
				contactStatus: "ACTIVE",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});

			expect(result.riskScore).toBe(20);
			expect(result.riskLevel).toBe("Medium");
			expect(result.riskFactors).toContain("Missing Tax Invoice Number");
		});

		it("should add 30 points for unapproved bill", () => {
			const result = calculateVendorRisk({
				taxNumber: "12345678901",
				invoiceNumber: "INV-001",
				billStatus: "DRAFT",
				contactStatus: "ACTIVE",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});

			expect(result.riskScore).toBe(30);
			expect(result.riskLevel).toBe("Medium");
			expect(result.riskFactors).toContain("Unapproved Bill (DRAFT)");
		});

		it("should add 60 points for blocked supplier (ARCHIVED)", () => {
			const result = calculateVendorRisk({
				taxNumber: "12345678901",
				invoiceNumber: "INV-001",
				billStatus: "AUTHORISED",
				contactStatus: "ARCHIVED",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});

			expect(result.riskScore).toBe(60);
			expect(result.riskLevel).toBe("High");
			expect(result.riskFactors).toContain("Blocked Supplier (ARCHIVED)");
		});

		it("should add 60 points for blocked supplier (GDPRREQUEST)", () => {
			const result = calculateVendorRisk({
				taxNumber: "12345678901",
				invoiceNumber: "INV-001",
				billStatus: "AUTHORISED",
				contactStatus: "GDPRREQUEST",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});

			expect(result.riskScore).toBe(60);
			expect(result.riskLevel).toBe("High");
			expect(result.riskFactors).toContain("Blocked Supplier (GDPRREQUEST)");
		});

		it("should detect bank account change", () => {
			const result = calculateVendorRisk({
				taxNumber: "12345678901",
				invoiceNumber: "INV-001",
				billStatus: "AUTHORISED",
				contactStatus: "ACTIVE",
				supplierBankAccount: "123456",
				billBankAccount: "789012",
			});

			expect(result.hasBankChange).toBe(true);
			expect(result.riskFactors).toContain("Bank Account Changed");
			// Bank change doesn't affect score
			expect(result.riskScore).toBe(0);
		});

		it("should calculate Critical risk for multiple missing factors", () => {
			const result = calculateVendorRisk({
				taxNumber: null,
				invoiceNumber: null,
				billStatus: "DRAFT",
				contactStatus: "ARCHIVED",
				supplierBankAccount: "123456",
				billBankAccount: "789012",
			});

			// 25 (no ABN) + 20 (no invoice) + 30 (unapproved) + 60 (blocked) = 135
			expect(result.riskScore).toBe(100); // Capped at 100
			expect(result.riskLevel).toBe("Critical");
			expect(result.hasBankChange).toBe(true);
			expect(result.riskFactors.length).toBeGreaterThan(3);
		});

		it("should categorize risk levels correctly", () => {
			const low = calculateVendorRisk({
				taxNumber: "12345678901",
				invoiceNumber: "INV-001",
				billStatus: "AUTHORISED",
				contactStatus: "ACTIVE",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});
			expect(low.riskLevel).toBe("Low"); // 0-19

			const medium = calculateVendorRisk({
				taxNumber: null,
				invoiceNumber: "INV-001",
				billStatus: "AUTHORISED",
				contactStatus: "ACTIVE",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});
			expect(medium.riskLevel).toBe("Medium"); // 20-44

			const high = calculateVendorRisk({
				taxNumber: null,
				invoiceNumber: null,
				billStatus: "AUTHORISED",
				contactStatus: "ARCHIVED",
				supplierBankAccount: "123456",
				billBankAccount: "123456",
			});
			expect(high.riskLevel).toBe("Critical"); // 70+
		});
	});

	describe("aggregateVendorRisk", () => {
		it("should return zero risk for empty array", () => {
			const result = aggregateVendorRisk([]);
			expect(result.riskScore).toBe(0);
			expect(result.riskLevel).toBe("Low");
			expect(result.hasBankChange).toBe(false);
		});

		it("should use highest risk score", () => {
			const risks = [
				{
					riskScore: 25,
					riskLevel: "Medium" as const,
					hasBankChange: false,
					riskFactors: ["Missing ABN/Tax Number"],
				},
				{
					riskScore: 60,
					riskLevel: "High" as const,
					hasBankChange: false,
					riskFactors: ["Blocked Supplier (ARCHIVED)"],
				},
				{
					riskScore: 20,
					riskLevel: "Medium" as const,
					hasBankChange: false,
					riskFactors: ["Missing Tax Invoice Number"],
				},
			];

			const result = aggregateVendorRisk(risks);
			expect(result.riskScore).toBe(60);
			expect(result.riskLevel).toBe("High");
		});

		it("should combine unique risk factors", () => {
			const risks = [
				{
					riskScore: 25,
					riskLevel: "Medium" as const,
					hasBankChange: false,
					riskFactors: ["Missing ABN/Tax Number", "Missing Tax Invoice Number"],
				},
				{
					riskScore: 20,
					riskLevel: "Medium" as const,
					hasBankChange: false,
					riskFactors: ["Missing Tax Invoice Number"],
				},
			];

			const result = aggregateVendorRisk(risks);
			expect(result.riskFactors).toHaveLength(2);
			expect(result.riskFactors).toContain("Missing ABN/Tax Number");
			expect(result.riskFactors).toContain("Missing Tax Invoice Number");
		});

		it("should detect bank change if any bill has it", () => {
			const risks = [
				{
					riskScore: 0,
					riskLevel: "Low" as const,
					hasBankChange: false,
					riskFactors: [],
				},
				{
					riskScore: 0,
					riskLevel: "Low" as const,
					hasBankChange: true,
					riskFactors: ["Bank Account Changed"],
				},
			];

			const result = aggregateVendorRisk(risks);
			expect(result.hasBankChange).toBe(true);
		});
	});
});
