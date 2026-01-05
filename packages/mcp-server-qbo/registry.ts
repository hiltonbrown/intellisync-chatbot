import type { MCPHandler } from "../../types/mcp"
import type { QboClient } from "../qbo-client/client"
import * as accountsHandler from "./handlers/accountsHandler"
import * as authHandler from "./handlers/authHandler"
import * as customersHandler from "./handlers/customersHandler"
import * as invoicesHandler from "./handlers/invoicesHandler"

export type HandlerRegistry = Record<string, MCPHandler>

export const createQboRegistry = (client: QboClient): HandlerRegistry => ({
  authenticate: authHandler.authenticate(client),
  refresh: authHandler.refresh(client),
  list_customers: customersHandler.listCustomers(client),
  create_customer: customersHandler.createCustomer(client),
  list_accounts: accountsHandler.listAccounts(client),
  create_invoice: invoicesHandler.createInvoice(client),
  get_invoice: invoicesHandler.getInvoice(client),
  update_invoice: invoicesHandler.updateInvoice(client),
})
