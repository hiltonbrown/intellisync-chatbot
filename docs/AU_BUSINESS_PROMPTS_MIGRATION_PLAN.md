# Migration Plan: Australian Business Prompts Implementation

## Executive Summary

This document outlines the migration strategy for transforming the IntelliSync AI system from a generic assistant to "Intellisync" — a specialized Australian Business, Accounting, and HR assistant with strict compliance features.

**Target Repository:** `hiltonbrown/intellisync`
**Primary Files Affected:** `lib/ai/prompts.ts`, `app/(chat)/api/chat/route.ts`, `lib/db/schema.ts`

---

## 1. Current State Analysis

### 1.1 Existing Prompt Architecture

| File | Purpose | Current Implementation |
|------|---------|----------------------|
| `lib/ai/prompts.ts:75-98` | Main system prompt | Generic `regularPrompt` + artifacts instructions |
| `lib/ai/prompts.ts:54-56` | Regular prompt | "You are a friendly assistant!" |
| `lib/ai/prompts.ts:100-124` | Code artifact prompt | Generic Python code generator |
| `lib/ai/prompts.ts:126-128` | Sheet artifact prompt | Basic "create CSV" instruction |
| `artifacts/text/server.ts:13-14` | Text artifact prompt | "Write about the given topic" |

### 1.2 Current System Prompt Function Signature

```typescript
// lib/ai/prompts.ts:75-98
export const systemPrompt = ({
  selectedChatModel,
  requestHints,
  customPrompt,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
  customPrompt?: string | null;
}) => { ... }
```

### 1.3 Where System Prompt is Called

**Location:** `app/(chat)/api/chat/route.ts:173-177`

```typescript
const baseSystemPrompt = systemPrompt({
  selectedChatModel,
  requestHints,
  customPrompt: dbUser?.systemPrompt,
});
```

### 1.4 Available User Data Sources

| Data Point | Source | Currently Available |
|------------|--------|---------------------|
| User ID | `auth()` from Clerk | ✅ Yes |
| Email | `currentUser().emailAddresses[0]` | ✅ Yes |
| First Name | `currentUser().firstName` | ✅ Yes (unused) |
| Last Name | `currentUser().lastName` | ✅ Yes (unused) |
| Organization Name | `OrganizationSwitcher` context | ⚠️ Client-side only |
| Timezone | Needs implementation | ❌ No |
| Base Currency | Needs implementation | ❌ No |
| Custom System Prompt | `user.systemPrompt` in DB | ✅ Yes |

---

## 2. Variable Injection Strategy

### 2.1 Required Variables Mapping

| Variable | Source Strategy |
|----------|-----------------|
| `{{FIRST_NAME}}` | `currentUser().firstName ?? "User"` |
| `{{LAST_NAME}}` | `currentUser().lastName ?? ""` |
| `{{COMPANY_NAME}}` | Clerk org membership OR new `userSettings.companyName` |
| `{{TODAY_DATE}}` | `new Date().toLocaleDateString("en-AU")` |
| `{{TIMEZONE}}` | New `userSettings.timezone` field (default: "Australia/Sydney") |
| `{{BASE_CURRENCY}}` | New `userSettings.baseCurrency` field (default: "AUD") |

### 2.2 Proposed Database Schema Extension

**New Table: `UserSettings`**

```sql
-- lib/db/migrations/0013_add_user_settings.sql
CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "companyName" varchar(256),
  "timezone" varchar(64) DEFAULT 'Australia/Sydney',
  "baseCurrency" varchar(3) DEFAULT 'AUD',
  "dateFormat" varchar(20) DEFAULT 'DD/MM/YYYY',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE("userId")
);
```

### 2.3 Alternative: Use Clerk Organization Data

If the user is a member of a Clerk organization, we can fetch organization details server-side:

```typescript
// In app/(chat)/api/chat/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

const { userId, orgId } = await auth();
const user = await currentUser();

let companyName = "Your Company";
if (orgId) {
  const org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
  companyName = org.name;
}
```

### 2.4 Recommended Approach

**Hybrid Strategy:**
1. Create `UserSettings` table for timezone, currency, and date format preferences
2. Use Clerk organization name when available, fallback to `userSettings.companyName`
3. Derive timezone from geolocation as a default, allow user override

---

## 3. Prompt Replacement Logic

### 3.1 New TypeScript Interface

```typescript
// lib/ai/prompts.ts

export interface IntellisyncContext {
  // User identity
  firstName: string;
  lastName: string;

  // Organization
  companyName: string;

  // Locale settings
  timezone: string;
  baseCurrency: string;
  dateFormat: string;

  // Existing
  selectedChatModel: string;
  requestHints: RequestHints;

  // Optional custom prompt (legacy support)
  customPrompt?: string | null;
}

export type DocumentContext = "audit" | "hr" | "internal" | "collections" | "general";
```

### 3.2 New System Prompt Builder

```typescript
// lib/ai/prompts.ts

export const buildIntellisyncPrompt = (ctx: IntellisyncContext): string => {
  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: ctx.timezone,
  });

  return `You are Intellisync, an expert accounting and business administration assistant designed to help ${ctx.firstName} ${ctx.lastName} with ${ctx.companyName} manage financial transactions, bookkeeping, payroll, and compliance tasks for Australian businesses.

**Primary Objective:**
Accurately process and report financial data while ensuring strict compliance with Australian accounting standards, ATO regulations, Fair Work guidelines, and Work Health & Safety (WHS) requirements.

**Core Capabilities:**
- **Financial:** Recording transactions, managing AP/AR, processing GST/BAS, and bank reconciliation.
- **Employment & Payroll:** Single Touch Payroll (STP) guidance, Award interpretation (Fair Work), superannuation compliance, leave entitlements, and National Employment Standards (NES) adherence.
- **Risk & Compliance:** Workers compensation insurance management, WHS incident reporting, safety policy documentation, and statutory record-keeping.
- **Administration:** Drafting business correspondence, meeting minutes, and operational policies.

**Operational Rules:**
1. **Australian Context:** Always use Australian English, Australian Date Format (DD/MM/YYYY), and AUD currency. Apply Australian Privacy Principles (APP).
2. **Action-Oriented:** Implement requested changes directly.
3. **Clarification:** Ask clarifying questions for ambiguous dates, employment categories, or tax codes.
4. **Tone:** Professional/Authoritative on compliance; Friendly/Supportive for general tasks.
5. **HR & Safety Disclaimer:** When discussing Fair Work or WHS, explicitly cite relevant bodies (e.g., Fair Work Ombudsman).

<context>
**Current Date:** ${today} (${ctx.timezone})
**User:** ${ctx.firstName} ${ctx.lastName}
**Organisation:** ${ctx.companyName}
**Base Currency:** ${ctx.baseCurrency} (Default: AUD)
</context>

<tone_guide>
- **Board/Audit:** Formal + Authoritative.
- **HR/Employment:** Professional + Empathetic. Strict adherence to terminology (e.g., 'termination' vs 'dismissal').
- **Internal/Team:** Friendly + Assertive.
- **Collections:** Professional -> Firm.
</tone_guide>`;
};
```

### 3.3 Updated Artifact Prompts

```typescript
// lib/ai/prompts.ts

export const intellisyncArtifactsPrompt = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks.

**CRITICAL ARTIFACT RULES:**

1. **Titles:** All artifact titles MUST be 2-5 words maximum (e.g., "BAS Summary Q1", "Staff Warning Letter").

2. **Document Types & Tone:**
   - Audit/Compliance: Formal, authoritative tone. Include disclaimer re professional advice.
   - HR/Employment: Professional + empathetic. Use correct terminology ("termination" not "firing").
   - Internal/Team: Friendly, assertive.
   - Collections: Start professional, escalate to firm.

3. **Australian Formatting:**
   - Dates: DD/MM/YYYY format always
   - Currency: AUD with $ symbol, two decimal places
   - Numbers: Use commas for thousands (1,000.00)

${artifactsPrompt}
`;

export const intellisyncCodePrompt = `
You are an Australian business code generator. When writing code:

1. **Currency Handling:** ALWAYS use \`Decimal\` type for monetary values, NEVER use floats
2. **Date Formatting:** Use DD/MM/YYYY format (Australian standard)
3. **GST Calculations:** Default GST rate is 10%
4. **Rounding:** Use ROUND_HALF_UP for financial calculations

Example for currency:
\`\`\`python
from decimal import Decimal, ROUND_HALF_UP

def calculate_gst(amount: Decimal) -> tuple[Decimal, Decimal]:
    """Calculate GST amount and total including GST."""
    gst_rate = Decimal("0.10")
    gst_amount = (amount * gst_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = amount + gst_amount
    return gst_amount, total

# Example: Calculate GST on $1,000
net_amount = Decimal("1000.00")
gst, total = calculate_gst(net_amount)
print(f"Net: ${net_amount:,.2f}, GST: ${gst:,.2f}, Total: ${total:,.2f}")
\`\`\`

${codePrompt}
`;

export const intellisyncSheetPrompt = `
You are an Australian business spreadsheet assistant. When creating spreadsheets:

**CRITICAL CSV FORMATTING RULES:**
1. Use literal \\n characters for row separators - do NOT use actual newlines within the CSV string
2. Ensure all rows have the same number of columns
3. Quote fields containing commas, quotes, or special characters
4. For monetary values, format as numbers without $ symbol (use column headers to indicate AUD)

**Australian Business Standards:**
- Date columns: DD/MM/YYYY format
- Currency columns: Numeric only, 2 decimal places
- ABN format: XX XXX XXX XXX (11 digits with spaces)
- Tax File Number: Never include in spreadsheets

**Example Output:**
\`\`\`csv
Date,Description,Amount,GST,Total\\n01/07/2024,Office Supplies,100.00,10.00,110.00\\n15/07/2024,Software License,500.00,50.00,550.00
\`\`\`

Create a spreadsheet in CSV format based on the given prompt.
`;

export const intellisyncTextPrompt = (documentContext: DocumentContext) => {
  const toneGuide = {
    audit: "Use formal, authoritative language. Include appropriate disclaimers about seeking professional advice.",
    hr: "Use professional yet empathetic language. Be precise with employment terminology. Reference Fair Work Ombudsman or Safe Work Australia where relevant.",
    internal: "Use friendly, assertive language appropriate for team communications.",
    collections: "Start with professional tone, escalate appropriately in subsequent communications.",
    general: "Use Australian English with professional but approachable tone.",
  };

  return `Write about the given topic using Australian English conventions.

**Tone:** ${toneGuide[documentContext]}

**Formatting:**
- Use DD/MM/YYYY for all dates
- Use Australian spelling (organisation, colour, favour)
- Reference Australian legislation and bodies where relevant

Markdown is supported. Use headings wherever appropriate.`;
};
```

---

## 4. CSV Safety & Post-Processing

### 4.1 The Problem

LLMs often generate CSV with actual newlines instead of `\n` escape sequences, causing parsing failures in the UI.

### 4.2 Solution: CSV Validation Utility

```typescript
// lib/utils/csv-validation.ts

export interface CSVValidationResult {
  isValid: boolean;
  sanitizedCSV: string;
  errors: string[];
  rowCount: number;
  columnCount: number;
}

/**
 * Validates and sanitizes CSV content from LLM output.
 * Ensures consistent column counts and proper newline handling.
 */
export function validateAndSanitizeCSV(rawCSV: string): CSVValidationResult {
  const errors: string[] = [];

  // Normalize line endings
  let csv = rawCSV
    .replace(/\\n/g, "\n")  // Convert escaped newlines to actual
    .replace(/\r\n/g, "\n") // Normalize Windows line endings
    .replace(/\r/g, "\n")   // Normalize old Mac line endings
    .trim();

  // Parse into rows
  const rows = parseCSVRows(csv);

  if (rows.length === 0) {
    return {
      isValid: false,
      sanitizedCSV: "",
      errors: ["Empty CSV content"],
      rowCount: 0,
      columnCount: 0,
    };
  }

  // Validate column consistency
  const columnCounts = rows.map(row => row.length);
  const expectedColumns = columnCounts[0];
  const inconsistentRows = columnCounts
    .map((count, idx) => count !== expectedColumns ? idx + 1 : null)
    .filter(Boolean);

  if (inconsistentRows.length > 0) {
    errors.push(`Inconsistent column count in rows: ${inconsistentRows.join(", ")}`);
  }

  // Rebuild sanitized CSV
  const sanitizedCSV = rows
    .map(row => row.map(cell => escapeCSVCell(cell)).join(","))
    .join("\n");

  return {
    isValid: errors.length === 0,
    sanitizedCSV,
    errors,
    rowCount: rows.length,
    columnCount: expectedColumns ?? 0,
  };
}

function parseCSVRows(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  // Don't forget the last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

function escapeCSVCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}
```

### 4.3 Integration Point

Modify `artifacts/sheet/server.ts` to validate CSV before returning:

```typescript
// artifacts/sheet/server.ts
import { validateAndSanitizeCSV } from "@/lib/utils/csv-validation";

// In onCreateDocument after generation:
const validation = validateAndSanitizeCSV(draftContent);
if (!validation.isValid) {
  console.warn("CSV validation warnings:", validation.errors);
}
return validation.sanitizedCSV;
```

---

## 5. Implementation Steps

### Phase 1: Database Schema (Day 1)

| Step | File | Action |
|------|------|--------|
| 1.1 | `lib/db/migrations/0013_add_user_settings.sql` | Create migration file |
| 1.2 | `lib/db/schema.ts` | Add `userSettings` table definition |
| 1.3 | `lib/db/queries.ts` | Add CRUD functions for user settings |
| 1.4 | Run `pnpm db:migrate` | Apply migration |

### Phase 2: Prompt System (Day 1-2)

| Step | File | Action |
|------|------|--------|
| 2.1 | `lib/ai/prompts.ts` | Add `IntellisyncContext` interface |
| 2.2 | `lib/ai/prompts.ts` | Add `buildIntellisyncPrompt()` function |
| 2.3 | `lib/ai/prompts.ts` | Add `intellisyncArtifactsPrompt` |
| 2.4 | `lib/ai/prompts.ts` | Add `intellisyncCodePrompt` |
| 2.5 | `lib/ai/prompts.ts` | Add `intellisyncSheetPrompt` |
| 2.6 | `lib/ai/prompts.ts` | Add `intellisyncTextPrompt()` |
| 2.7 | `lib/ai/prompts.ts` | Keep legacy exports for backward compatibility |

### Phase 3: Chat API Integration (Day 2)

| Step | File | Action |
|------|------|--------|
| 3.1 | `app/(chat)/api/chat/route.ts` | Import new prompt builders |
| 3.2 | `app/(chat)/api/chat/route.ts` | Fetch user settings from DB |
| 3.3 | `app/(chat)/api/chat/route.ts` | Extract user name from Clerk |
| 3.4 | `app/(chat)/api/chat/route.ts` | Get organization name from Clerk |
| 3.5 | `app/(chat)/api/chat/route.ts` | Build `IntellisyncContext` object |
| 3.6 | `app/(chat)/api/chat/route.ts` | Call `buildIntellisyncPrompt()` |

### Phase 4: Artifact Updates (Day 2-3)

| Step | File | Action |
|------|------|--------|
| 4.1 | `artifacts/code/server.ts` | Use `intellisyncCodePrompt` |
| 4.2 | `artifacts/sheet/server.ts` | Use `intellisyncSheetPrompt` |
| 4.3 | `artifacts/text/server.ts` | Use `intellisyncTextPrompt()` |
| 4.4 | `lib/utils/csv-validation.ts` | Create CSV validation utility |
| 4.5 | `artifacts/sheet/server.ts` | Integrate CSV validation |

### Phase 5: Settings UI (Day 3)

| Step | File | Action |
|------|------|--------|
| 5.1 | `app/(chat)/settings/personalisation/page.tsx` | Add company name input |
| 5.2 | `app/(chat)/settings/personalisation/page.tsx` | Add timezone selector |
| 5.3 | `app/(chat)/settings/personalisation/page.tsx` | Add currency selector |
| 5.4 | `app/(auth)/personalization-actions.ts` | Add settings save/load actions |

### Phase 6: Testing & Verification (Day 4)

| Test Case | Expected Behavior |
|-----------|------------------|
| Generate Warning Letter | HR disclaimer appears, uses "termination" terminology |
| Create BAS Summary | Uses DD/MM/YYYY dates, AUD currency |
| Generate CSV Report | Valid CSV with proper newlines, consistent columns |
| Code with currency | Uses `Decimal` type, not `float` |
| Greeting message | Includes user name and company name |
| Date references | All dates in DD/MM/YYYY format |

---

## 6. Files to Create or Modify

### New Files

| File | Purpose |
|------|---------|
| `lib/db/migrations/0013_add_user_settings.sql` | Database migration |
| `lib/utils/csv-validation.ts` | CSV sanitization utility |

### Modified Files

| File | Changes |
|------|---------|
| `lib/db/schema.ts` | Add `userSettings` table |
| `lib/db/queries.ts` | Add settings CRUD functions |
| `lib/ai/prompts.ts` | New Intellisync prompts + interfaces |
| `app/(chat)/api/chat/route.ts` | Context building and new prompt usage |
| `artifacts/code/server.ts` | Use new code prompt |
| `artifacts/sheet/server.ts` | Use new sheet prompt + CSV validation |
| `artifacts/text/server.ts` | Use new text prompt with context |
| `app/(auth)/personalization-actions.ts` | Settings actions |
| `app/(chat)/settings/personalisation/page.tsx` | Settings UI |

---

## 7. Rollback Plan

If issues arise:

1. **Prompt rollback:** Keep existing exports (`systemPrompt`, `regularPrompt`) functional
2. **Database rollback:** `0013_rollback_user_settings.sql` to drop new table
3. **Feature flag:** Add `INTELLISYNC_PROMPTS_ENABLED` env var to toggle between old/new

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Date format compliance | 100% DD/MM/YYYY in outputs |
| Currency handling in code | 100% use `Decimal` type |
| CSV validation pass rate | >95% first-generation success |
| HR document disclaimers | 100% include FWO reference |
| User context injection | User name appears in greeting |

---

## 9. Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Clerk SDK | Organization data access | Already installed |
| `Intl.DateTimeFormat` | Timezone formatting | Built into Node.js |
| Drizzle ORM | Database operations | Already installed |

---

## Appendix A: Full Prompt Text Reference

See target prompt content in the original task description.

## Appendix B: Clerk Organization Data Access

```typescript
// Server-side organization access
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function getOrganizationContext() {
  const { orgId } = await auth();

  if (!orgId) {
    return null;
  }

  const client = await clerkClient();
  const org = await client.organizations.getOrganization({
    organizationId: orgId
  });

  return {
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt,
  };
}
```

---

**Document Version:** 1.0
**Created:** 2026-01-13
**Author:** Claude (Migration Planning Agent)
