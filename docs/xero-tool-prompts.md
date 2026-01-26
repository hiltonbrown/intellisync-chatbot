# Xero Tool System Prompt Guide

This document provides the system prompt descriptions and parameter guidance for each Xero AI tool. These descriptions tell the AI model when to use each tool and how to interpret user requests.

## Overview

Each tool has:
- **Description**: Tells the AI when to invoke the tool
- **Input Schema**: Zod schema with parameter descriptions
- **Trigger Phrases**: Example user queries that should activate the tool

---

## 1. listXeroOrganisation

### System Description

```
Retrieves organization details from Xero for the currently connected Xero account.
Use this to verify the Xero connection is active and to get basic company information
like company name, tax number, base currency, and financial year settings.
```

### When to Use

| Trigger Type | Examples |
|--------------|----------|
| Connection check | "Is Xero connected?", "Check my Xero connection" |
| Company info | "What's the company name in Xero?", "What's my ABN?" |
| Settings lookup | "What's my financial year end?", "What currency is my Xero set to?" |
| Pre-flight check | Before any other Xero operation to verify connectivity |

### Parameters

None required. This tool takes an empty input schema.

### Best Practices

- **Always call first** when the user mentions Xero for the first time in a session
- **Use for validation** before operations that require knowing the org context
- **Cache results** - organization details rarely change within a conversation

### Example Invocations

```typescript
// User: "Is my Xero connected?"
listXeroOrganisation({})

// User: "What's my company's ABN?"
listXeroOrganisation({})
// Then extract taxNumber from response
```

---

## 2. listXeroInvoices

### System Description

```
Lists invoices from Xero with optional filtering. Returns both sales invoices (ACCREC)
and purchase bills (ACCPAY). Use this when the user asks about invoices, bills, sales,
or accounts receivable/payable.
```

### When to Use

| Trigger Type | Examples |
|--------------|----------|
| Invoice queries | "Show me invoices", "What invoices are unpaid?" |
| Bill queries | "Show my bills", "What do I owe suppliers?" |
| Receivables | "Who owes me money?", "Outstanding invoices" |
| Payables | "What bills need paying?", "Upcoming expenses" |
| Specific lookup | "Find invoice INV-0042", "Invoices for Acme Corp" |

### Parameters

| Parameter | Description | When to Use |
|-----------|-------------|-------------|
| `page` | Page number (100 per page) | When paginating through large result sets |
| `invoiceNumbers` | Filter by invoice numbers | When user mentions specific invoice numbers |
| `contactIDs` | Filter by customer/supplier | After looking up contact with listXeroContacts |
| `statuses` | Filter by status | DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED |
| `type` | ACCREC (sales) or ACCPAY (bills) | When user specifies invoices vs bills |
| `fromDate` | Start date (YYYY-MM-DD) | Date range queries |
| `toDate` | End date (YYYY-MM-DD) | Date range queries |

### Status Meanings

```
DRAFT      - Saved but not sent/approved
SUBMITTED  - Awaiting approval
AUTHORISED - Approved, awaiting payment
PAID       - Fully paid
VOIDED     - Cancelled
DELETED    - Removed
```

### Best Practices

- **Default to no type filter** unless user specifically says "invoices" (ACCREC) or "bills" (ACCPAY)
- **Use AUTHORISED status** for "unpaid" or "outstanding" queries
- **Combine AUTHORISED + PAID** for "all approved" queries
- **Line items only returned** when filtering by invoiceNumbers (for performance)

### Example Invocations

```typescript
// User: "Show me all unpaid invoices"
listXeroInvoices({
  type: "ACCREC",
  statuses: ["AUTHORISED"]
})

// User: "What bills are due this month?"
listXeroInvoices({
  type: "ACCPAY",
  statuses: ["AUTHORISED"],
  fromDate: "2025-01-01",
  toDate: "2025-01-31"
})

// User: "Find invoice INV-0042"
listXeroInvoices({
  invoiceNumbers: ["INV-0042"]
})

// User: "Show invoices for Acme Corp"
// First: get contactID from listXeroContacts
// Then:
listXeroInvoices({
  contactIDs: ["abc-123-def"]
})
```

---

## 3. listXeroContacts

### System Description

```
Lists contacts (customers and suppliers) from Xero. Use this when the user asks about
customers, suppliers, contacts, or needs contact IDs for creating invoices. Supports
search and pagination.
```

### When to Use

| Trigger Type | Examples |
|--------------|----------|
| Customer lookup | "Find customer Acme", "Who is John Smith?" |
| Supplier lookup | "List my suppliers", "Find vendor info" |
| Contact details | "What's the email for...?", "Phone number for...?" |
| Pre-invoice | Before creating invoices (need contactID) |
| Pre-invoice-filter | Before filtering invoices by contact |

### Parameters

| Parameter | Description | When to Use |
|-----------|-------------|-------------|
| `page` | Page number (100 per page) | Paginating through many contacts |
| `searchTerm` | Search by name/email/number | User mentions a specific name or company |
| `includeArchived` | Include archived contacts | User explicitly asks for archived |

### Best Practices

- **Always search first** when user mentions a specific contact name
- **Required before createXeroInvoice** - need contactID
- **Required before listXeroInvoices with contact filter** - need contactID
- **Search is case-insensitive** and matches partial strings

### Example Invocations

```typescript
// User: "Find contact details for Acme Corp"
listXeroContacts({
  searchTerm: "Acme Corp"
})

// User: "List all my customers"
listXeroContacts({})
// Then filter by isCustomer: true in response

// User: "Show suppliers including archived ones"
listXeroContacts({
  includeArchived: true
})
// Then filter by isSupplier: true in response

// User: "Create an invoice for John Smith"
// Step 1: Find contact
listXeroContacts({ searchTerm: "John Smith" })
// Step 2: Use contactID in createXeroInvoice
```

---

## 4. listXeroAccounts

### System Description

```
Lists the chart of accounts from Xero. Shows all account codes used for categorizing
transactions. Use this when creating invoices, categorizing expenses, or when the user
asks about account codes, chart of accounts, or GL codes.
```

### When to Use

| Trigger Type | Examples |
|--------------|----------|
| Account lookup | "What account code for office supplies?" |
| Chart of accounts | "Show me the chart of accounts" |
| Revenue accounts | "What income accounts do I have?" |
| Expense categories | "List expense categories" |
| Pre-invoice | When user doesn't know account code for invoice line |

### Parameters

| Parameter | Description | When to Use |
|-----------|-------------|-------------|
| `type` | Account type filter | When looking for specific category |
| `taxType` | Tax type filter | When filtering by GST treatment |

### Account Types

```
Revenue/Income:     REVENUE, SALES, OTHERINCOME
Expenses:           EXPENSE, OVERHEADS, DIRECTCOSTS
Assets:             BANK, CURRENT, NONCURRENT, FIXED, INVENTORY, PREPAYMENT
Liabilities:        CURRLIAB, TERMLIAB, LIABILITY
Equity:             EQUITY
Depreciation:       DEPRECIATN
```

### Common Tax Types (Australian)

```
OUTPUT2   - GST on Income (10%)
INPUT2    - GST on Expenses (10%)
EXEMPTOUTPUT - GST Free Income
EXEMPTINPUT  - GST Free Expenses
BASEXCLUDED  - BAS Excluded
```

### Best Practices

- **Call before createXeroInvoice** if user doesn't specify account code
- **Filter by type** for cleaner results (e.g., REVENUE for income accounts)
- **Response includes accountsByType** - grouped for easier navigation

### Example Invocations

```typescript
// User: "What account code should I use for consulting income?"
listXeroAccounts({
  type: "REVENUE"
})

// User: "Show me expense accounts"
listXeroAccounts({
  type: "EXPENSE"
})

// User: "What's the account code for office supplies?"
listXeroAccounts({
  type: "EXPENSE"
})
// Then search response for "office" or "supplies"

// User: "List all accounts"
listXeroAccounts({})
```

---

## 5. listXeroProfitAndLoss

### System Description

```
Retrieves a Profit and Loss (P&L) report from Xero. This provides a summary of revenue,
expenses, and profit or loss over a specified period of time. Use this when the user
asks for financial performance, income statement, or P&L data.
```

### When to Use

| Trigger Type | Examples |
|--------------|----------|
| P&L request | "Show me the P&L", "Profit and loss report" |
| Performance | "How did we do last quarter?", "What's our profit?" |
| Revenue | "What was our revenue this month?" |
| Expenses | "Show me expenses breakdown" |
| Comparison | "Compare monthly performance", "Quarter vs quarter" |

### Parameters

| Parameter | Description | When to Use |
|-----------|-------------|-------------|
| `fromDate` | Start date (YYYY-MM-DD) | Specific date range |
| `toDate` | End date (YYYY-MM-DD) | Specific date range |
| `periods` | Number of periods (1-12) | For comparison reports |
| `timeframe` | MONTH, QUARTER, or YEAR | Period comparison granularity |
| `standardLayout` | Use standard layout | Consistent formatting |
| `paymentsOnly` | Hide zero balances | Cleaner reports |

### Date Defaults

- `fromDate` defaults to **start of current financial year**
- `toDate` defaults to **today's date**

### Best Practices

- **For "this month"**: Set both fromDate and toDate to current month
- **For "this quarter"**: Calculate quarter start/end dates
- **For "YTD"**: Use FY start as fromDate, today as toDate
- **For comparisons**: Use `periods` + `timeframe` together

### Example Invocations

```typescript
// User: "What's our profit this month?"
listXeroProfitAndLoss({
  fromDate: "2025-01-01",
  toDate: "2025-01-31"
})

// User: "Show me quarterly P&L for this year"
listXeroProfitAndLoss({
  periods: 4,
  timeframe: "QUARTER"
})

// User: "P&L for FY 2024-25"
listXeroProfitAndLoss({
  fromDate: "2024-07-01",
  toDate: "2025-06-30"
})

// User: "Compare last 6 months revenue"
listXeroProfitAndLoss({
  periods: 6,
  timeframe: "MONTH"
})

// User: "Year-to-date profit"
listXeroProfitAndLoss({})  // Uses FY start to today by default
```

---

## 6. listXeroBalanceSheet

### System Description

```
Retrieves a Balance Sheet report from Xero. Shows the financial position of the business
including assets, liabilities, and equity at a specific point in time. Use this when the
user asks about the balance sheet, financial position, assets, liabilities, or equity.
```

### When to Use

| Trigger Type | Examples |
|--------------|----------|
| Balance sheet | "Show me the balance sheet" |
| Financial position | "What's our financial position?" |
| Assets | "What assets do we have?", "Cash position?" |
| Liabilities | "What do we owe?", "Total liabilities?" |
| Equity | "What's our equity?", "Net worth?" |
| Comparison | "Balance sheet comparison over time" |

### Parameters

| Parameter | Description | When to Use |
|-----------|-------------|-------------|
| `date` | Report date (YYYY-MM-DD) | Specific point in time |
| `periods` | Number of periods (1-12) | For comparison reports |
| `timeframe` | MONTH, QUARTER, or YEAR | Period comparison granularity |
| `standardLayout` | Use standard layout | Consistent formatting |
| `paymentsOnly` | Hide zero balances | Cleaner reports |

### Key Difference from P&L

- Balance Sheet is a **snapshot** (single date)
- P&L is a **period report** (date range)

### Best Practices

- **For "current"**: Omit date to use today
- **For "end of month"**: Use last day of month
- **For "end of quarter"**: Use Mar 31, Jun 30, Sep 30, Dec 31
- **For comparisons**: Use `periods` + `timeframe`

### Example Invocations

```typescript
// User: "Show me the balance sheet"
listXeroBalanceSheet({})  // Uses today by default

// User: "Balance sheet as at December 31, 2024"
listXeroBalanceSheet({
  date: "2024-12-31"
})

// User: "Compare quarterly balance sheets"
listXeroBalanceSheet({
  periods: 4,
  timeframe: "QUARTER"
})

// User: "What's our cash position?"
listXeroBalanceSheet({})
// Then look for BANK accounts in Assets section

// User: "Year-end balance sheets for the last 3 years"
listXeroBalanceSheet({
  date: "2024-06-30",  // Most recent FY end
  periods: 3,
  timeframe: "YEAR"
})
```

---

## 7. createXeroInvoice

### System Description

```
Creates a new invoice in Xero. Can create sales invoices (for customers) or purchase
bills (for suppliers). Use this when the user wants to create, draft, or generate an
invoice. Requires approval before execution.
```

### When to Use

| Trigger Type | Examples |
|--------------|----------|
| Create invoice | "Create an invoice for...", "Invoice Acme for..." |
| Draft invoice | "Draft a bill to...", "Save an invoice for..." |
| Generate invoice | "Generate invoice for consulting work" |
| Bill creation | "Create a bill from supplier", "Record purchase" |

### Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| `contactID` | Customer/supplier ID | **Yes** - from listXeroContacts |
| `type` | ACCREC (sales) or ACCPAY (bills) | **Yes** |
| `lineItems` | Array of line items | **Yes** - at least one |
| `date` | Invoice date | No - defaults to today |
| `dueDate` | Payment due date | No - uses contact terms |
| `reference` | Reference number | No |
| `status` | DRAFT, SUBMITTED, AUTHORISED | No - defaults to DRAFT |

### Line Item Structure

```typescript
{
  description: string;    // Required - what was sold/bought
  quantity: number;       // Required - how many
  unitAmount: number;     // Required - price per unit
  accountCode: string;    // Required - from listXeroAccounts
  taxType?: string;       // Optional - GST treatment
  itemCode?: string;      // Optional - inventory item code
}
```

### Approval Required

This tool has `needsApproval: true` - the AI will present the invoice details and wait for user confirmation before creating.

### Best Practices

- **Always get contactID first** using listXeroContacts
- **Always get accountCode first** using listXeroAccounts if unknown
- **Default to DRAFT status** unless user specifically says "approve" or "send"
- **Calculate totals** for the user before creating
- **Confirm details** before approval prompt

### Workflow Pattern

```typescript
// User: "Create an invoice for Acme Corp for $500 consulting"

// Step 1: Find the contact
const contacts = await listXeroContacts({ searchTerm: "Acme Corp" })
const contactID = contacts.contacts[0].contactID

// Step 2: Find appropriate account code
const accounts = await listXeroAccounts({ type: "REVENUE" })
const accountCode = "200"  // Consulting income

// Step 3: Create the invoice (will prompt for approval)
createXeroInvoice({
  contactID: contactID,
  type: "ACCREC",
  lineItems: [{
    description: "Consulting services",
    quantity: 1,
    unitAmount: 500,
    accountCode: "200",
    taxType: "OUTPUT2"  // GST on Income
  }],
  status: "DRAFT"
})
```

### Example Invocations

```typescript
// User: "Invoice John Smith $1000 for web development"
createXeroInvoice({
  contactID: "contact-id-from-lookup",
  type: "ACCREC",
  lineItems: [{
    description: "Web development services",
    quantity: 1,
    unitAmount: 1000,
    accountCode: "200"
  }]
})

// User: "Create a bill from Office Supplies Co for $150 stationery"
createXeroInvoice({
  contactID: "supplier-contact-id",
  type: "ACCPAY",
  lineItems: [{
    description: "Office stationery",
    quantity: 1,
    unitAmount: 150,
    accountCode: "400",  // Office expenses
    taxType: "INPUT2"    // GST on Expenses
  }]
})

// User: "Invoice Acme for 10 hours consulting at $200/hr, due in 30 days"
createXeroInvoice({
  contactID: "acme-contact-id",
  type: "ACCREC",
  lineItems: [{
    description: "Consulting services - January 2025",
    quantity: 10,
    unitAmount: 200,
    accountCode: "200"
  }],
  dueDate: "2025-02-25",  // 30 days from today
  status: "DRAFT"
})
```

---

## Tool Chaining Patterns

### Pattern 1: Invoice Lookup by Customer

```
User: "Show invoices for Acme Corp"

1. listXeroContacts({ searchTerm: "Acme Corp" })
2. listXeroInvoices({ contactIDs: [contactID] })
```

### Pattern 2: Create Invoice (Full Workflow)

```
User: "Create an invoice for ABC Ltd for consulting"

1. listXeroContacts({ searchTerm: "ABC Ltd" }) → get contactID
2. listXeroAccounts({ type: "REVENUE" }) → get accountCode
3. createXeroInvoice({ contactID, type: "ACCREC", lineItems: [...] })
```

### Pattern 3: Financial Overview

```
User: "Give me a financial summary"

1. listXeroOrganisation({}) → company context
2. listXeroProfitAndLoss({}) → revenue/expenses
3. listXeroBalanceSheet({}) → assets/liabilities
```

### Pattern 4: Accounts Receivable Analysis

```
User: "Who owes us money?"

1. listXeroInvoices({ type: "ACCREC", statuses: ["AUTHORISED"] })
   → unpaid sales invoices with amounts and contacts
```

### Pattern 5: Supplier Payment Review

```
User: "What bills need paying?"

1. listXeroInvoices({ type: "ACCPAY", statuses: ["AUTHORISED"] })
   → unpaid supplier bills with due dates
```

---

## Error Handling Guidance

When tools return errors, provide helpful guidance:

| Error | User Message |
|-------|--------------|
| "Xero is not connected" | "Please connect Xero in Settings > Integrations first." |
| "Missing required permissions" | "Please reconnect Xero to grant additional permissions." |
| "Token expired" | "Your Xero connection needs to be re-authorized." |
| "Contact not found" | "I couldn't find that contact. Can you check the spelling?" |
| "Account code invalid" | "That account code doesn't exist. Let me show you the available accounts." |

---

## Australian Business Context

When using these tools for Australian businesses, remember:

- **GST**: 10% standard rate, use OUTPUT2 (income) and INPUT2 (expenses)
- **Financial Year**: July 1 - June 30 (e.g., FY 2024-25)
- **ABN**: Australian Business Number (11 digits) in taxNumber field
- **Currency**: Default AUD
- **BAS**: Business Activity Statement periods (monthly/quarterly)

### Date Handling

```typescript
// Current FY start (for Australian businesses)
const fyStart = month >= 7
  ? `${year}-07-01`
  : `${year - 1}-07-01`

// Current quarter start
const quarterStarts = ["01-01", "04-01", "07-01", "10-01"]
```
