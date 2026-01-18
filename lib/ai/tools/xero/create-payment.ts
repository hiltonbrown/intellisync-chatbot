import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { z } from "zod";
import { TokenService } from "@/lib/integrations/token-service";
import { createPayment } from "@/lib/integrations/xero/operations";
import { getActiveTenantBinding } from "@/lib/db/queries";

export const createXeroPayment = tool({
	description:
		"Record a payment against an invoice in Xero accounting system. Requires user approval before execution.",
	inputSchema: z.object({
		invoiceID: z.string().describe("Xero Invoice ID to pay"),
		accountID: z
			.string()
			.describe("Xero Account ID (bank account) the payment is from/to"),
		amount: z.number().describe("Payment amount"),
		date: z
			.string()
			.optional()
			.describe("Payment date in YYYY-MM-DD format (default: today)"),
		reference: z.string().optional().describe("Payment reference"),
	}),
	needsApproval: true, // ⚠️ Write operation - requires user approval
	execute: async (input) => {
		try {
			// 1. Get current organization context
			const { userId, orgId } = await auth();

			if (!userId || !orgId) {
				return {
					error: "User must be authenticated with organization context",
				};
			}

			// 2. Check if Xero integration is active
			const tenantBinding = await getActiveTenantBinding({
				clerkOrgId: orgId,
				provider: "xero",
			});

			if (!tenantBinding) {
				return {
					error:
						"Xero integration not connected. Please connect Xero in Settings > Integrations.",
				};
			}

			// 3. Get authenticated client
			const client = await TokenService.getClientForTenantBinding(
				tenantBinding.id,
			);

			// 4. Build payment object
			const paymentData = {
				Invoice: { InvoiceID: input.invoiceID },
				Account: { AccountID: input.accountID },
				Amount: input.amount,
				Date: input.date || new Date().toISOString().split("T")[0],
				Reference: input.reference,
			};

			// 5. Call Xero API
			const payment = await createPayment(client, paymentData);

			return {
				success: true,
				tenantName: tenantBinding.externalTenantName,
				payment: {
					paymentID: payment.PaymentID,
					amount: payment.Amount,
					date: payment.Date,
					reference: payment.Reference,
					status: payment.Status,
				},
				message: `Payment of ${input.amount} recorded successfully in Xero`,
			};
		} catch (error: unknown) {
			console.error("Failed to create Xero payment:", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			if (errorMessage.includes("401")) {
				return {
					error:
						"Xero authorization expired. Please reconnect in Settings > Integrations.",
				};
			}

			return { error: `Failed to create payment: ${errorMessage}` };
		}
	},
});
