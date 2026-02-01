# AP Risk Rating - Quick Start Guide

## Overview

The AP Risk Rating system automatically assesses vendor payment risks based on compliance and data quality factors.

## How to Use

### 1. Sync Your Data

Navigate to the AP Dashboard:
```
/agents/ap
```

Click the **"Sync Bills"** button to import data from Xero.

### 2. View Risk Scores

Each vendor in the table shows:

| Badge | Risk Level | Score Range | Meaning |
|-------|-----------|-------------|---------|
| 🟢 Low | Low risk | 0-19 | All compliance factors present |
| 🟡 Medium | Medium risk | 20-44 | Some missing information |
| 🟠 High | High risk | 45-69 | Multiple missing factors |
| 🔴 Critical | Critical risk | ≥70 | Severe compliance issues |

### 3. Filter Vendors

Use the filter tabs to show:
- **All** - All vendors
- **Current** - Bills not yet due
- **1-30** - Bills 1-30 days overdue
- **31-60** - Bills 31-60 days overdue
- **61-90** - Bills 61-90 days overdue
- **90+** - Bills more than 90 days overdue
- **High Risk** - Vendors with risk score ≥45 (High and Critical levels)

### 4. Sort by Risk

Click the **Risk** column header to sort vendors by risk score.

### 5. View Risk Details

**Hover over a risk badge** to see:
- Exact risk score (0-100)
- List of risk factors contributing to the score

### 6. Check for Bank Changes

Look for the **⚠️ Bank Change** alert below risk badges.

**Hover over the alert** to see:
- Explanation that bank account differs from supplier record
- May indicate fraud, updated details, or data errors

## What Gets Checked

### Risk Factors

| Factor | Points | When It Applies |
|--------|--------|-----------------|
| Missing ABN | +25 | No tax identification number |
| Missing Invoice # | +20 | No tax invoice number on bill |
| Unapproved Bill | +30 | Bill not AUTHORISED or PAID |
| Blocked Supplier | +60 | Supplier ARCHIVED or GDPRREQUEST |

### Bank Change Detection

Compares:
- Supplier's stored bank account number
- Bank account number on the bill

**Note:** Only account **numbers** are compared (not names, due to Xero API limitations).

## Example Scenarios

### ✅ Clean Vendor (Score: 0)

```
Vendor: ABC Supplies Pty Ltd
✓ ABN: 12 345 678 901
✓ Invoice: INV-2024-001
✓ Status: AUTHORISED
✓ Contact: ACTIVE
✓ Bank: No change

Risk: 🟢 Low (0 points)
```

### ⚠️ Medium Risk (Score: 45)

```
Vendor: XYZ Services
✗ No ABN (+25)
✗ No Invoice Number (+20)
✓ Status: AUTHORISED
✓ Contact: ACTIVE

Risk: 🟠 High (45 points)
Factors:
• Missing ABN/Tax Number
• Missing Tax Invoice Number
```

### 🚨 Critical Risk (Score: 100)

```
Vendor: Risky Vendor Co
✗ No ABN (+25)
✗ No Invoice (+20)
✗ Status: DRAFT (+30)
✗ Contact: ARCHIVED (+60)
⚠️ Bank account changed

Risk: 🔴 Critical (100 points)
Factors:
• Missing ABN/Tax Number
• Missing Tax Invoice Number
• Unapproved Bill (DRAFT)
• Blocked Supplier (ARCHIVED)
• Bank Account Changed
```

## Best Practices

### Before Paying a Bill

1. **Check the risk badge** - Avoid paying Critical or High-risk vendors without review
2. **Review risk factors** - Hover to see what's missing
3. **Verify bank changes** - Contact supplier if bank account changed
4. **Get missing info** - Request ABN or tax invoice if missing

### Regular Monitoring

- **Weekly**: Filter by Critical and High risk
- **Monthly**: Review Medium risk vendors
- **Quarterly**: Audit all bank account changes

### Reducing Risk

To lower a vendor's risk score:

1. **Get their ABN** → Update in Xero Contact → -25 points
2. **Request tax invoice** → Update bill in Xero → -20 points
3. **Approve the bill** → Authorise in Xero → -30 points
4. **Unblock supplier** → Change status to ACTIVE → -60 points

Then click **Sync Bills** to refresh.

## Troubleshooting

### Risk scores not showing

**Solution:**
1. Check Xero connection in `/settings/integrations`
2. Click **Sync Bills** to import data
3. Refresh the page

### Risk score seems wrong

**Possible causes:**
- Data not synced from Xero recently
- Information updated in Xero but not synced
- Supplier has multiple bills with different statuses

**Solution:** Click **Sync Bills** to get latest data.

### Bank change alert always showing

**Possible causes:**
- Supplier bank details not updated in Xero
- Different bills have different bank accounts
- API limitation (account names not compared)

**Solution:** Verify bank details in Xero and sync.

## Technical Details

For developers and admins:

- **Risk calculation:** `lib/agents/ap/risk-scoring.ts`
- **Database schema:** `lib/db/schema.ts` (xero_suppliers, xero_bills)
- **Full documentation:** `docs/AP_RISK_SCORING.md`
- **Implementation:** `IMPLEMENTATION_SUMMARY.md`

## Support

Need help?
- **Documentation:** See `docs/AP_RISK_SCORING.md`
- **Issues:** GitHub Issues
- **Questions:** Contact your system administrator

---

**Version:** 1.0
**Last Updated:** 2026-02-01
**Feature Status:** ✅ Production Ready
