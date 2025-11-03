# W5.M3: UX Polish, Performance Budgets & Accessibility

**Generated:** 2025-01-XX  
**Scope:** W5.M3 — UX polish, performance budgets, and accessibility  
**Authoritative Sources:**
- `docs/planning/OKR_SCREEN_MODERNISATION_PLAN.md`
- `docs/audit/W5M2_IMPLEMENTATION_NOTES.md`
- `apps/web/src/app/dashboard/okrs/page.tsx`

---

## Summary

This PR implements comprehensive UX polish, performance optimisations, and accessibility improvements (WCAG 2.1 AA) for the OKR page and its new components (Cycle Health Strip, Inline Insight Bar, Attention Drawer, Creation Drawer).

---

## Why

- **Accessibility**: Improve keyboard navigation, screen reader support, and focus management for all users
- **Performance**: Meet performance budgets for list rendering, scrolling, and drawer interactions
- **UX Polish**: Consistent microcopy, skeleton loading states, and smooth focus/keyboard UX
- **Error Handling**: Standardised error messages with governance-specific guidance

---

## What

### 1. Focus & Keyboard UX

- **Focus trap** for both drawers (Creation, Attention)
- **Esc key** closes drawers
- **Return focus** to opener button on close
- **Visible focus rings** on all actionable elements (`focus:ring-2 focus:ring-ring`)

### 2. Skeleton Components

- **OkrRowSkeleton**: Title + 2 KR bars placeholder (stable height)
- **InlineInsightSkeleton**: Compact shimmer (<4px layout shift)
- **CycleHealthSkeleton**: Number pills with shimmer
- **DrawerFormSkeleton**: Field skeletons on first open (50ms delay)

### 3. Accessibility (WCAG 2.1 AA)

- **Colour contrast** ≥ 4.5:1 for chip text and buttons
- **Landmarks**: `header`/`main`/`aside` roles, `aria-labelledby` for drawers
- **Keyboard operation**: Enter/Space activate buttons; Arrow/Home/End navigate lists
- **Async state**: `aria-busy` on list container, live region (polite) for updates
- **Labels**: Chips expose `aria-label` with full meaning (e.g., "Status: At risk")

### 4. Performance Budgets

- **First list render**: ≤ 150ms for 20 items
- **Scroll frame**: no long tasks > 50ms
- **Drawer open**: content interactive ≤ 120ms
- **Objective insight fetch**: show skeleton within 50ms; render < 16ms when data arrives
- **Bundle**: OKR page chunk ≤ 180 KB gz (commented in code)

### 5. Virtualisation Tuning

- **Shared IntersectionObserver**: `useRowVisibilityObserver` hook (rootMargin '200px', row prefetch buffer = 2 screenfuls)
- **Avoid re-creating observers**: Centralised hook prevents per-row observer creation

### 6. Error & Empty States

- **Standardised error surfaces**: Top inline alert with specific messages
  - 403: "You don't have permission to perform this action."
  - 429: "Too many requests. Please try again shortly."
  - Governance: "This cycle is locked for your role. Ask a Tenant Admin to publish changes."
- **Empty states**: Role-aware CTAs (Create button only when allowed)

### 7. Telemetry

- **Timing marks**: `performance.now()` around objective insight loads and drawer publish clicks
- **Logging**: Through existing telemetry hook or console fallback

---

## Key Diffs

### Drawer Focus Trap + Return Focus

```typescript
// apps/web/src/lib/focus-trap.ts
export function trapFocus(container: HTMLElement): () => void {
  // Traps Tab/Shift+Tab within container
  // Returns cleanup function
}

export function returnFocus(previousElement: HTMLElement | null): void {
  // Returns focus to previous element
}

// Usage in AttentionDrawer.tsx
const previousFocusRef = useRef<HTMLElement | null>(null)

useEffect(() => {
  if (isOpen) {
    previousFocusRef.current = getActiveElement()
    const cleanup = trapFocus(sheetContentRef.current)
    return cleanup
  } else {
    if (previousFocusRef.current) {
      returnFocus(previousFocusRef.current)
    }
  }
}, [isOpen])
```

### Skeleton Components Usage

```typescript
// apps/web/src/components/ui/skeletons.tsx
export function InlineInsightSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs animate-pulse">
      {/* Stable height skeleton */}
    </div>
  )
}

// Usage in InlineInsightBar.tsx
if (loading) {
  return <InlineInsightSkeleton />
}
```

### Shared useRowVisibilityObserver Hook

```typescript
// apps/web/src/hooks/useRowVisibilityObserver.ts
export function useRowVisibilityObserver(options = {}) {
  const { rootMargin = '200px', threshold = 0.1 } = options
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  // Single observer instance shared across rows
  const observe = useCallback((element, callback) => {
    // Register/unregister element callbacks
  }, [])
  
  return { observe }
}

// Usage in InlineInsightBar.tsx
const { observe } = useRowVisibilityObserver({ rootMargin: '200px', threshold: 0.1 })
useEffect(() => {
  if (containerRef.current) {
    const cleanup = observe(containerRef.current, (isIntersecting) => {
      if (isIntersecting && !insights && !loading) {
        fetchInsights()
      }
    })
    return cleanup
  }
}, [observe])
```

### Chip Component with aria-labels

```typescript
// apps/web/src/components/ui/OkrChips.tsx
export function StatusChip({ status, interactive = false, onClick }: StatusChipProps) {
  const config = statusConfig[status]
  
  if (interactive && onClick) {
    return (
      <Badge
        role="button"
        tabIndex={0}
        aria-label={config.ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
        className="focus:ring-2 focus:ring-ring focus:outline-none"
      >
        {config.label}
      </Badge>
    )
  }
  
  return (
    <Badge role="status" aria-label={config.ariaLabel}>
      {config.label}
    </Badge>
  )
}
```

### Error Mapping Util + Usage

```typescript
// apps/web/src/lib/error-mapping.ts
export function mapErrorToMessage(error: any): ErrorInfo {
  if (error.response?.status === 403) {
    return {
      message: "You don't have permission to perform this action.",
      variant: 'destructive',
    }
  }
  if (error.response?.status === 429) {
    return {
      message: 'Too many requests. Please try again shortly.',
      variant: 'warning',
    }
  }
  // Check for governance errors
  if (error.response?.data?.message?.toLowerCase().includes('locked')) {
    return {
      message: 'This cycle is locked for your role. Ask a Tenant Admin to publish changes.',
      variant: 'warning',
    }
  }
  // ... defaults
}

// Usage in AttentionDrawer.tsx
catch (err: any) {
  const errorInfo = mapErrorToMessage(err)
  setError(errorInfo.message)
}
```

---

## Tests

### Component Tests

**Focus Trap** (`AttentionDrawer.focus.spec.tsx`):
- Focus trap activates on drawer open
- Esc closes drawer
- Return focus to opener button

**Chips** (`OkrChips.spec.tsx`):
- Renders correct labels + aria-labels
- Colour classes applied
- Keyboard operation (Enter/Space)

**Skeletons** (`skeletons.spec.tsx`):
- Renders while loading
- No layout shift on resolve (height equality assertion)

**Error Mapping** (`error-mapping.spec.ts`):
- Maps 403/429/governance errors correctly
- Provides correct variant

### Integration Tests

**OKR List Render Time** (to be added):
- Assert render completes under 150ms budget
- Use `vi.useFakeTimers` + performance marks

**Virtualised List Scroll** (to be added):
- Ensure no unnecessary re-renders
- Count renders per row via test id

**Insights Lazy Load** (to be added):
- Only when row becomes visible
- Verify IntersectionObserver usage

---

## Performance Budgets Comment

```typescript
/**
 * Performance Budgets (W5.M3)
 * 
 * Page-level budgets:
 * - First list render: ≤ 150ms for 20 items (dev mode tolerance allowed)
 * - Scroll frame: no long tasks > 50ms during windowed list scroll
 * - Drawer open: content interactive ≤ 120ms
 * - Objective insight fetch: show skeleton within 50ms; render < 16ms when data arrives
 * 
 * Bundle/RT budgets (non-failing warnings):
 * - OKR page chunk ≤ 180 KB gz (if measurable with existing tooling)
 * 
 * Virtualisation tuning:
 * - IntersectionObserver thresholds: rootMargin '200px', row prefetch buffer = 2 screenfuls
 * - Avoid re-creating observers per row; centralise hook
 */
```

---

## Files Changed

### Created

**Utilities & Hooks**:
- `apps/web/src/lib/focus-trap.ts` (focus trap utilities)
- `apps/web/src/lib/error-mapping.ts` (error message standardisation)
- `apps/web/src/hooks/useUxTiming.ts` (telemetry timing hook)
- `apps/web/src/hooks/useRowVisibilityObserver.ts` (shared IntersectionObserver hook)

**Components**:
- `apps/web/src/components/ui/skeletons.tsx` (skeleton components)
- `apps/web/src/components/ui/OkrChips.tsx` (accessible chip components)

**Tests**:
- `apps/web/src/components/okr/AttentionDrawer.focus.spec.tsx` (focus trap tests)
- `apps/web/src/components/ui/OkrChips.spec.tsx` (chip component tests)
- `apps/web/src/components/ui/skeletons.spec.tsx` (skeleton tests)
- `apps/web/src/lib/error-mapping.spec.ts` (error mapping tests)

### Modified

**Components**:
- `apps/web/src/components/okr/InlineInsightBar.tsx` (skeletons, shared observer, aria-labels, timing)
- `apps/web/src/components/okr/CycleHealthStrip.tsx` (skeletons, aria-labels, keyboard support)
- `apps/web/src/components/okr/AttentionDrawer.tsx` (focus trap, return focus, error mapping, aria-labels)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (focus trap, return focus, error mapping, skeletons, timing)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (skeletons, error mapping, aria-busy, landmarks)
- `apps/web/src/app/dashboard/okrs/page.tsx` (performance budgets comment, landmarks, live region, aria-labels, focus rings)

---

## How to Verify

### Manual Testing

1. **Focus Trap**:
   - Open Creation Drawer or Attention Drawer
   - Press Tab repeatedly — focus should stay within drawer
   - Press Esc — drawer should close
   - Focus should return to opener button

2. **Keyboard Navigation**:
   - Tab through status filter chips — should see focus rings
   - Press Enter/Space on chips — should activate
   - Navigate pagination with keyboard — should work

3. **Skeletons**:
   - Open OKR page — should see row skeletons while loading
   - Expand objective row — should see inline insight skeleton
   - Open drawer — should see form skeleton briefly

4. **Accessibility**:
   - Use screen reader (VoiceOver/NVDA) — should announce landmarks, labels, status updates
   - Check colour contrast — chips and buttons should meet 4.5:1

5. **Performance**:
   - Open browser DevTools Performance tab
   - Load OKR page — check first render time (should be < 150ms)
   - Scroll list — check for long tasks (should be < 50ms)

### Automated Tests

```bash
cd apps/web
npm test -- AttentionDrawer.focus.spec.tsx
npm test -- OkrChips.spec.tsx
npm test -- skeletons.spec.tsx
npm test -- error-mapping.spec.ts
```

---

## Git Commands

```bash
git checkout -b feat/w5m3-ux-perf-a11y
git add -A
git commit -m "feat(okr-ui): W5.M3 UX polish, performance budgets, and accessibility (skeletons, focus traps, chips, IO tuning)"

# optional:
gh pr create -t "W5.M3: UX Polish, Performance Budgets & Accessibility" -b "$(cat docs/audit/W5M3_PR_BODY.md)" -B main -H feat/w5m3-ux-perf-a11y
```

---

**Status**: ✅ Ready for review and merge

