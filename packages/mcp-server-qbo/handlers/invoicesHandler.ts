import type { MCPHandler } from "../../../types/mcp"
import type { CreateInvoiceInput, Invoice } from "../../../types/qbo"
import type { QboClient } from "../../qbo-client/client"

export const createInvoice = (
  client: QboClient
): MCPHandler<{ invoice: CreateInvoiceInput }, Invoice> => async (params) =>
  client.createInvoice(params.invoice)

export const getInvoice = (client: QboClient): MCPHandler<{ invoiceId: string }, Invoice> =>
  async (params) => client.getInvoice(params.invoiceId)

export const updateInvoice = (
  client: QboClient
): MCPHandler<{ invoiceId: string; invoice: CreateInvoiceInput }, Invoice> =>
  async (params) => client.updateInvoice(params.invoiceId, params.invoice)
