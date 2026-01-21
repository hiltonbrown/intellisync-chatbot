import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const listXeroContacts = tool({
	description:
		"Lists contacts (customers and suppliers) from Xero. Use this when the user asks about customers, suppliers, contacts, or needs contact IDs for creating invoices. Supports search and pagination.",
	inputSchema: z.object({
		page: z
			.number()
			.int()
			.min(1)
			.optional()
			.describe(
				"Page number for pagination (default: 1). Each page returns up to 100 contacts.",
			),
		searchTerm: z
			.string()
			.optional()
			.describe(
				"Search term to filter contacts by name, email, or contact number. Case-insensitive partial match.",
			),
		includeArchived: z
			.boolean()
			.optional()
			.describe("Include archived contacts in the results (default: false)."),
	}),
	execute: async ({ page = 1, searchTerm, includeArchived = false }) => {
		try {
			// Get current organization context from Clerk
			const { userId, orgId } = await auth();

			if (!userId || !orgId) {
				return {
					error: "User must be logged in with an organization context",
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
						"Xero is not connected. Please connect Xero in Settings > Integrations first.",
					hint: "Visit /settings/integrations to connect your Xero account",
				};
			}

			// Use retry helper to handle token refresh on 401 errors
			return await withTokenRefreshRetry(
				userId,
				binding.id,
				orgId,
				async (client) => {
					// Build query parameters
				const params = new URLSearchParams();
				params.append("page", page.toString());

				if (searchTerm) {
					// Xero uses a where clause for searching
					const searchWhere = `Name.Contains("${searchTerm}") OR EmailAddress.Contains("${searchTerm}") OR ContactNumber.Contains("${searchTerm}")`;
					params.append("where", searchWhere);
				}

				if (!includeArchived) {
					const statusWhere = `ContactStatus=="ACTIVE"`;
					const existingWhere = params.get("where");
					params.set(
						"where",
						existingWhere ? `${existingWhere} AND ${statusWhere}` : statusWhere,
					);
				}

				const queryString = params.toString();
				const endpoint = `/Contacts${queryString ? `?${queryString}` : ""}`;

				// Fetch contacts from Xero
				const response = await client.fetch(endpoint);

				if (!response.ok) {
					const errorText = await response.text();
					return {
						error: `Failed to fetch contacts from Xero: ${errorText}`,
					};
				}

				const data = await response.json();
				const contacts = data.Contacts || [];

				// Format contacts for better readability
				const formattedContacts = contacts.map((contact: any) => ({
					contactID: contact.ContactID,
					name: contact.Name,
					contactNumber: contact.ContactNumber,
					accountNumber: contact.AccountNumber,
					contactStatus: contact.ContactStatus,
					firstName: contact.FirstName,
					lastName: contact.LastName,
					emailAddress: contact.EmailAddress,
					isSupplier: contact.IsSupplier,
					isCustomer: contact.IsCustomer,
					defaultCurrency: contact.DefaultCurrency,
					phones: contact.Phones?.map((phone: any) => ({
						type: phone.PhoneType,
						number: phone.PhoneNumber,
						areaCode: phone.PhoneAreaCode,
						countryCode: phone.PhoneCountryCode,
					})),
					addresses: contact.Addresses?.map((address: any) => ({
						type: address.AddressType,
						line1: address.AddressLine1,
						line2: address.AddressLine2,
						line3: address.AddressLine3,
						line4: address.AddressLine4,
						city: address.City,
						region: address.Region,
						postalCode: address.PostalCode,
						country: address.Country,
					})),
					taxNumber: contact.TaxNumber,
					accountsReceivableTaxType: contact.AccountsReceivableTaxType,
					accountsPayableTaxType: contact.AccountsPayableTaxType,
					contactGroups: contact.ContactGroups?.map((group: any) => group.Name),
					hasAttachments: contact.HasAttachments,
					updatedDateUTC: contact.UpdatedDateUTC,
				}));

				return {
					success: true,
					totalContacts: formattedContacts.length,
					page,
					contacts: formattedContacts,
					hasMore: formattedContacts.length === 100,
					summary: `Retrieved ${formattedContacts.length} contact${formattedContacts.length === 1 ? "" : "s"}${searchTerm ? ` matching "${searchTerm}"` : ""}. ${formattedContacts.length === 100 ? "There may be more contacts - use page parameter to get the next page." : ""}`,
				};
			});
		} catch (error) {
			return handleXeroToolError(error, {
				toolName: "listXeroContacts",
				operation: "fetching contacts",
			});
		}
	},
});
