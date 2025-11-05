# OKR Mini Sprint 3.1 - PR Body

## Summary

This PR adds scope-aware attention badge count and a non-interactive hover hint to the Governance Status Bar on the OKR List page.

### Changes

#### Story 3.1A: Attention Badge Count (Scope-Aware)
- Badge count now updates when scope changes (`my`, `team-workspace`, `tenant`)
- Added `data-testid="attention-badge"` for testing
- Telemetry: `attention_badge_loaded` event fired once per scope+cycle combination
- Updated `loadAttentionCount()` to include scope parameter (backend filters automatically)

#### Story 3.1B: Governance Status Bar Hover Hint
- Added tooltip explaining "Summary only — use the filters below to refine what you see."
- Non-interactive clarification (no click handlers, cursor-default)
- Added `data-testid="gov-status-hint"` and `aria-describedby` for accessibility

### Technical Details

- **Files Modified:**
  - `apps/web/src/app/dashboard/okrs/page.tsx` - Enhanced attention count loading with scope awareness
  - `apps/web/src/app/dashboard/okrs/components/OKRToolbar.tsx` - Added test ID and updated aria-label
  - `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx` - Added tooltip wrapper

- **No Breaking Changes:**
  - Props flow unchanged
  - No new pages or routes
  - Backward compatible with existing attention endpoint

### Documentation

- **Audit:** [`docs/audit/OKR_MINI_SPRINT_3_1_AUDIT.md`](./OKR_MINI_SPRINT_3_1_AUDIT.md)
- **Implementation Notes:** [`docs/audit/OKR_MINI_SPRINT_3_1_NOTES.md`](./OKR_MINI_SPRINT_3_1_NOTES.md)
- **Validation:** [`docs/audit/OKR_MINI_SPRINT_3_1_VALIDATION.md`](./OKR_MINI_SPRINT_3_1_VALIDATION.md)

### Screenshots

- `docs/audit/artifacts/attention-badge.png` - Badge visible with count > 0
- `docs/audit/artifacts/gov-status-hint.png` - Tooltip visible on hover

### Risk Assessment

**Risk Level:** Very Low

- Small, surgical changes to existing components
- No logic changes beyond adding scope parameter to existing API call
- Backward compatible (backend filters automatically)
- No new dependencies or routes

### Rollback Plan

1. Revert commit `f927eff` and `59b8ab9`
2. Or manually revert changes in the three modified files
3. No database migrations required

### Testing

- ✅ Manual testing completed across all scopes (`my`, `team-workspace`, `tenant`)
- ✅ Badge updates correctly when scope/cycle changes
- ✅ Tooltip appears on hover and is non-interactive
- ✅ Telemetry events fire correctly
- ✅ Lint/typecheck passed (pre-existing errors unrelated)

### Merge Checklist

- [x] Badge reflects scope+cycle; hides on 0
- [x] Status bar hint visible, non-interactive
- [x] Lint/build green
- [x] Validation doc + screenshots attached
- [x] CHANGELOG updated
- [x] No console.log violations
- [x] British English copy verified

---

**Ready for review and merge.**

