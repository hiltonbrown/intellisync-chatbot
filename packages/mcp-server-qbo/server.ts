import type { MCPRequest, MCPResponse } from "../../types/mcp"
import type { HandlerRegistry } from "./registry"

export class MCPServer {
  constructor(private readonly registry: HandlerRegistry) {}

  start(): void {
    const stdin = process.stdin
    stdin.setEncoding("utf8")

    let buffer = ""
    stdin.on("data", async (chunk: string) => {
      buffer += chunk
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          continue
        }

        await this.handleLine(trimmed)
      }
    })
  }

  private async handleLine(payload: string): Promise<void> {
    let request: MCPRequest
    try {
      request = JSON.parse(payload) as MCPRequest
    } catch (error) {
      this.writeResponse({
        id: null,
        error: {
          code: "parse_error",
          message: (error as Error).message,
        },
      })
      return
    }

    const handler = this.registry[request.method]
    if (!handler) {
      this.writeResponse({
        id: request.id ?? null,
        error: { code: "method_not_found", message: `Unknown method ${request.method}` },
      })
      return
    }

    try {
      const result = await handler(request.params ?? undefined)
      this.writeResponse({ id: request.id ?? null, result })
    } catch (error) {
      this.writeResponse({
        id: request.id ?? null,
        error: { code: "handler_error", message: (error as Error).message },
      })
    }
  }

  private writeResponse(response: MCPResponse): void {
    process.stdout.write(`${JSON.stringify(response)}\n`)
  }
}
