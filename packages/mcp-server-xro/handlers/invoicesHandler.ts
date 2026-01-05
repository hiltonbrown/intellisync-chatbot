import type { MCPHandler } from "../../../types/mcp"
import type { CreateInvoiceInput, Invoice } from "../../../types/xero"
import type { XeroClient } from "../../xero-client/client"

export const createInvoice = (
  client: XeroClient
): MCPHandler<{ invoice: CreateInvoiceInput }, Invoice> => async (params) =>
  client.createInvoice(params.invoice)

export const getInvoice = (client: XeroClient): MCPHandler<{ invoiceId: string }, Invoice> =>
  async (params) => client.getInvoice(params.invoiceId)

export const updateInvoice = (
  client: XeroClient
): MCPHandler<{ invoiceId: string; invoice: CreateInvoiceInput }, Invoice> =>
  async (params) => client.updateInvoice(params.invoiceId, params.invoice)
