# Vendor Sheet Risk Explanation Update

## Summary

Updated the vendor slide-over panel to replace "Risk: TBD" with a comprehensive risk explanation showing the risk score, level, and specific risk factors.

## Changes Made

### 1. Backend (lib/agents/ap/actions.ts)

**Added Risk Calculation:**
- Imported `calculateVendorRisk` and `aggregateVendorRisk` functions
- Calculate risk for each unpaid bill in `getVendorDetails()`
- Aggregate risk across all vendor's unpaid bills
- Return detailed risk information instead of "TBD" placeholder

**New Return Fields:**
```typescript
{
  riskScore: number,        // 0-100
  riskLevel: RiskLevel,     // Low/Medium/High/Critical
  hasBankChange: boolean,   // Bank account changed flag
  riskFactors: string[]     // Human-readable list of issues
}
```

### 2. Frontend (components/agents/ap/vendor-sheet.tsx)

**Updated Risk Display:**
- Replaced `<Badge variant="outline">Risk: {data.risk}</Badge>`
- Now shows color-coded badge with risk level
- Added risk explanation box with score and factors

**New UI Components:**

**Risk Badge:**
- Color-coded based on risk level:
  - 🟢 Green: Low Risk (0-19)
  - 🟡 Yellow: Medium Risk (20-44)
  - 🟠 Orange: High Risk (45-69)
  - 🔴 Red: Critical Risk (≥70)

**Risk Explanation Box (when riskScore > 0):**
```
┌─────────────────────────────────────┐
│ ⚠️  Risk Score: 45/100              │
│                                     │
│ Risk Factors:                       │
│ • Missing ABN/Tax Number            │
│ • Missing Tax Invoice Number        │
└─────────────────────────────────────┘
```

**Success Message (when riskScore = 0):**
```
┌─────────────────────────────────────┐
│ ✓ All compliance factors present -  │
│   No risk identified                │
└─────────────────────────────────────┘
```

## Visual Examples

### High Risk Vendor

```
ABC Supplies Pty Ltd        [High Risk]

┌───────────────────────────────────────┐
│ ⚠️  Risk Score: 45/100                │
│                                       │
│ Risk Factors:                         │
│ • Missing ABN/Tax Number              │
│ • Missing Tax Invoice Number          │
└───────────────────────────────────────┘

contact@abc.com
(02) 1234 5678
```

### Low Risk Vendor

```
XYZ Services Ltd            [Low Risk]

┌───────────────────────────────────────┐
│ ✓ All compliance factors present -    │
│   No risk identified                  │
└───────────────────────────────────────┘

contact@xyz.com
(03) 9876 5432
```

### Critical Risk Vendor

```
Risky Vendor Co          [Critical Risk]

┌───────────────────────────────────────┐
│ ⚠️  Risk Score: 100/100               │
│                                       │
│ Risk Factors:                         │
│ • Missing ABN/Tax Number              │
│ • Missing Tax Invoice Number          │
│ • Unapproved Bill (DRAFT)             │
│ • Blocked Supplier (ARCHIVED)         │
│ • Bank Account Changed                │
└───────────────────────────────────────┘

blocked@risky.com
(08) 0000 0000
```

## Risk Factors Explained

The risk explanation shows one or more of these factors:

| Risk Factor | Meaning |
|-------------|---------|
| Missing ABN/Tax Number | Supplier has no tax identification number registered in Xero |
| Missing Tax Invoice Number | Bill lacks a proper tax invoice number |
| Unapproved Bill (STATUS) | Bill status is not AUTHORISED or PAID (shows actual status) |
| Blocked Supplier (STATUS) | Supplier contact is ARCHIVED or GDPRREQUEST |
| Bank Account Changed | Bill bank account differs from supplier's stored account |

## Technical Details

### Risk Calculation Logic

The vendor sheet calculates risk by:

1. **Filtering Unpaid Bills** - Only unpaid bills (amountDue > 0) affect risk
2. **Calculating Per-Bill Risk** - Each bill evaluated independently
3. **Aggregating Risk** - Uses highest risk score across all bills
4. **Combining Factors** - Unique risk factors from all bills

### Data Flow

```
getVendorDetails(supplierId)
  ↓
Query supplier + bills from database
  ↓
Filter unpaid bills (amountDue > 0)
  ↓
Calculate risk for each unpaid bill
  ↓
Aggregate risk across all unpaid bills
  ↓
Return vendor with risk details
  ↓
Display in vendor sheet UI
```

## Files Modified

1. **lib/agents/ap/actions.ts**
   - Added risk calculation imports
   - Updated `getVendorDetails()` to calculate and return risk
   - Replaced `risk: "TBD"` with actual risk data

2. **components/agents/ap/vendor-sheet.tsx**
   - Added `AlertTriangle` icon import
   - Added `getRiskBadgeColor()` helper function
   - Replaced risk badge with color-coded version
   - Added risk explanation box UI
   - Added success message for low-risk vendors

## Testing

### Manual Testing Steps

1. Navigate to `/agents/ap`
2. Click on any vendor to open the slide-over
3. Verify the risk badge shows correct color
4. Check risk explanation box displays:
   - Risk score (0-100)
   - List of risk factors
5. Test with different vendor risk levels

### Expected Behavior

**High Risk Vendors:**
- Orange or red badge
- Risk explanation box visible
- Risk factors listed
- Score displayed (≥45)

**Low Risk Vendors:**
- Green badge
- Success message displayed
- No risk factors listed
- Score = 0

**Medium Risk Vendors:**
- Yellow badge
- Risk explanation box visible
- 1-2 risk factors typically
- Score 20-44

## Benefits

1. **Transparency** - Users see exactly why a vendor is risky
2. **Actionable** - Clear list of issues to resolve
3. **Visual** - Color-coded badges for quick identification
4. **Informative** - Replaces placeholder with real data
5. **Consistent** - Matches risk scoring in vendor table

## Future Enhancements

Potential improvements:
- Add "Resolve" buttons next to each risk factor
- Link to Xero to update missing information
- Show historical risk trends
- Export risk report for vendor

---

**Date:** 2026-02-01
**Status:** ✅ Complete
**Tested:** Manual testing required
