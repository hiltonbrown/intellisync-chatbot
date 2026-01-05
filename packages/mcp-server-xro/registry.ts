import type { MCPHandler } from "../../types/mcp"
import type { XeroClient } from "../xero-client/client"
import * as accountsHandler from "./handlers/accountsHandler"
import * as authHandler from "./handlers/authHandler"
import * as contactsHandler from "./handlers/contactsHandler"
import * as invoicesHandler from "./handlers/invoicesHandler"

export type HandlerRegistry = Record<string, MCPHandler>

export const createXeroRegistry = (client: XeroClient): HandlerRegistry => ({
  authenticate: authHandler.authenticate(client),
  refresh: authHandler.refresh(client),
  list_contacts: contactsHandler.listContacts(client),
  create_contacts: contactsHandler.createContacts(client),
  list_accounts: accountsHandler.listAccounts(client),
  create_invoices: invoicesHandler.createInvoice(client),
  get_invoice: invoicesHandler.getInvoice(client),
  update_invoice: invoicesHandler.updateInvoice(client),
})
