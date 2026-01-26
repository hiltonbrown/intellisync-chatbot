# Agent System Prompts Guide

This document provides comprehensive guidance for the system prompts used in the Accounts Receivable (AR), Accounts Payable (AP), and Cashflow agent pages.

## Overview

Each agent page has specialized AI capabilities for its domain:

| Agent | Primary Function | AI Features |
|-------|------------------|-------------|
| **AR** | Manage customer invoices | Collection email generation, risk assessment |
| **AP** | Manage vendor bills | Bill commentary generation |
| **Cashflow** | Monitor & forecast cash | Recurring transaction prediction |

---

## Accounts Receivable (AR) Agent

**Route**: `/agents/ar`
**File**: `app/(chat)/agents/ar/page.tsx`

### Dashboard Data

The AR agent displays:
- **Total Outstanding**: Sum of unpaid invoice amounts
- **Count Outstanding**: Number of outstanding invoices
- **DSO (Days Sales Outstanding)**: 90-day rolling average
- **Ageing Buckets**: Current, 1-30, 31-60, 61-90, 90+ days

### AI Features

#### 1. Collection Email Generation

**Prompt Location**: `lib/ai/prompts.ts` → `collectionEmailPrompt()`

**System Prompt**:
```
You are drafting a collections email for {companyName} to {contactName}.
There are {count} overdue invoices.

Invoices:
- Invoice {number} (Due: {dueDate}): ${amount}
[... for each invoice]

Task: Write a polite but firm email requesting payment.
Tone: Professional, Australian business English.
Include a table or list of the overdue invoices.
Ask them to contact us if there are any issues.
Subject line should be included.
```

**Dynamic Variables**:
| Variable | Source | Description |
|----------|--------|-------------|
| `companyName` | `userSettings.companyName` | User's company name |
| `contactName` | `xeroContacts.name` | Customer name |
| `overdueInvoices` | `xeroInvoices` | Array of overdue invoice details |

**Temperature**: 0.7 (moderate creativity for natural tone)

**Invocation**: `generateCollectionEmail(contactName, overdueInvoices)`

**Best Practices**:
- Include all overdue invoices, not just the most overdue
- Format amounts with currency symbol and 2 decimal places
- Use Australian date format (DD/MM/YYYY) for due dates
- Subject line should reference the number of overdue invoices

**Example Output**:
```
Subject: Overdue Invoices - Action Required

Dear John Smith,

I hope this email finds you well. I'm writing regarding the following
outstanding invoices that are now overdue:

| Invoice # | Due Date   | Amount   |
|-----------|------------|----------|
| INV-0042  | 15/12/2024 | $1,500.00|
| INV-0056  | 22/12/2024 | $750.00  |

Total outstanding: $2,250.00

We would appreciate your prompt attention to this matter. If you have
already arranged payment, please disregard this notice.

If there are any queries regarding these invoices, please don't hesitate
to contact us.

Kind regards,
[Company Name]
```

#### 2. Customer Risk Assessment

**Logic Location**: `lib/agents/ar/actions.ts` → `getCustomerDetails()`

**Risk Rating Algorithm**:
```typescript
// Risk levels based on days overdue
if (daysOverdue > 60) → "High"
if (daysOverdue > 30) → "Medium"
else → "Low"
```

**Risk Indicators**:
| Risk Level | Days Overdue | Recommended Action |
|------------|--------------|-------------------|
| Low | 0-30 days | Monitor, standard follow-up |
| Medium | 31-60 days | Escalate, phone follow-up |
| High | 60+ days | Urgent action, consider debt collection |

### Tone Guidelines (from `buildIntellisyncPrompt`)

For collections communications, follow the escalation pattern:

```
<tone_guide>
- **Collections:** Professional -> Firm.
</tone_guide>
```

**Escalation Stages**:
1. **First reminder (1-30 days)**: Polite, assumes oversight
2. **Second reminder (31-60 days)**: Firm, requests immediate action
3. **Final notice (60+ days)**: Formal, mentions consequences

---

## Accounts Payable (AP) Agent

**Route**: `/agents/ap`
**File**: `app/(chat)/agents/ap/page.tsx`

### Dashboard Data

The AP agent displays:
- **Total Payable**: Sum of unpaid bill amounts
- **Count Payable**: Number of payable bills
- **DPO (Days Payable Outstanding)**: 90-day rolling average
- **Ageing Buckets**: Current, 1-30, 31-60, 61-90, 90+ days

### AI Features

#### Bill Commentary Generation

**Prompt Location**: `lib/ai/prompts-ap.ts` → `billCommentaryPrompt()`

**System Prompt**:
```
You are an accounts payable assistant.
Vendor: {vendorName}
Amount: {amount}
Due Date: {dueDate}
Line Items: {lineItemsSummary}

Task: Write a ONE sentence commentary summarizing what this bill is for.
Example: "Monthly subscription for Adobe Creative Cloud software licenses."
Keep it concise. If line items are missing, say "Standard invoice from {vendorName}."
```

**Dynamic Variables**:
| Variable | Source | Description |
|----------|--------|-------------|
| `vendorName` | `xeroSuppliers.name` | Vendor/supplier name |
| `amount` | `xeroBills.total` | Bill amount |
| `dueDate` | `xeroBills.dueDate` | Payment due date |
| `lineItemsSummary` | `xeroBills.lineItems` | Description of items |

**Temperature**: 0.3 (low creativity for consistent, factual output)

**Invocation**: `generateBillCommentary(vendorName, lineItemsSummary, amount, dueDate)`

**Best Practices**:
- Keep commentary to exactly ONE sentence
- Focus on what was purchased, not payment details
- Use vendor name as fallback when line items are missing
- Don't include amounts in the commentary (already displayed)

**Example Outputs**:
```
// With line items
"Quarterly cloud hosting services for production environment."

// Without line items
"Standard invoice from Telstra for telecommunications services."

// Software subscription
"Annual license renewal for Microsoft 365 Business Premium."

// Utilities
"Monthly electricity charges for warehouse facility."
```

### Prompt Design Rationale

| Aspect | Design Choice | Reason |
|--------|---------------|--------|
| Length | ONE sentence | Quick scanning in table view |
| Temperature | 0.3 | Consistent, factual summaries |
| Fallback | Vendor name reference | Always provides useful context |
| Focus | What, not when/how much | Complements other displayed data |

---

## Cashflow Agent

**Route**: `/agents/cashflow`
**File**: `app/(chat)/agents/cashflow/page.tsx`

### Dashboard Data

The Cashflow agent displays:
- **Debtors Owing**: Invoices due within period
- **Creditors Owing**: Bills due within period
- **Net Cashflow**: Projected inflow - outflow + adjustments
- **Historical Chart**: Last 90 days of transactions
- **Projected Chart**: Next 90 days of invoices/bills
- **Calendar Events**: Upcoming payment dates

### AI Features

#### Recurring Transaction Prediction

**Prompt Location**: `lib/ai/prompts-cashflow.ts` → `cashflowSuggestionPrompt()`

**System Prompt**:
```
You are a cashflow analyst.
Analyze the following recurring transactions (Description, Amount, Date):
{recurringTransactions}

Predict the NEXT occurrence of these expenses/incomes.
Return a JSON array of suggested adjustments:
[
  { "description": "Weekly Wages", "amount": 5000, "date": "2024-10-30", "type": "OUT" }
]
Only suggest high confidence recurring items (e.g. wages, rent, tax).
Ignore one-off payments.
```

**Dynamic Variables**:
| Variable | Source | Description |
|----------|--------|-------------|
| `recurringTransactions` | `xeroTransactions` | Last 60 days of transactions (max 50) |

**Transaction Format**:
```
{description}: ${amount} on {YYYY-MM-DD}
```

**Temperature**: 0.2 (very low - need precise, reliable predictions)

**Invocation**: `generateCashflowSuggestions()`

**Expected Output Schema**:
```typescript
interface CashflowSuggestion {
  description: string;  // e.g., "Weekly Wages"
  amount: number;       // e.g., 5000
  date: string;         // YYYY-MM-DD format
  type: "IN" | "OUT";   // Inflow or outflow
}

// Returns: CashflowSuggestion[]
```

**Best Practices**:
- Only suggest **high confidence** recurring items
- Focus on predictable patterns: wages, rent, subscriptions, tax payments
- Ignore one-off or irregular payments
- Date should be the NEXT expected occurrence
- Amount should match the typical/average amount

**High Confidence Categories**:
| Category | Pattern | Typical Frequency |
|----------|---------|-------------------|
| Wages | Regular amount, same day | Weekly/Fortnightly/Monthly |
| Rent/Lease | Fixed amount | Monthly |
| Subscriptions | Fixed amount | Monthly/Annual |
| Utilities | Similar amount range | Monthly/Quarterly |
| Tax (BAS/PAYG) | Periodic | Monthly/Quarterly |
| Insurance | Fixed amount | Monthly/Annual |

**Example Input**:
```
Wages: $5000 on 2025-01-07
Wages: $5000 on 2025-01-14
Wages: $5000 on 2025-01-21
Office Rent: $3500 on 2025-01-01
Telstra Bill: $450 on 2025-01-05
AWS Hosting: $1200 on 2025-01-01
One-off Equipment: $8500 on 2025-01-10
```

**Example Output**:
```json
[
  { "description": "Weekly Wages", "amount": 5000, "date": "2025-01-28", "type": "OUT" },
  { "description": "Office Rent", "amount": 3500, "date": "2025-02-01", "type": "OUT" },
  { "description": "AWS Hosting", "amount": 1200, "date": "2025-02-01", "type": "OUT" }
]
```

Note: "One-off Equipment" is correctly ignored as it's not recurring.

### Manual Adjustment Input

**Action**: `addCashflowAdjustment(data)`

Users can manually add expected cash events:

```typescript
interface ManualAdjustment {
  description: string;    // What the adjustment is for
  amount: number;         // Dollar amount
  date: Date;            // Expected date
  type: "IN" | "OUT";    // Inflow or outflow
}
```

**Use Cases**:
- Expected large customer payment not yet invoiced
- Planned equipment purchase
- Known upcoming tax payment
- Dividend distribution
- Loan repayment

---

## Shared Context: Australian Business

All agent prompts inherit context from the main Intellisync prompt:

### Financial Year Awareness

```typescript
// From lib/utils/datetime.ts
const fyStart = month >= 7 ? `${year}-07-01` : `${year - 1}-07-01`;
const fyEnd = month >= 7 ? `${year + 1}-06-30` : `${year}-06-30`;
```

### Currency & Date Formatting

| Format | Standard | Example |
|--------|----------|---------|
| Date | DD/MM/YYYY | 25/01/2025 |
| Currency | AUD with $ | $1,234.56 |
| ABN | XX XXX XXX XXX | 12 345 678 901 |

### Compliance Context

From `buildIntellisyncPrompt`:
```
**Core Capabilities:**
- **Financial:** Recording transactions, managing AP/AR, processing GST/BAS,
  and bank reconciliation.
```

---

## Prompt Files Summary

| Agent | Prompt File | Function | Purpose |
|-------|-------------|----------|---------|
| AR | `lib/ai/prompts.ts` | `collectionEmailPrompt()` | Generate collection emails |
| AP | `lib/ai/prompts-ap.ts` | `billCommentaryPrompt()` | Generate bill summaries |
| Cashflow | `lib/ai/prompts-cashflow.ts` | `cashflowSuggestionPrompt()` | Predict recurring items |

---

## Action Files Summary

| Agent | Action File | Functions |
|-------|-------------|-----------|
| AR | `lib/agents/ar/actions.ts` | `generateCollectionEmail()`, `getCustomerDetails()` |
| AP | `lib/agents/ap/actions.ts` | `generateBillCommentary()`, `getVendorDetails()` |
| Cashflow | `lib/agents/cashflow/actions.ts` | `generateCashflowSuggestions()`, `addCashflowAdjustment()` |

---

## Query Files Summary

| Agent | Query File | Data Retrieved |
|-------|------------|----------------|
| AR | `lib/agents/ar/queries.ts` | Dashboard metrics, customer list |
| AP | `lib/agents/ap/queries.ts` | Dashboard metrics, vendor list |
| Cashflow | `lib/agents/cashflow/queries.ts` | Dashboard data, chart data, calendar events |

---

## Temperature Settings

| Agent Function | Temperature | Rationale |
|----------------|-------------|-----------|
| Collection Email | 0.7 | Natural, varied tone for each email |
| Bill Commentary | 0.3 | Consistent, factual summaries |
| Cashflow Suggestions | 0.2 | Precise, reliable predictions |

Higher temperature = more creative/varied output
Lower temperature = more deterministic/consistent output

---

## Error Handling

All agent actions handle errors gracefully:

```typescript
// Common pattern in actions
try {
  // Parse AI response
  const parsed = JSON.parse(text);
  return parsed;
} catch (e) {
  console.error("[functionName] Failed to parse AI response", e);
  return []; // Return empty/default
}
```

---

## Future Enhancements

### AR Agent
- [ ] Multi-stage collection email templates (1st, 2nd, final notice)
- [ ] Payment arrangement letter generation
- [ ] Credit note request handling

### AP Agent
- [ ] Payment prioritization recommendations
- [ ] Early payment discount analysis
- [ ] Vendor relationship scoring

### Cashflow Agent
- [ ] Scenario modeling ("what if" analysis)
- [ ] Cash shortage alerts
- [ ] Investment opportunity identification
- [ ] Seasonal pattern detection
