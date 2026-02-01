# AP Risk Scoring System

## Overview

The AP Risk Scoring system provides automated risk assessment for Accounts Payable vendors based on multiple compliance and data quality factors. This helps identify potentially problematic payments before they are processed.

## Risk Calculation

### Scoring Formula

The risk score (0-100) is calculated by summing points from the following factors:

| Factor | Points | Description |
|--------|--------|-------------|
| Missing ABN/Tax Number | +25 | Supplier has no tax identification number registered |
| Missing Tax Invoice Number | +20 | Bill lacks a proper tax invoice number |
| Unapproved Bill | +30 | Bill status is not AUTHORISED or PAID |
| Blocked Supplier | +60 | Supplier contact status is ARCHIVED or GDPRREQUEST |

**Maximum Score:** 100 (scores above 100 are capped)

### Risk Levels

Risk levels are categorized based on the total score:

- **Low (0-19)**: Minimal risk, all compliance factors present
- **Medium (20-44)**: Some missing information, requires attention
- **High (45-69)**: Multiple missing factors or significant issues
- **Critical (≥70)**: Severe compliance issues, immediate action required

### Bank Change Detection

Separately from the risk score, the system flags vendors where the bank account on a bill differs from the supplier's stored bank account. This helps detect:

- Potential fraud attempts
- Updated banking details not yet reflected in supplier records
- Data entry errors

**Note:** Due to Xero API limitations, only bank account **numbers** are compared. Account names are not available via the API.

## Data Sources

### Xero Integration

The risk scoring system relies on data synced from Xero:

#### Supplier Fields
- `taxNumber` - ABN/Tax Number from Contact.TaxNumber
- `contactStatus` - Contact.ContactStatus (ACTIVE, ARCHIVED, GDPRREQUEST)
- `bankAccountNumber` - Contact.BankAccountDetails (account number only)

#### Bill Fields
- `invoiceNumber` - Invoice.InvoiceNumber
- `status` - Invoice.Status (AUTHORISED, PAID, DRAFT, etc.)
- `billBankAccountNumber` - Not available in Xero API (always null)

### API Limitations

**Xero API does not provide:**
1. Bank account **names** (only account numbers)
2. Bill-specific bank account details
3. Tax number type (ABN vs EIN vs SSN)

These limitations are documented in the code and handled gracefully.

## Database Schema

### New Fields in `xero_suppliers`

```sql
tax_number TEXT
contact_status VARCHAR(50)
bank_account_number TEXT
bank_account_name TEXT -- Always null due to API limitation
```

Index: `xero_suppliers_status_idx` on `contact_status`

### New Fields in `xero_bills`

```sql
invoice_number TEXT
bill_bank_account_number TEXT -- Always null due to API limitation
bill_bank_account_name TEXT -- Always null due to API limitation
```

Index: `xero_bills_invoice_number_idx` on `invoice_number`

## Implementation Details

### Core Modules

1. **`lib/agents/ap/risk-scoring.ts`**
   - `calculateVendorRisk()` - Compute risk for a single bill
   - `detectBankAccountChange()` - Compare bank accounts
   - `aggregateVendorRisk()` - Aggregate across vendor's bills

2. **`lib/agents/ap/queries.ts`**
   - Enhanced `getVendorList()` to include risk calculation
   - Joins supplier and bill data for risk assessment

3. **`lib/integrations/xero/actions.ts`**
   - Updated `syncXeroBills()` to extract new fields
   - Syncs tax number, contact status, bank details

### UI Components

**`components/agents/ap/vendor-table.tsx`**

Features:
- Risk badge column with color-coded levels
- Bank change alert icon with tooltip
- Ageing filter tabs (All/Current/1-30/31-60/61-90/90+/High Risk)
- Risk score sorting
- Tooltips showing risk factors

Badge Colors:
- **Low**: Green (`bg-green-600`)
- **Medium**: Yellow (`bg-yellow-600`)
- **High**: Orange (`bg-orange-600`)
- **Critical**: Red (`bg-red-600`)

## Usage

### Viewing Risk Scores

1. Navigate to `/agents/ap`
2. View the **Risk** column in the vendor table
3. Hover over risk badges to see detailed factors
4. Look for the ⚠️ icon indicating bank account changes

### Filtering Vendors

Use the filter tabs to show:
- **All** - All vendors
- **Current** - Bills not yet due
- **1-30** through **90+** - Ageing buckets
- **High Risk** - Vendors with risk score ≥45 (High and Critical levels combined)

### Sorting

Click the **Risk** column header to sort vendors by risk score (highest to lowest, or vice versa).

## Sync Process

1. User clicks **Sync Bills** button
2. System calls Xero API to fetch contacts and bills
3. New fields are extracted and stored:
   - Tax numbers
   - Contact statuses
   - Bank account numbers
   - Invoice numbers
4. Risk scores are calculated on-demand when viewing vendor list

## Testing

Unit tests are available in `lib/agents/ap/__tests__/risk-scoring.test.ts`:

```bash
pnpm test lib/agents/ap/__tests__/risk-scoring.test.ts
```

Test coverage includes:
- Bank account change detection
- Individual risk factor scoring
- Risk level categorization
- Risk aggregation across multiple bills
- Edge cases (null values, whitespace, case sensitivity)

## Future Enhancements

### Potential Improvements

1. **Manual Bank Account Entry**
   - UI for manually entering bill bank account details
   - Overrides API limitation for specific bills

2. **Historical Risk Tracking**
   - Store risk scores over time
   - Trend analysis for vendors

3. **Custom Risk Weights**
   - Allow users to adjust point values per factor
   - Industry-specific risk profiles

4. **Automated Alerts**
   - Email notifications for Critical risk vendors
   - Slack/Teams integration for high-risk bills

5. **Risk Score Decay**
   - Reduce risk over time for resolved issues
   - Incentivize supplier compliance

### API Enhancement Requests

Submit to Xero:
- Expose bill-level bank account details
- Provide bank account names (not just numbers)
- Include tax number type in Contact response

## Migration Guide

### Database Migration

Migration file: `lib/db/migrations/0002_skinny_multiple_man.sql`

To apply manually:

```bash
npx tsx scripts/apply-ap-risk-migration.ts
```

To verify:

```bash
pnpm db:studio
```

Check that new columns exist in `xero_suppliers` and `xero_bills` tables.

### Rollback

If issues occur, use this SQL to rollback:

```sql
ALTER TABLE "xero_suppliers"
  DROP COLUMN "tax_number",
  DROP COLUMN "contact_status",
  DROP COLUMN "bank_account_number",
  DROP COLUMN "bank_account_name";

ALTER TABLE "xero_bills"
  DROP COLUMN "invoice_number",
  DROP COLUMN "bill_bank_account_number",
  DROP COLUMN "bill_bank_account_name";

DROP INDEX "xero_suppliers_status_idx";
DROP INDEX "xero_bills_invoice_number_idx";
```

## Security Considerations

1. **Access Control**
   - Risk scores only visible to authenticated users
   - Organization-scoped data access via Clerk

2. **Data Privacy**
   - Bank account numbers encrypted at rest (future enhancement)
   - Audit logs for risk score access (future enhancement)

3. **Fraud Prevention**
   - Bank change detection helps identify potential fraud
   - Critical risk vendors require manual review

## Support

For issues or questions:
- GitHub Issues: [intellisync/issues](https://github.com/hiltonbrown/intellisync/issues)
- Documentation: [CLAUDE.md](/CLAUDE.md)
- Contact: See project README

---

**Last Updated:** 2026-02-01
**Version:** 1.0
**Author:** IntelliSync Development Team
