import { MCPServer } from "./server"
import { createXeroRegistry } from "./registry"
import { XeroClient } from "../xero-client/client"
import { InMemoryTokenStore, TokenManager } from "../xero-client/tokenManager"
import { createQboServer } from "../mcp-server-qbo"

const parseServerName = (): string => {
  const index = process.argv.findIndex((arg) => arg === "--server")
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }

  const prefixed = process.argv.find((arg) => arg.startsWith("--server="))
  if (prefixed) {
    return prefixed.split("=")[1] ?? "xero"
  }

  return "xero"
}

const createXeroServer = (): MCPServer => {
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

const createServer = (serverName: string): MCPServer => {
  switch (serverName) {
    case "xero":
      return createXeroServer()
    case "qbo":
      return createQboServer()
    default:
      throw new Error(`Unsupported server: ${serverName}`)
  }
}

const server = createServer(parseServerName())
server.start()
