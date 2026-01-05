import { MCPServer } from "./server"
import { createXeroRegistry } from "./registry"
import { XeroClient } from "../xero-client/client"
import { InMemoryTokenStore, TokenManager } from "../xero-client/tokenManager"

export const createXeroServer = (): MCPServer => {
  const store = new InMemoryTokenStore()
  let client: XeroClient | null = null

  const tokenManager = new TokenManager(store, async (refreshToken) => {
    if (!client) {
      throw new Error("Xero client not initialized")
    }
    return client.refreshAccessToken(refreshToken)
  })

  client = new XeroClient({ tokenManager })

  return new MCPServer(createXeroRegistry(client))
}

const server = createXeroServer()
server.start()
