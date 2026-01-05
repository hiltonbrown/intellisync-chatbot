export interface Contact {
  ContactID?: string
  Name?: string
  EmailAddress?: string
}

export interface CreateContactInput {
  Name: string
  EmailAddress?: string
}

export interface Account {
  AccountID?: string
  Code?: string
  Name?: string
  Type?: string
}

export interface LineItem {
  Description?: string
  Quantity?: number
  UnitAmount?: number
  AccountCode?: string
}

export interface CreateInvoiceInput {
  Type: "ACCREC" | "ACCPAY"
  Contact: {
    ContactID?: string
    Name?: string
  }
  Date?: string
  DueDate?: string
  LineItems?: LineItem[]
  Status?: string
}

export interface Invoice {
  InvoiceID?: string
  InvoiceNumber?: string
  Type?: string
  Status?: string
  Total?: number
}

export interface InvoiceResponse {
  Invoices: Invoice[]
}

export interface Connection {
  id: string
  tenantId: string
  tenantName: string
  tenantType: string
}
