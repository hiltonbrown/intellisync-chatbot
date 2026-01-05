import { MCPServer } from "./server"
import { createQboRegistry } from "./registry"
import { QboClient } from "../qbo-client/client"
import { InMemoryTokenStore, TokenManager } from "../qbo-client/tokenManager"

export const createQboServer = (): MCPServer => {
  const store = new InMemoryTokenStore()
  let client: QboClient | null = null

  const tokenManager = new TokenManager(store, async (refreshToken) => {
    if (!client) {
      throw new Error("QuickBooks client not initialized")
    }
    return client.refreshAccessToken(refreshToken)
  })

  client = new QboClient({ tokenManager })

  return new MCPServer(createQboRegistry(client))
}

const server = createQboServer()
server.start()
