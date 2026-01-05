export interface MCPRequest<Params = unknown> {
  id: string | number | null
  method: string
  params?: Params
}

export interface MCPError {
  code: string
  message: string
  details?: unknown
}

export interface MCPResponse<Result = unknown> {
  id: string | number | null
  result?: Result
  error?: MCPError
}

export type MCPHandler<Params = unknown, Result = unknown> = (
  params: Params
) => Promise<Result>
