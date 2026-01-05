export interface Customer {
  Id?: string
  DisplayName?: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: { Address?: string }
}

export interface CreateCustomerInput {
  DisplayName: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: { Address?: string }
}

export interface Account {
  Id?: string
  Name?: string
  AccountType?: string
  AccountSubType?: string
}

export interface InvoiceLine {
  Id?: string
  Description?: string
  Amount?: number
  DetailType?: string
  SalesItemLineDetail?: {
    ItemRef?: { value: string }
  }
}

export interface CreateInvoiceInput {
  CustomerRef: { value: string }
  Line: InvoiceLine[]
  TxnDate?: string
  DueDate?: string
}

export interface Invoice {
  Id?: string
  DocNumber?: string
  TotalAmt?: number
  Balance?: number
}

export interface QueryResponse<T> {
  QueryResponse: {
    [key: string]: T[] | number | undefined
    maxResults?: number
  }
}
