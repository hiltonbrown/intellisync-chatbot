# Xero Integration User Guide

This guide details how to use the Xero integration within the Intellisync chat interface. You can interact with your Xero data using natural language to perform accounting tasks, generate reports, manage payroll, and more.

## Overview

The Xero integration allows you to:
- **View Financials**: Access P&L, Balance Sheet, and Trial Balance reports instantly.
- **Manage Sales**: Create, update, and send invoices and quotes.
- **Handle Purchasing**: Track bills and create credit notes.
- **Manage Contacts**: Add or update customer and supplier details.
- **Run Payroll**: Manage employees, timesheets, and leave applications.
- **Reconcile**: View bank transactions and record payments.

---

## 1. Getting Started & Organization Details

Before starting, ensure your Xero organization is connected in the Settings panel.

### Organization Info & Settings
**Tools:** `listXeroOrganisation`, `listXeroTaxRates`, `listXeroItems`

**Why use it?** To verify which entity you are working with, check your base currency, or look up tax settings and inventory item codes without leaving the chat.

**Chat Examples:**
- "Is my Xero connected?"
- "What is the ABN for our Xero organisation?"
- "List all active tax rates."
- "Show me the item code for 'Consulting Services'."

---

## 2. Managing Contacts (Customers & Suppliers)

**Tools:** `listXeroContacts`, `createXeroContact`, `updateXeroContact`, `listXeroContactGroups`

**Why use it?** Quickly find contact details (email, phone, address) or add new clients immediately after a meeting.

**Chat Examples:**
- **Find**: "Get contact details for Acme Corp."
- **List**: "Show me all active customers."
- **Groups**: "List my contact groups."
- **Create**: "Create a new customer named 'John Doe' with email 'john@example.com'."
- **Update**: "Update the phone number for 'Acme Corp' to 0400 123 456."

---

## 3. Sales: Invoices, Quotes & Credit Notes

**Tools:** 
- `listXeroInvoices`, `createXeroInvoice`, `updateXeroInvoice`
- `listXeroQuotes`, `createXeroQuote`, `updateXeroQuote`
- `listXeroCreditNotes`, `createXeroCreditNote`, `updateXeroCreditNote`
- `listXeroAgedReceivables`

**Why use it?** Streamline your accounts receivable process. Draft quotes while discussing requirements, generate invoices instantly, or check who owes you money.

**Chat Examples:**
- **Invoices**: 
  - "Show me all unpaid invoices for Acme Corp."
  - "Create an invoice for Smith Ltd for 5 hours of 'Web Design' at $150/hr."
  - "Mark invoice INV-0023 as AUTHORISED."
- **Quotes**:
  - "Draft a quote for 'Project X' to Client Y for $5000."
  - "List all sent quotes that haven't been accepted."
  - "Update quote QU-001 to ACCEPTED."
- **Credit Notes**:
  - "Create a credit note for invoice INV-100 for $200."
  - "Show me recent credit notes."
- **Debtors**:
  - "Who owes us money right now?" (Triggers Aged Receivables)
  - "Show me the aged receivables report."

---

## 4. Purchasing & Bills

**Tools:** `listXeroInvoices` (Type: ACCPAY), `listXeroAgedPayables`

**Why use it?** Keep track of your cash outflow and upcoming obligations.

**Chat Examples:**
- "What bills are due next week?"
- "Show me all unpaid bills from 'Officeworks'."
- "Run an aged payables report."

---

## 5. Financial Reporting

**Tools:** `listXeroProfitAndLoss`, `listXeroBalanceSheet`, `listXeroTrialBalance`

**Why use it?** Get an instant snapshot of your business health. Compare performance across periods without navigating complex report menus.

**Chat Examples:**
- **P&L**: 
  - "Show me the Profit and Loss for last month."
  - "Compare P&L for Q1 vs Q2."
- **Balance Sheet**:
  - "What is our current equity position?"
  - "Show me the Balance Sheet as of 30 June."
- **Trial Balance**:
  - "Generate a Trial Balance for the end of the financial year."

---

## 6. Banking & Payments

**Tools:** `listXeroBankTransactions`, `listXeroPayments`, `createXeroPayment`

**Why use it?** Track cash movements and record payments against invoices immediately.

**Chat Examples:**
- "Show me recent transactions for the main business account."
- "List all payments received yesterday."
- "Record a full payment for invoice INV-0050 made today."

---

## 7. Payroll Management

**Tools:** 
- `listXeroPayrollEmployees`
- `listXeroPayrollLeaveApplications`, `listXeroPayrollLeaveTypes`
- `listXeroPayrollCalendars`
- `createXeroPayrollTimesheet`, `getXeroPayrollTimesheet`, `updateXeroPayrollTimesheet`

**Why use it?** Manage your team's pay and leave directly. Great for quick checks on leave balances or drafting timesheets for casual staff.

**Chat Examples:**
- **Employees**:
  - "List all active employees."
  - "Is 'Sarah Jones' currently active in payroll?"
- **Leave**:
  - "Show me pending leave applications."
  - "What leave types do we have available?"
- **Timesheets**:
  - "Create a draft timesheet for John Smith for the period ending Friday."
  - "Add 8 hours to Monday and Tuesday on John's current timesheet."
  - "Approve the timesheet for Jane Doe."

---

## Tips for Best Results

1.  **Be Specific**: When creating items, specify quantities, unit prices, and descriptions.
    *   *Good*: "Invoice Acme $500."
    *   *Better*: "Invoice Acme for 5 widgets at $100 each."
2.  **Use Names**: You don't need to know IDs. The AI will search for "Acme Corp" to find the correct Contact ID behind the scenes.
3.  **Dates**: You can use natural language for dates like "last month," "next Friday," or "end of financial year."
4.  **Review**: The AI will often show you a summary of the data it's about to create (like an invoice draft) before finalizing it. Always double-check these details.
