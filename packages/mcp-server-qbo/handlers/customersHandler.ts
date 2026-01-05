import type { MCPHandler } from "../../../types/mcp"
import type { CreateCustomerInput, Customer } from "../../../types/qbo"
import type { QboClient } from "../../qbo-client/client"

export const listCustomers = (client: QboClient): MCPHandler<undefined, Customer[]> =>
  async () => client.listCustomers()

export const createCustomer = (
  client: QboClient
): MCPHandler<{ customer: CreateCustomerInput }, Customer> => async (params) =>
  client.createCustomer(params.customer)
