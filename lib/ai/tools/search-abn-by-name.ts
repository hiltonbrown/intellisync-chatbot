import { tool } from "ai";
import { z } from "zod";

interface NameSearchResult {
	Abn?: string;
	AbnStatus?: string;
	IsCurrent?: boolean;
	Name?: string;
	NameType?: string;
	Postcode?: string;
	Score?: number;
	State?: string;
}

interface NameSearchResponse {
	Message?: string;
	Names?: NameSearchResult[];
}

async function searchABNByNameAPI(
	name: string,
	maxResults: number,
): Promise<NameSearchResponse | null> {
	try {
		const guid = process.env.ABN_LOOKUP_GUID;
		const baseUrl =
			process.env.ABN_LOOKUP_BASE_URL || "https://abr.business.gov.au/json";

		if (!guid) {
			throw new Error("ABN Lookup not configured - missing GUID");
		}

		// URL encode the search name
		const encodedName = encodeURIComponent(name);

		// Call ABN Lookup API - MatchingNames endpoint
		const response = await fetch(
			`${baseUrl}/MatchingNames.aspx?name=${encodedName}&maxResults=${maxResults}&guid=${guid}&callback=callback`,
		);

		if (!response.ok) {
			return null;
		}

		// Handle JSONP response
		const text = await response.text();
		const jsonp = text.replace(/^callback\(|\)$/g, "");
		const data = JSON.parse(jsonp);

		return data;
	} catch (error) {
		console.error("ABN name search error:", error);
		return null;
	}
}

export const searchABNByName = tool({
	description:
		"Search for Australian Business Numbers (ABNs) by company or organisation name. Returns a list of matching businesses from the Australian Business Register (ABR). Use this tool when a user wants to find an ABN for a business but doesn't know the exact ABN number.",
	inputSchema: z.object({
		name: z
			.string()
			.min(2)
			.describe(
				"The business or organisation name to search for. Can be a partial name (e.g., 'Commonwealth Bank' or 'Telstra').",
			),
		maxResults: z
			.number()
			.int()
			.min(1)
			.max(20)
			.default(10)
			.describe("Maximum number of results to return (1-20). Defaults to 10."),
	}),
	needsApproval: true,
	execute: async ({ name, maxResults = 10 }) => {
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

		const searchResult = await searchABNByNameAPI(name, maxResults);

		if (!searchResult) {
			return {
				error: `Could not search for businesses matching "${name}". Please try again later.`,
			};
		}

		// Check for API errors
		if (searchResult.Message) {
			return {
				error: `Search error: ${searchResult.Message}`,
			};
		}

		// Check for no results
		if (!searchResult.Names || searchResult.Names.length === 0) {
			return {
				results: [],
				message: `No businesses found matching "${name}". Try a different search term or check the spelling.`,
				source: "Australian Business Register (ABR)",
				retrievedAt: new Date().toISOString(),
			};
		}

		// Sort by score (highest first) and format results
		const sortedResults = searchResult.Names.sort(
			(a, b) => (b.Score ?? 0) - (a.Score ?? 0),
		);

		const formattedResults = sortedResults.map((result) => ({
			abn: result.Abn,
			name: result.Name,
			nameType: result.NameType,
			status: result.AbnStatus || "Unknown",
			isCurrent: result.IsCurrent ?? true,
			state: result.State,
			postcode: result.Postcode,
			matchScore: result.Score,
		}));

		return {
			results: formattedResults,
			totalFound: formattedResults.length,
			searchTerm: name,
			source: "Australian Business Register (ABR)",
			retrievedAt: new Date().toISOString(),
			hint: "Use the getABNDetails tool with a specific ABN from these results to get full business details including GST registration status.",
		};
	},
});
