import { createQboServer } from "../mcp-server-qbo"
import { createXeroServer } from "../mcp-server-xro"
import type { MCPServer } from "../mcp-server-xro/server"

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
