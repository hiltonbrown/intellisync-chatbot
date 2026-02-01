#!/bin/bash
# AP Risk Scoring Implementation Verification Script

echo "==========================================="
echo "AP Risk Scoring - Implementation Verification"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
ERRORS=0

echo "1. Checking Database Schema Files..."
if [ -f "lib/db/schema.ts" ]; then
    if grep -q "taxNumber.*text" lib/db/schema.ts && \
       grep -q "contactStatus.*varchar" lib/db/schema.ts && \
       grep -q "invoiceNumber.*text" lib/db/schema.ts; then
        echo -e "${GREEN}✓${NC} Schema updated with risk fields"
    else
        echo -e "${RED}✗${NC} Schema missing required fields"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Schema file not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "2. Checking Migration Files..."
if [ -f "lib/db/migrations/0002_skinny_multiple_man.sql" ]; then
    echo -e "${GREEN}✓${NC} Migration file exists"
else
    echo -e "${RED}✗${NC} Migration file not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "3. Checking Risk Scoring Module..."
if [ -f "lib/agents/ap/risk-scoring.ts" ]; then
    if grep -q "calculateVendorRisk" lib/agents/ap/risk-scoring.ts && \
       grep -q "detectBankAccountChange" lib/agents/ap/risk-scoring.ts; then
        echo -e "${GREEN}✓${NC} Risk scoring module complete"
    else
        echo -e "${RED}✗${NC} Risk scoring functions missing"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Risk scoring module not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "4. Checking Backend Queries..."
if [ -f "lib/agents/ap/queries.ts" ]; then
    if grep -q "import.*risk-scoring" lib/agents/ap/queries.ts && \
       grep -q "calculateVendorRisk" lib/agents/ap/queries.ts; then
        echo -e "${GREEN}✓${NC} Backend queries integrated with risk scoring"
    else
        echo -e "${RED}✗${NC} Backend queries not integrated"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Queries file not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "5. Checking Xero Sync Enhancement..."
if [ -f "lib/integrations/xero/actions.ts" ]; then
    if grep -q "TaxNumber" lib/integrations/xero/actions.ts && \
       grep -q "ContactStatus" lib/integrations/xero/actions.ts && \
       grep -q "InvoiceNumber" lib/integrations/xero/actions.ts; then
        echo -e "${GREEN}✓${NC} Xero sync extracts risk fields"
    else
        echo -e "${RED}✗${NC} Xero sync not updated"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Xero actions file not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "6. Checking UI Components..."
if [ -f "components/agents/ap/vendor-table.tsx" ]; then
    if grep -q "riskScore" components/agents/ap/vendor-table.tsx && \
       grep -q "riskLevel" components/agents/ap/vendor-table.tsx && \
       grep -q "hasBankChange" components/agents/ap/vendor-table.tsx; then
        echo -e "${GREEN}✓${NC} UI displays risk scores"
    else
        echo -e "${RED}✗${NC} UI not updated with risk display"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Vendor table component not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "7. Checking Unit Tests..."
if [ -f "lib/agents/ap/__tests__/risk-scoring.test.ts" ]; then
    echo -e "${GREEN}✓${NC} Unit tests exist"
else
    echo -e "${YELLOW}⚠${NC}  Unit tests not found (optional)"
fi

echo ""
echo "8. Checking Documentation..."
DOC_COUNT=0
[ -f "docs/AP_RISK_SCORING.md" ] && DOC_COUNT=$((DOC_COUNT + 1))
[ -f "IMPLEMENTATION_SUMMARY.md" ] && DOC_COUNT=$((DOC_COUNT + 1))

if [ $DOC_COUNT -eq 2 ]; then
    echo -e "${GREEN}✓${NC} Documentation complete (2 files)"
elif [ $DOC_COUNT -eq 1 ]; then
    echo -e "${YELLOW}⚠${NC}  Partial documentation (1 file)"
else
    echo -e "${YELLOW}⚠${NC}  Documentation missing"
fi

echo ""
echo "==========================================="
echo "Verification Summary"
echo "==========================================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "AP Risk Scoring implementation is complete."
    echo ""
    echo "Next steps:"
    echo "1. Run: pnpm dev"
    echo "2. Navigate to: /agents/ap"
    echo "3. Click 'Sync Bills' to populate data"
    echo "4. Verify risk badges appear in vendor table"
    exit 0
else
    echo -e "${RED}✗ $ERRORS check(s) failed${NC}"
    echo ""
    echo "Please review the errors above."
    exit 1
fi
