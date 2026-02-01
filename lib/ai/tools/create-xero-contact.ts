import { auth } from "@clerk/nextjs/server";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationTenantBindings } from "@/lib/db/schema";
import { handleXeroToolError } from "@/lib/integrations/xero/error-handler";
import { withTokenRefreshRetry } from "@/lib/integrations/xero/retry-helper";

export const createXeroContact = tool({
	description: "Creates a new contact in Xero.",
	inputSchema: z.object({
		name: z.string().min(1).describe("Contact Name"),
		email: z.string().email().optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		phone: z.string().optional(),
		isCustomer: z.boolean().optional(),
		isSupplier: z.boolean().optional(),
	}),
	execute: async ({ name, email, firstName, lastName, phone, isCustomer, isSupplier }) => {
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
					Name: name,
					EmailAddress: email,
					FirstName: firstName,
					LastName: lastName,
					Phones: phone ? [{ PhoneType: "DEFAULT", PhoneNumber: phone }] : undefined,
					IsCustomer: isCustomer,
					IsSupplier: isSupplier,
				};

				const response = await client.fetch("/Contacts", {
					method: "PUT", // Xero uses PUT for create/update (idempotent) or POST for create
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
			return handleXeroToolError(error, { toolName: "createXeroContact", operation: "creating contact" });
		}
	},
});
