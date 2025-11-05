# OKR Mini Sprint 3 - Implementation Notes

**Date:** 2025-11-05  
**Sprint:** OKR Mini Sprint 3  
**Goal:** Governance clarity + health signals on the OKR List — WITHOUT adding new filters or pages

---

## Files Touched

### New Components
- `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx` (83 lines)
- `apps/web/src/components/okr/WhyCantIInspector.tsx` (126 lines)

### Modified Components
- `apps/web/src/app/dashboard/okrs/page.tsx` - Added GovernanceStatusBar integration
- `apps/web/src/components/okr/ObjectiveRow.tsx` - Added WhyCantIInspector for blocked actions
- `apps/web/src/components/okr/InlineInsightBar.tsx` - Added "No progress 14 days" hint and telemetry
- `apps/web/src/components/ui/skeletons.tsx` - Added GovernanceStatusSkeleton

### Documentation
- `CHANGELOG.md` - Added OKR Mini Sprint 3 entry
- `docs/audit/OKR_MINI_SPRINT_3_AUDIT.md` - Audit summary

---

## Story A: Governance Status Bar

### Implementation
- **Component**: `GovernanceStatusBar.tsx`
- **Props**: `{ cycleId: string; scope: 'my'|'team-workspace'|'tenant' }`
- **Endpoint**: `/okr/insights/cycle-summary?cycleId={cycleId}&scope={scope}`
- **Position**: Above `OKRFilterBar`, below page title
- **Non-interactive**: Summary-only badges (Published, Draft, At Risk, Off Track)
- **Loading**: `GovernanceStatusSkeleton` shimmer
- **Error**: Inline muted text (non-blocking)
- **Telemetry**: `governance_status_viewed` fired once per mount

### Design
- Concise badges showing governance metrics
- British English copy
- Muted background (`bg-muted/30`)
- Data-testid: `gov-status-bar`

### Screenshots
*Screenshots to be added during manual testing:*
- Governance status bar with Published/Draft badges
- Status bar with At Risk/Off Track indicators
- Skeleton loading state

---

## Story B: Why Can't I Inspector

### Implementation
- **Component**: `WhyCantIInspector.tsx`
- **Feature Flag**: `rbacInspector` (from `user.features.rbacInspector`)
- **Visibility**: Only renders when feature flag enabled AND action is blocked
- **Actions Supported**:
  - `edit_okr` - Edit objective button
  - `delete_okr` - Delete objective button
  - `check_in_kr` - KR check-in button
  - `publish_okr` - (Future: publish/unpublish actions)

### Reason Codes
- `published` - Publish Lock
- `cycle_locked` - Cycle Locked
- `superuser_readonly` - SUPERUSER Read-Only
- `visibility_private` - Visibility (PRIVATE)
- `not_owner` - Not Owner

### UI
- Small "Why?" link with HelpCircle icon
- Popover on click/hover showing:
  - Reason code
  - Human-readable message (from `useTenantPermissions`)
  - Effective roles (future enhancement)
- Data-testids: `why-link`, `why-popover`

### Integration Points
- **ObjectiveRow.tsx**:
  - Line 970-978: Why? inspector for blocked edit
  - Line 1023-1031: Why? inspector for blocked delete
  - Line 1275-1284: Why? inspector for blocked check-in

### Screenshots
*Screenshots to be added during manual testing:*
- "Why?" link next to blocked edit button
- Popover showing reason code and message
- SUPERUSER read-only inspector display

---

## Story C: Inline Health Signals

### Implementation
- **Component**: `InlineInsightBar.tsx` (enhanced)
- **Lazy Loading**: IntersectionObserver with `rootMargin: '200px'`, `threshold: 0.1`
- **Health Hints**:
  - "2 KRs at risk" - Shows count of at-risk KRs
  - "Overdue check-ins" - Shows when check-ins are overdue
  - "No progress 14 days" - Shows when `lastUpdateAgeHours > 336`

### Telemetry
- **Event**: `inline_insight_loaded`
- **Payload**:
  ```typescript
  {
    objective_id: string
    signals: string[] // e.g., ['trend_improving', 'krs_at_risk_2', 'overdue_checkins_1', 'no_progress_14d']
    ts: string // ISO timestamp
  }
  ```

### Performance
- Debounced intersection callbacks
- Abort fetch if row unmounts
- Cache per-session (in-memory keyed by objectiveId)
- Visibility-respecting (backend filters automatically)

### Screenshots
*Screenshots to be added during manual testing:*
- Inline insight bar with KR counts
- "Overdue check-ins" badge
- "No progress 14 days" hint

---

## Telemetry Samples

### governance_status_viewed
```json
{
  "name": "governance_status_viewed",
  "detail": {
    "cycle_id": "uuid-here",
    "scope": "tenant",
    "ts": "2025-11-05T12:00:00.000Z"
  }
}
```

### inline_insight_loaded
```json
{
  "name": "inline_insight_loaded",
  "detail": {
    "objective_id": "uuid-here",
    "signals": ["trend_improving", "krs_at_risk_2", "overdue_checkins_1"],
    "ts": "2025-11-05T12:00:00.000Z"
  }
}
```

---

## Testing Checklist

### Story A: Governance Status Bar
- [ ] Status bar renders with Published/Draft badges
- [ ] Status bar shows At Risk/Off Track when applicable
- [ ] Skeleton renders during loading
- [ ] Error state shows muted text (non-blocking)
- [ ] Telemetry fires once per mount
- [ ] No click handlers (non-interactive)

### Story B: Why Can't I Inspector
- [ ] "Why?" link appears only when `rbacInspector` flag enabled
- [ ] "Why?" link appears for blocked edit action
- [ ] "Why?" link appears for blocked delete action
- [ ] "Why?" link appears for blocked check-in
- [ ] Popover shows correct reason code
- [ ] Popover shows human-readable message
- [ ] SUPERUSER blocked edit shows `superuser_readonly` reason

### Story C: Inline Health Signals
- [ ] Inline insight bar lazy-loads when row visible
- [ ] KR counts display correctly
- [ ] "Overdue check-ins" badge appears when applicable
- [ ] "No progress 14 days" hint appears when `lastUpdateAgeHours > 336`
- [ ] Telemetry fires with correct signals array
- [ ] Visibility-restricted items never render hints

---

## Guarantees Met

✅ No second set of filters - GovernanceStatusBar is summary-only  
✅ All copy in British English  
✅ RBAC, tenant isolation, and visibility unchanged  
✅ SUPERUSER remains read-only  
✅ No new pages or routes  
✅ No TODO/FIXME/HACK comments  
✅ `no-console` guard enforced (console.error only for errors)

---

## Notes

- Backend `/okr/insights/cycle-summary` endpoint does NOT currently accept `scope` parameter, but visibility is already enforced server-side
- `WhyCantIInspector` uses existing `useTenantPermissions` hooks - no re-computation
- `InlineInsightBar` already existed - enhanced with "No progress 14 days" hint and telemetry
- IntersectionObserver is shared via `useRowVisibilityObserver` hook for performance

