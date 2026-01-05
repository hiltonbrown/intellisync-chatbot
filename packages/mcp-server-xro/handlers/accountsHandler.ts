import type { MCPHandler } from "../../../types/mcp"
import type { Account } from "../../../types/xero"
import type { XeroClient } from "../../xero-client/client"

export const listAccounts = (client: XeroClient): MCPHandler<undefined, Account[]> =>
  async () => client.listAccounts()
