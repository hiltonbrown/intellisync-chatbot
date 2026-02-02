# Spreadsheet Border Color Comparison - Dark Mode

## Current State

**Cell Backgrounds:**

- Data cells: `zinc-950` → `#09090b` (RGB: 9, 9, 11)
- Header cells: `zinc-900` → `#18181b` (RGB: 24, 24, 27)

**Current Border Color:**

- `--border` variable → `hsl(240 3.7% 15.9%)` → `#27272a` (RGB: 39, 39, 42)

**Problem:** Very low contrast - borders are barely visible against the dark cell backgrounds.

---

## Proposed Border Color Options

### Option 1: zinc-700 (Subtle Enhancement)

```
Color: #3f3f46
RGB: 63, 63, 70
HSL: 240° 3% 26%
```

**Contrast Ratios:**

- Against zinc-950 (#09090b): ~1.8:1
- Against zinc-900 (#18181b): ~1.5:1

**Visual Effect:** Subtle but noticeable improvement. Borders are visible without being distracting. Maintains a cohesive dark aesthetic.

**Best For:** Users who prefer minimal visual noise and a sleek, modern look.

---

### Option 2: zinc-600 (Balanced Contrast) ⭐ RECOMMENDED

```
Color: #52525b
RGB: 82, 82, 91
HSL: 240° 5% 34%
```

**Contrast Ratios:**

- Against zinc-950 (#09090b): ~2.4:1
- Against zinc-900 (#18181b): ~2.0:1

**Visual Effect:** Clear, well-defined borders that provide good visual separation between cells. Strikes a balance between visibility and aesthetics.

**Best For:** Most users - provides clear cell boundaries while maintaining the dark theme.

---

### Option 3: zinc-500 (High Contrast)

```
Color: #71717a
RGB: 113, 113, 122
HSL: 240° 4% 46%
```

**Contrast Ratios:**

- Against zinc-950 (#09090b): ~3.5:1
- Against zinc-900 (#18181b): ~2.9:1

**Visual Effect:** Bold, prominent borders. Very clear cell separation. May feel slightly "grid-heavy" for some users.

**Best For:** Users who need maximum clarity or work with complex spreadsheets requiring clear cell delineation.

---

### Option 4: zinc-400 (Very High Contrast)

```
Color: #a1a1aa
RGB: 161, 161, 170
HSL: 240° 5% 65%
```

**Contrast Ratios:**

- Against zinc-950 (#09090b): ~5.8:1
- Against zinc-900 (#18181b): ~4.8:1

**Visual Effect:** Very prominent borders. Excellent for accessibility but may dominate the visual hierarchy.

**Best For:** Accessibility-focused applications or users with visual impairments.

---

## Visual Comparison

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT (zinc-border)                     │
│  ┌────────┬────────┬────────┐                               │
│  │ Header │ Header │ Header │  ← Barely visible borders     │
│  ├────────┼────────┼────────┤                               │
│  │  Cell  │  Cell  │  Cell  │                               │
│  ├────────┼────────┼────────┤                               │
│  │  Cell  │  Cell  │  Cell  │                               │
│  └────────┴────────┴────────┘                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    OPTION 1 (zinc-700)                       │
│  ┏━━━━━━━━┳━━━━━━━━┳━━━━━━━━┓                               │
│  ┃ Header ┃ Header ┃ Header ┃  ← Subtle but visible         │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┗━━━━━━━━┻━━━━━━━━┻━━━━━━━━┛                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    OPTION 2 (zinc-600) ⭐                    │
│  ┏━━━━━━━━┳━━━━━━━━┳━━━━━━━━┓                               │
│  ┃ Header ┃ Header ┃ Header ┃  ← Clear and balanced         │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┗━━━━━━━━┻━━━━━━━━┻━━━━━━━━┛                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    OPTION 3 (zinc-500)                       │
│  ┏━━━━━━━━┳━━━━━━━━┳━━━━━━━━┓                               │
│  ┃ Header ┃ Header ┃ Header ┃  ← Bold and prominent         │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┗━━━━━━━━┻━━━━━━━━┻━━━━━━━━┛                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    OPTION 4 (zinc-400)                       │
│  ┏━━━━━━━━┳━━━━━━━━┳━━━━━━━━┓                               │
│  ┃ Header ┃ Header ┃ Header ┃  ← Very prominent             │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┣━━━━━━━━╋━━━━━━━━╋━━━━━━━━┫                               │
│  ┃  Cell  ┃  Cell  ┃  Cell  ┃                               │
│  ┗━━━━━━━━┻━━━━━━━━┻━━━━━━━━┛                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Recommendation

**zinc-600 (#52525b)** is recommended as it provides:

- ✅ Clear visual separation between cells
- ✅ Good contrast without being overwhelming
- ✅ Maintains the dark theme aesthetic
- ✅ Suitable for most use cases and user preferences
- ✅ Balances functionality with visual design

---

## Implementation

The change will be made in [`components/sheet-editor.tsx`](../components/sheet-editor.tsx) by adding dark mode border color classes:

**Current:**

```typescript
cellClass: "border-t border-r dark:bg-zinc-950 dark:text-zinc-50";
```

**Updated:**

```typescript
cellClass: "border-t border-r dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";
```

This will be applied to:

1. Row number column cells and headers
2. Data column cells and headers
3. All border directions (top, right, left)

---

## Color Palette Reference

| Zinc Shade | Hex     | RGB           | Use Case                  |
| ---------- | ------- | ------------- | ------------------------- |
| zinc-950   | #09090b | 9, 9, 11      | Cell background           |
| zinc-900   | #18181b | 24, 24, 27    | Header background         |
| zinc-800   | #27272a | 39, 39, 42    | Current border (too dark) |
| zinc-700   | #3f3f46 | 63, 63, 70    | Option 1: Subtle          |
| zinc-600   | #52525b | 82, 82, 91    | Option 2: Balanced ⭐     |
| zinc-500   | #71717a | 113, 113, 122 | Option 3: High contrast   |
| zinc-400   | #a1a1aa | 161, 161, 170 | Option 4: Very high       |
| zinc-50    | #fafafa | 250, 250, 250 | Text color                |
