import { tool } from "ai";
import { z } from "zod";

interface ABNResponse {
	Abn?: string;
	AbnStatus?: string;
	AbnStatusEffectiveFrom?: string;
	EntityName?: string;
	EntityTypeCode?: string;
	EntityTypeName?: string;
	Gst?: string;
	GstStatusEffectiveFrom?: string;
	AddressPostcode?: string;
	AddressState?: string;
	BusinessName?: Array<{
		OrganisationName?: string;
		EffectiveFrom?: string;
		EffectiveTo?: string;
	}>;
	DgrStatus?: string;
	Message?: string;
}

async function lookupABN(abn: string): Promise<ABNResponse | null> {
	try {
		const guid = process.env.ABN_LOOKUP_GUID;
		const baseUrl =
			process.env.ABN_LOOKUP_BASE_URL || "https://abr.business.gov.au/json";

		if (!guid) {
			throw new Error("ABN Lookup not configured - missing GUID");
		}

		// Clean ABN (remove spaces)
		const cleanABN = abn.replace(/\s/g, "");

		// Call ABN Lookup API
		const response = await fetch(
			`${baseUrl}/AbnDetails.aspx?abn=${cleanABN}&guid=${guid}`,
		);

		if (!response.ok) {
			return null;
		}

		// Handle JSONP response format (callback(...))
		const text = await response.text();

		// Strip callback wrapper if present
		// API returns: callback({ ... })
		const jsonStr = text.replace(/^callback\((.*)\)$/, "$1");

		let data: ABNResponse;
		try {
			data = JSON.parse(jsonStr);
		} catch (e) {
			console.error("Failed to parse ABN response:", e);
			return null;
		}

		// Check for API errors or invalid ABN
		if (data.Message || !data.Abn) {
			return null;
		}

		return data;
	} catch (error) {
		console.error("ABN lookup error:", error);
		return null;
	}
}

export const getABNDetails = tool({
	description:
		"Look up Australian Business Number (ABN) details including business name, registration status, and GST information. Provides official data from the Australian Business Register (ABR).",
	inputSchema: z.object({
		abn: z
			.string()
			.describe(
				"The 11-digit Australian Business Number (ABN) to look up. Can include spaces (e.g., '51 824 753 556' or '51824753556').",
			)
			.regex(
				/^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/,
				"Must be a valid 11-digit ABN format",
			),
	}),
	needsApproval: true,
	execute: async ({ abn }) => {
		// Check if ABN Lookup is enabled
		if (process.env.ABN_LOOKUP_ENABLED !== "true") {
			return {
				error:
					"ABN Lookup is not currently enabled. Please contact support for assistance.",
			};
		}

		// Validate configuration
		if (!process.env.ABN_LOOKUP_GUID) {
			return {
				error:
					"ABN Lookup is not configured. Please contact support to enable this feature.",
			};
		}

		const abnData = await lookupABN(abn);

		if (!abnData) {
			return {
				error: `Could not retrieve details for ABN "${abn}". Please verify the ABN is correct and try again.`,
			};
		}

		// Extract current business names (exclude expired ones)
		const currentBusinessNames = abnData.BusinessName
			? abnData.BusinessName.filter(
					(bn) => !bn.EffectiveTo || new Date(bn.EffectiveTo) > new Date(),
				)
					.map((bn) => bn.OrganisationName)
					.filter((name): name is string => !!name)
			: [];

		// Determine GST registration status
		// API returns a date string (e.g. "2000-07-01") if registered, or null if not.
		const gstRegistered = !!abnData.Gst;

		// Format the response
		return {
			abn: abnData.Abn,
			status: abnData.AbnStatus || "Unknown",
			statusEffectiveFrom: abnData.AbnStatusEffectiveFrom,
			entityName: abnData.EntityName,
			entityType: abnData.EntityTypeName || abnData.EntityTypeCode,
			gstRegistered,
			gstFromDate: gstRegistered ? abnData.Gst : undefined,
			businessAddress: {
				postcode: abnData.AddressPostcode,
				state: abnData.AddressState,
			},
			registeredBusinessNames: currentBusinessNames,
			source: "Australian Business Register (ABR)",
			retrievedAt: new Date().toISOString(),
		};
	},
});
