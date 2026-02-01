"use server";

import "server-only";

import { generateText } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { billCommentaryPrompt } from "@/lib/ai/prompts-ap";
import { getLanguageModel } from "@/lib/ai/providers";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
	xeroBills,
	xeroSuppliers,
} from "@/lib/db/schema";
import { aggregateVendorRisk, calculateVendorRisk } from "./risk-scoring";

const uuidSchema = z.string().uuid();

export async function generateBillCommentary(
	vendorName: string,
	lineItemsSummary: string,
	amount: string,
	dueDate: string,
) {
	const model = getLanguageModel(DEFAULT_CHAT_MODEL);

	const { text } = await generateText({
		model,
		prompt: billCommentaryPrompt(vendorName, lineItemsSummary, amount, dueDate),
		temperature: 0.3,
	});

	return text;
}

export async function getVendorDetails(supplierId: string) {
	const { orgId } = await auth();
	if (!orgId) return null;

	const validation = uuidSchema.safeParse(supplierId);
	if (!validation.success) {
		throw new Error("Invalid supplier ID format");
	}

	const binding = await db.query.integrationTenantBindings.findFirst({
		where: (t, { and, eq }) =>
			and(
				eq(t.clerkOrgId, orgId),
				eq(t.status, "active"),
				eq(t.provider, "xero"),
			),
	});
	if (!binding) return null;

	const supplier = await db.query.xeroSuppliers.findFirst({
		where: (t, { and, eq }) =>
			and(eq(t.id, supplierId), eq(t.xeroTenantId, binding.externalTenantId)),
	});

	if (!supplier) return null;

	const bills = await db.query.xeroBills.findMany({
		where: (t, { and, eq }) =>
			and(
				eq(t.supplierId, supplierId),
				eq(t.xeroTenantId, binding.externalTenantId),
			),
		orderBy: (t, { desc }) => [desc(t.date)],
	});

	// Calculate risk for each unpaid bill
	const billRisks = bills
		.filter((b) => Number(b.amountDue) > 0)
		.map((bill) =>
			calculateVendorRisk({
				taxNumber: supplier.taxNumber,
				invoiceNumber: bill.invoiceNumber,
				billStatus: bill.status,
				contactStatus: supplier.contactStatus,
				supplierBankAccount: supplier.bankAccountNumber,
				billBankAccount: bill.billBankAccountNumber,
			}),
		);

	// Aggregate risk across all unpaid bills
	const vendorRisk =
		billRisks.length > 0
			? aggregateVendorRisk(billRisks)
			: {
					riskScore: 0,
					riskLevel: "Low" as const,
					hasBankChange: false,
					riskFactors: [],
				};

	return {
		supplier,
		bills: bills.map((b) => ({
			...b,
			amountDue: Number(b.amountDue),
			amountPaid: Number(b.amountPaid),
			total: Number(b.total),
		})),
		riskScore: vendorRisk.riskScore,
		riskLevel: vendorRisk.riskLevel,
		hasBankChange: vendorRisk.hasBankChange,
		riskFactors: vendorRisk.riskFactors,
	};
}
