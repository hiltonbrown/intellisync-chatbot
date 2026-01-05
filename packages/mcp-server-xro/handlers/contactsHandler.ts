import type { MCPHandler } from "../../../types/mcp"
import type { CreateContactInput, Contact } from "../../../types/xero"
import type { XeroClient } from "../../xero-client/client"

export const listContacts = (client: XeroClient): MCPHandler<undefined, Contact[]> =>
  async () => client.listContacts()

export const createContacts = (
  client: XeroClient
): MCPHandler<{ contacts: CreateContactInput[] }, Contact[]> =>
  async (params) => client.createContacts(params.contacts)
