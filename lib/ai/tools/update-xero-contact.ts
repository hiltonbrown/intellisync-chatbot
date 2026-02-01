import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const updateXeroContact = tool({
	description: "Updates an existing contact in Xero.",
	inputSchema: z.object({
		contactID: z.string().describe("Xero Contact ID"),
		name: z.string().optional(),
		email: z.string().email().optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		phone: z.string().optional(),
		isCustomer: z.boolean().optional(),
		isSupplier: z.boolean().optional(),
		status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
	}),
	execute: async ({ contactID, name, email, firstName, lastName, phone, isCustomer, isSupplier, status }) => {
		try {
			const { userId, orgId } = await auth();
			if (!userId || !orgId) return { error: "Unauthorized" };

			const binding = await db.query.integrationTenantBindings.findFirst({
				where: and(
					eq(integrationTenantBindings.clerkOrgId, orgId),
					eq(integrationTenantBindings.provider, "xero"),
					eq(integrationTenantBindings.status, "active"),
				),
			});
			if (!binding) return { error: "Xero not connected" };

			return await withTokenRefreshRetry(binding.id, orgId, async (client) => {
				const contactData = {
					ContactID: contactID,
					Name: name,
					EmailAddress: email,
					FirstName: firstName,
					LastName: lastName,
					Phones: phone ? [{ PhoneType: "DEFAULT", PhoneNumber: phone }] : undefined,
					IsCustomer: isCustomer,
					IsSupplier: isSupplier,
					ContactStatus: status,
				};

				const response = await client.fetch(`/Contacts/${contactID}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(contactData),
				});

				if (!response.ok) return { error: await response.text() };

				const data = await response.json();
				return {
					success: true,
					contact: data.Contacts?.[0],
				};
			});
		} catch (error) {
			return handleXeroToolError(error, { toolName: "updateXeroContact", operation: "updating contact" });
		}
	},
});
