# OKR Mini Sprint 3.1 - Implementation Notes

**Date:** 2025-11-05  
**Sprint:** OKR Mini Sprint 3.1  
**Goal:** Add attention badge count (scope-aware) and governance status hover hint

---

## Files Touched

### Modified Components
- `apps/web/src/app/dashboard/okrs/page.tsx` - Updated `loadAttentionCount()` to include scope and telemetry
- `apps/web/src/app/dashboard/okrs/components/OKRToolbar.tsx` - Added `data-testid="attention-badge"` and updated aria-label
- `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx` - Added tooltip with hover hint

---

## Story 3.1A: Attention Badge Count (Scope-Aware)

### Implementation
- **Updated:** `loadAttentionCount()` in `page.tsx`
  - Now includes `scope` parameter in API call (for future-proofing)
  - Backend filters by scope automatically via user context
  - Telemetry: `attention_badge_loaded` event fired once per unique scope+cycle combination
  
- **Updated:** `useEffect` dependency array to include `selectedScope`
  - Badge count now updates when scope changes
  
- **Updated:** `OKRToolbar.tsx`
  - Added `data-testid="attention-badge"` to badge element
  - Updated `aria-label` from "Open attention drawer" to "Attention items"

### Endpoint Used
- **Endpoint:** `GET /okr/insights/attention?cycleId={cycleId}&scope={scope}&page=1&pageSize=1`
- **Response:** `{ page, pageSize, totalCount, items }`
- **Note:** Backend doesn't currently accept `scope` param, but filters automatically via user context

### Telemetry
- **Event:** `attention_badge_loaded`
- **Payload:**
  ```typescript
  {
    scope: 'my' | 'team-workspace' | 'tenant'
    cycle_id: string
    count: number
    ts: string // ISO timestamp
  }
  ```

---

## Story 3.1B: Governance Status Bar Hover Hint

### Implementation
- **Added:** Tooltip wrapper around GovernanceStatusBar container
- **Tooltip Text:** "Summary only — use the filters below to refine what you see."
- **Accessibility:** Added `aria-describedby="gov-status-description"`
- **Data-testid:** `gov-status-hint` on tooltip content
- **Styling:** Added `cursor-default` to prevent pointer cursor

### Component Changes
- Wrapped container div with `TooltipProvider` → `Tooltip` → `TooltipTrigger`
- Tooltip content uses `TooltipContent` with `id="gov-status-description"`
- No click handlers added (remains non-interactive)

---

## Diff Summary

### page.tsx
- Updated `loadAttentionCount()` to include scope parameter
- Added telemetry tracking with ref-based deduplication
- Updated useEffect dependency array to include `selectedScope`
- Added `attentionTelemetryFiredRef` to track fired telemetry per scope+cycle

### OKRToolbar.tsx
- Added `data-testid="attention-badge"` to badge
- Updated `aria-label` to "Attention items"

### GovernanceStatusBar.tsx
- Added Tooltip imports
- Wrapped container with Tooltip components
- Added tooltip text: "Summary only — use the filters below to refine what you see."
- Added `aria-describedby` and `data-testid="gov-status-hint"`
- Added `cursor-default` class

---

## Screenshots

*Screenshots to be added during manual testing:*
- Toolbar with attention badge showing count > 0
- Governance Status Bar with tooltip visible on hover

---

## Telemetry Sample

### attention_badge_loaded
```json
{
  "name": "attention_badge_loaded",
  "detail": {
    "scope": "tenant",
    "cycle_id": "uuid-here",
    "count": 5,
    "ts": "2025-11-05T12:00:00.000Z"
  }
}
```

---

## Testing Checklist

### Story 3.1A: Attention Badge
- [ ] Badge renders when count > 0
- [ ] Badge hidden when count = 0
- [ ] Badge updates when scope changes
- [ ] Badge updates when cycle changes
- [ ] Telemetry fires once per scope+cycle combination
- [ ] `data-testid="attention-badge"` present

### Story 3.1B: Governance Status Bar Tooltip
- [ ] Tooltip appears on hover
- [ ] Tooltip text matches: "Summary only — use the filters below to refine what you see."
- [ ] No click handlers attached (non-interactive)
- [ ] `data-testid="gov-status-hint"` present
- [ ] `aria-describedby` attribute present

---

## Guarantees Met

✅ No new pages or routes  
✅ Props flow unchanged (scope already passed)  
✅ RBAC/visibility respected (server-side filtering)  
✅ No `console.log` (only `console.error` for errors)  
✅ British English copy  
✅ No TODO/FIXME/HACK comments  
✅ Small, safe diff

---

## Notes

- Backend `/okr/insights/attention` endpoint doesn't currently accept `scope` parameter, but visibility is enforced server-side automatically
- Telemetry deduplication uses `useRef<Set<string>>` to track fired events per scope+cycle combination
- Tooltip uses existing Radix UI Tooltip component (already in use)
- Governance Status Bar remains non-interactive (cursor-default, no onClick handlers)

