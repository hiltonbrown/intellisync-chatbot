import type { MCPHandler } from "../../../types/mcp"
import type { Account } from "../../../types/qbo"
import type { QboClient } from "../../qbo-client/client"

export const listAccounts = (client: QboClient): MCPHandler<undefined, Account[]> =>
  async () => client.listAccounts()
