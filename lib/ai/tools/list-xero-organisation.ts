import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroOrganisation = tool({
	description:
		"Retrieves organization details from Xero for the currently connected Xero account. Use this to verify the Xero connection is active and to get basic company information like company name, tax number, base currency, and financial year settings.",
	inputSchema: z.object({}),
	execute: async () => {
		try {
			// Get current organization context from Clerk
			const { userId, orgId } = await auth();

			if (!userId || !orgId) {
				return {
					error: "User must be logged in with an organization context",
					connected: false,
				};
			}

			// Check if Xero is connected for this organization
			const binding = await db.query.integrationTenantBindings.findFirst({
				where: and(
					eq(integrationTenantBindings.clerkOrgId, orgId),
					eq(integrationTenantBindings.provider, "xero"),
					eq(integrationTenantBindings.status, "active"),
				),
			});

			if (!binding) {
				return {
					error:
						"Xero is not connected for this organization. Please connect Xero in Settings > Integrations first.",
					connected: false,
					hint: "Visit /settings/integrations to connect your Xero account",
				};
			}

			if (binding.status === "needs_reauth") {
				return {
					error:
						"Xero connection needs re-authentication. Please reconnect Xero in Settings > Integrations.",
					connected: false,
					needsReauth: true,
				};
			}

			// Use retry helper to handle token refresh on 401 errors
			return await withTokenRefreshRetry(
				userId,
				binding.id,
				orgId,
				async (client) => {
					// Fetch organisation details from Xero
				const response = await client.fetch("/Organisation");

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to fetch organization details from Xero: ${errorText}`,
						connected: true,
						apiError: true,
					};
				}

				const data = await response.json();
				const org = data.Organisations?.[0];

				if (!org) {
					return {
						error: "No organization data returned from Xero",
						connected: true,
					};
				}

				// Format and return organization details
				return {
					connected: true,
					organisationID: org.OrganisationID,
					name: org.Name,
					legalName: org.LegalName,
					taxNumber: org.TaxNumber,
					registrationNumber: org.RegistrationNumber,
					baseCurrency: org.BaseCurrency,
					countryCode: org.CountryCode,
					isDemoCompany: org.IsDemoCompany,
					organisationType: org.OrganisationType,
					financialYearEndDay: org.FinancialYearEndDay,
					financialYearEndMonth: org.FinancialYearEndMonth,
					salesTaxBasis: org.SalesTaxBasis,
					salesTaxPeriod: org.SalesTaxPeriod,
					version: org.Version,
					createdDateUTC: org.CreatedDateUTC,
					shortCode: org.ShortCode,
					tenantBindingId: binding.id,
					externalTenantName: binding.externalTenantName,
					message:
						"Xero connection is active and working. You can now query invoices, contacts, reports, and other Xero data.",
				};
			});
		} catch (error) {
			return {
				...handleXeroToolError(error, {
					toolName: "listXeroOrganisation",
					operation: "fetching organization details",
				}),
				connected: false,
			};
		}
	},
});
