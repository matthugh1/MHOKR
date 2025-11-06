# OKR Trio Audit - Design Review (PM + PD)

**Date:** 2025-01-XX  
**Reviewers:** Product Manager, Product Director  
**Scope:** OKR List view and Tree/Builder view

---

## A. Information Hierarchy

### A.1 Header Structure

**Current Implementation:**
- ✅ **Header:** Page title "Objectives & Key Results" with subtitle
- ✅ **Badges:** Cycle badge ("Viewing: Q4 2025"), Lock warning badge
- ✅ **View Toggle:** List/Tree toggle (feature-flag gated)
- ✅ **Cycle Health Strip:** Non-interactive summary below header

**Findings:**
- ✅ **Correct:** Header uses `<header role="banner">` semantic HTML
- ✅ **Correct:** Cycle Health Strip is non-interactive (no onClick handlers)
- ⚠️ **Issue:** Header spacing could be tighter (mb-8 may be too much)
- ⚠️ **Issue:** View toggle placement (top-right) may be hard to discover

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:782-836` (header structure)

---

### A.2 Toolbar Structure

**Current Implementation:**
- ✅ **Left:** Search input, Status filter chips, Cycle selector, Clear filters button
- ✅ **Right:** Scope toggle, Needs Attention button, Add button (split-button)

**Findings:**
- ✅ **Correct:** Filters grouped logically (search, status, cycle)
- ⚠️ **Issue:** Toolbar may wrap on small screens (flex-wrap enabled but no min-width constraints)
- ⚠️ **Issue:** Status chips use inconsistent spacing (`gap-2` vs `gap-4`)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:839-1119
<div className="flex items-center justify-between gap-3 flex-wrap">
  {/* Left: Filters */}
  <div className="flex items-center gap-4 flex-wrap flex-1 min-w-0">
    {/* Search, Status chips, Cycle selector */}
  </div>
  {/* Right: Scope Toggle + Actions */}
  <div className="flex items-center gap-3 flex-shrink-0">
    {/* Scope toggle, Attention button, Add button */}
  </div>
</div>
```

**Recommendation:**
- Add `min-w-[200px]` to search input to prevent excessive shrinking
- Standardize gap spacing: use `gap-3` consistently in toolbar
- Consider responsive breakpoints: stack filters vertically on mobile

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:839-1119`

---

## B. Consistency Between List and Builder

### B.1 Icons

**Findings:**
- ✅ **Consistent:** Same icons used for actions (Edit, Delete, History, Plus)
- ✅ **Consistent:** Status badges use same `OkrBadge` component
- ⚠️ **Issue:** Tree view uses different expand/collapse icons (ChevronDown/ChevronUp) vs List view (ChevronDown only)

**Recommendation:**
- Standardize expand/collapse icons: use ChevronDown/ChevronUp consistently
- Document icon usage in design system

**Files:**
- `apps/web/src/components/okr/ObjectiveRow.tsx` (List view icons)
- `apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx` (Tree view icons)

---

### B.2 Chip Styles

**Findings:**
- ✅ **Consistent:** Status badges use `OkrBadge` component with tone prop
- ✅ **Consistent:** Publish state badges use same component
- ⚠️ **Issue:** Cycle Health Strip badges use `Badge` component (different from `OkrBadge`)
- ⚠️ **Issue:** Inconsistent badge sizing (`text-xs` vs `text-sm`)

**Code Evidence:**
```typescript
// apps/web/src/components/okr/CycleHealthStrip.tsx:67-92
<Badge variant="outline" className="text-xs" aria-label="...">
  <span className="text-xs font-medium">{summary.objectives.total}</span>
  <span className="text-xs text-muted-foreground ml-1">Objectives</span>
</Badge>
```

**Recommendation:**
- Use `OkrBadge` component consistently (replace `Badge` in CycleHealthStrip)
- Standardize badge text size: use `text-xs` for all badges

**Files:**
- `apps/web/src/components/okr/CycleHealthStrip.tsx:67-92`
- `apps/web/src/components/okr/OkrBadge.tsx`

---

### B.3 Spacing

**Findings:**
- ✅ **Consistent:** Row spacing uses `space-y-1` in Tree view, `space-y-4` in List view (appropriate for different densities)
- ⚠️ **Issue:** Inconsistent padding in expanded rows (List: `p-4`, Tree: `px-3 py-2`)
- ⚠️ **Issue:** Section spacing inconsistent (`SECTION_SPACING = 40` in List, no equivalent in Tree)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:77
const SECTION_SPACING = 40 // Spacing between sections

// apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:386
className="flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-neutral-50"
```

**Recommendation:**
- Standardize padding: use `p-4` for expanded rows in both views
- Document spacing tokens in design system (SECTION_SPACING, ROW_SPACING)

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:73-103`
- `apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:386`

---

### B.4 Truncation

**Findings:**
- ✅ **Consistent:** Titles use `truncate` class in both views
- ✅ **Consistent:** Long titles ellipsize correctly
- ⚠️ **Issue:** No tooltip on truncated titles (users can't see full text)
- ⚠️ **Issue:** Truncation length not standardized (depends on container width)

**Recommendation:**
- Add tooltip to truncated titles: show full text on hover
- Consider max-width constraint: `max-w-[400px]` for titles

**Files:**
- `apps/web/src/components/okr/ObjectiveRow.tsx` (title truncation)
- `apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:400` (title truncation)

---

## C. Empty/Loading/Error States

### C.1 Empty States

**Findings:**
- ✅ **Present:** Empty state shown when no OKRs (`OKRPageContainer.tsx:471-484`)
- ✅ **Present:** Empty state distinguishes "unassigned" vs "filtered" vs "no OKRs"
- ⚠️ **Issue:** Empty state not role-aware (doesn't show "Create Objective" button for admins)
- ⚠️ **Issue:** Empty state styling inconsistent (uses `rounded-xl` vs `rounded-lg`)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:471-484
<div className="text-center py-12">
  <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm text-neutral-600">
    {/* Empty state message */}
  </div>
</div>
```

**Recommendation:**
- Add role-aware empty state (see Product Review §B.4)
- Standardize empty state styling: use `rounded-lg` and `p-6` (per design system)

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:471-484`

---

### C.2 Loading States

**Findings:**
- ✅ **Present:** Loading skeleton shown (`OkrRowSkeleton` component)
- ✅ **Present:** Loading state uses `aria-busy={loading}`
- ⚠️ **Issue:** Loading skeleton count hardcoded (5 skeletons, may not match actual data)
- ⚠️ **Issue:** No loading state for Tree view (shows nothing while fetching)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:489-495
{loading && (
  <div className="space-y-4 md:space-y-6">
    {Array.from({ length: 5 }).map((_, i) => (
      <OkrRowSkeleton key={`skeleton-${i}`} />
    ))}
  </div>
)}
```

**Recommendation:**
- Use `pageSize` to determine skeleton count (not hardcoded 5)
- Add loading state for Tree view (skeleton tree nodes)

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:489-495`
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx` (no loading state)

---

### C.3 Error States

**Findings:**
- ✅ **Present:** Error message shown for permission errors (`permissionError` state)
- ✅ **Present:** Error uses `role="alert"` for accessibility
- ⚠️ **Issue:** Error messages are generic ("Failed to load OKRs")
- ⚠️ **Issue:** No retry button on error state

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:497-501
{!loading && permissionError && (
  <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive" role="alert">
    {permissionError}
  </div>
)}
```

**Recommendation:**
- Enhance error messages: show specific error reason (403, 404, 500)
- Add retry button: "Try again" button on error state

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:297-309` (error handling)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:497-501` (error display)

---

## D. Accessibility (a11y)

### D.1 Semantic Roles

**Findings:**
- ✅ **Correct:** Header uses `role="banner"`
- ✅ **Correct:** Main content uses `role="main"`
- ✅ **Correct:** Filter groups use `role="group"` with `aria-label`
- ✅ **Correct:** Tree view uses `role="tree"` and `role="treeitem"`
- ✅ **Correct:** Pagination uses `role="navigation"` with `aria-label="Pagination"`
- ⚠️ **Issue:** List view rows don't use semantic list roles (`<ul>`/`<li>`)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:782
<header role="banner" className="mb-8">

// apps/web/src/app/dashboard/okrs/page.tsx:1133
<main role="main" aria-busy={false} aria-label={viewMode === 'tree' ? 'OKRs tree' : 'OKRs list'}>

// apps/web/src/app/dashboard/okrs/components/OKRTreeView.tsx:345
<div role="tree" aria-label="OKR hierarchy">
```

**Recommendation:**
- Wrap List view rows in `<ul>` with `role="list"` and each row as `<li role="listitem">`
- Document semantic roles in accessibility guide

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:105-283`
- `apps/web/src/app/dashboard/okrs/components/OKRTreeView.tsx:345`

---

### D.2 Focus States

**Findings:**
- ✅ **Correct:** All interactive elements use `focus:ring-2 focus:ring-ring focus:outline-none`
- ✅ **Correct:** Focus ring visible (2px ring with offset)
- ⚠️ **Issue:** Focus ring color uses `ring-ring` (may not have sufficient contrast)
- ⚠️ **Issue:** No visible focus indicator for keyboard navigation in Tree view (only ring on click)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:805
className="... focus:ring-2 focus:ring-ring focus:outline-none"
```

**Recommendation:**
- Verify focus ring contrast: ensure `ring-ring` meets WCAG AA (4.5:1)
- Add visible focus indicator for Tree view nodes (use `focus-visible:` pseudo-class)

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:805-1051` (focus styles)
- `apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:177-392` (Tree node focus)

---

### D.3 ARIA Labels

**Findings:**
- ✅ **Correct:** Scope toggle uses `aria-label="Scope filter"`
- ✅ **Correct:** Status filter buttons use `aria-label="Filter by status: ..."`
- ✅ **Correct:** View toggle uses `aria-label="View mode"`
- ✅ **Correct:** Pagination buttons use `aria-label="Previous page"` / `aria-label="Next page"`
- ✅ **Correct:** Tree nodes use `aria-level`, `aria-expanded`, `aria-selected`
- ⚠️ **Issue:** Some buttons missing `aria-label` (rely on text content, which is fine but not ideal)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:963
<div className="..." role="group" aria-label="Scope filter">

// apps/web/src/app/dashboard/okrs/page.tsx:876
aria-label="Filter by status: On track"

// apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:114-116
'aria-level': ariaLevel,
'aria-expanded': ariaExpanded,
'aria-selected': ariaSelected,
```

**Recommendation:**
- Add `aria-label` to icon-only buttons (Needs Attention, Add button)
- Document ARIA label patterns in accessibility guide

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:1011-1030` (Needs Attention button)
- `apps/web/src/app/dashboard/okrs/page.tsx:1036-1056` (Add button)

---

### D.4 Keyboard Navigation

**Findings:**
- ✅ **Correct:** Tree view supports keyboard navigation (Arrow keys, Enter, Space)
- ✅ **Correct:** Filter buttons keyboard accessible (Tab navigation)
- ✅ **Correct:** Tree nodes use `tabIndex={0}` for keyboard focus
- ⚠️ **Issue:** List view rows not keyboard navigable (no Tab/Arrow key support)
- ⚠️ **Issue:** No keyboard shortcut documentation

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/components/OKRTreeView.tsx:130-165
const handleKeyDown = (e: React.KeyboardEvent) => {
  // Arrow keys, Enter, Space handling
}

// apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:140-175
const handleKeyDown = (e: React.KeyboardEvent) => {
  // Keyboard navigation for tree nodes
}
```

**Recommendation:**
- Add keyboard navigation to List view rows (Arrow keys to navigate, Enter to expand)
- Document keyboard shortcuts: Arrow keys, Enter, Space, Esc

**Files:**
- `apps/web/src/app/dashboard/okrs/components/OKRTreeView.tsx:130-165` (Tree keyboard nav)
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx` (no keyboard nav)

---

## E. Density/Performance

### E.1 Virtualisation

**Findings:**
- ✅ **Correct:** List view uses window-based virtualisation (`OKRListVirtualised`)
- ✅ **Correct:** Row height calculated dynamically (`calculateExpandedRowHeight`)
- ✅ **Correct:** Buffer rows configured (`BUFFER_ROWS = 2`)
- ⚠️ **Issue:** Row height estimates may be inaccurate (120px base, 200px expanded base)
- ⚠️ **Issue:** No performance monitoring (no telemetry for scroll FPS)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:73-103
const ROW_HEIGHT_ESTIMATE = 120
const EXPANDED_ROW_BASE_HEIGHT = 200
const KEY_RESULT_HEIGHT_ESTIMATE = 120
const INITIATIVE_HEIGHT_ESTIMATE = 90
const BUFFER_ROWS = 2
```

**Recommendation:**
- Measure actual row heights: use `ResizeObserver` to measure and update estimates
- Add performance telemetry: track scroll FPS, render time

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:73-283`

---

### E.2 Tree View Performance

**Findings:**
- ⚠️ **Issue:** Tree view loads ALL objectives upfront (no pagination)
- ⚠️ **Issue:** Performance degrades with large datasets (>100 objectives)
- ⚠️ **Issue:** No lazy loading (all nodes rendered even if collapsed)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx:192-245
// Fetches all objectives using pagination (max pageSize is 50)
let allObjectives: any[] = []
let currentPage = 1
let hasMore = true
while (hasMore) {
  // Fetch all pages...
}
```

**Recommendation:**
- Implement lazy loading: only render expanded branches
- Add performance warning: show message if >100 objectives loaded
- Consider pagination: limit initial load to 50 objectives

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx:192-245`

---

## F. Specific Spacing/Typography/Token Issues

### F.1 Spacing Issues

| Location | Issue | Current | Recommended |
|----------|-------|---------|-------------|
| `page.tsx:782` | Header margin | `mb-8` | `mb-6` (tighter) |
| `page.tsx:839` | Toolbar gap | `gap-3` | `gap-3` (consistent) |
| `OKRListVirtualised.tsx:77` | Section spacing | `40px` (hardcoded) | Use token: `SECTION_SPACING` |
| `OKRTreeNode.tsx:386` | Node padding | `px-3 py-2` | `p-4` (consistent) |

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:782, 839`
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:77`
- `apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:386`

---

### F.2 Typography Issues

| Location | Issue | Current | Recommended |
|----------|-------|---------|-------------|
| `CycleHealthStrip.tsx:73` | Badge text | `text-xs` | `text-xs` (consistent) |
| `ObjectiveRow.tsx` | Title size | `text-sm` | `text-sm font-medium` (hierarchy) |
| `OKRTreeNode.tsx:400` | Title size | `text-sm font-normal` | `text-sm font-medium` (consistent) |

**Files:**
- `apps/web/src/components/okr/CycleHealthStrip.tsx:73`
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- `apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx:400`

---

### F.3 Token Issues

**Findings:**
- ⚠️ **Issue:** Hardcoded spacing values (`40px` for SECTION_SPACING)
- ⚠️ **Issue:** Inconsistent use of design tokens (some use Tailwind classes, some use hardcoded values)
- ⚠️ **Issue:** No centralized spacing token file

**Recommendation:**
- Create spacing tokens file: `tokens/spacing.ts` with `SECTION_SPACING = 40`
- Use Tailwind classes consistently: prefer `gap-4` over hardcoded `40px`
- Document token usage in `DESIGN_SYSTEM.md`

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:77` (hardcoded spacing)

---

## G. Accessibility Gaps Summary

### Critical (Must Fix)

1. **List view rows not keyboard navigable**
   - **Impact:** Users cannot navigate list with keyboard
   - **Fix:** Add Arrow key navigation, Enter to expand

2. **Focus ring contrast may be insufficient**
   - **Impact:** Users may not see focus indicator
   - **Fix:** Verify `ring-ring` color meets WCAG AA (4.5:1)

### Major (Should Fix)

3. **No tooltip on truncated titles**
   - **Impact:** Users cannot see full title text
   - **Fix:** Add tooltip on hover for truncated titles

4. **Tree view no loading state**
   - **Impact:** Users see blank screen while loading
   - **Fix:** Add skeleton tree nodes

### Minor (Could Fix)

5. **Missing aria-label on icon buttons**
   - **Impact:** Screen readers may not announce button purpose
   - **Fix:** Add `aria-label` to Needs Attention, Add buttons

6. **No keyboard shortcut documentation**
   - **Impact:** Users don't know keyboard shortcuts exist
   - **Fix:** Add keyboard shortcuts help modal or documentation

---

## H. Screenshot Callouts (Placeholder)

**Note:** Screenshots should be captured during live testing and embedded here with callouts for:
- Header spacing
- Filter toolbar layout
- Empty state styling
- Focus ring visibility
- Tree view node spacing
- Badge consistency

---

## I. Acceptance Criteria for Design Fixes

1. ✅ All spacing uses design tokens (no hardcoded values)
2. ✅ Typography hierarchy consistent (headings, body, metadata)
3. ✅ Focus states visible and meet WCAG AA contrast
4. ✅ Keyboard navigation works in List view
5. ✅ Empty states role-aware and consistent styling
6. ✅ Loading states present for all views
7. ✅ Tooltips on truncated titles

