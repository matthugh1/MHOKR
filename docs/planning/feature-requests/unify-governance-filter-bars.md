# Feature Request: Unify Governance and Filter Bars (Context-Aware Interaction)

**Status:** Proposed  
**Priority:** Medium  
**Created:** 2025-01-XX  
**Sprint:** Post-Mini Sprint 4.0

---

## Story Title

**"Unify Governance and Filter Bars (Context-Aware Interaction)"**

---

## Goal

Evaluate merging the Governance Status Bar with Filters into a single, role-aware control component to reduce redundancy while preserving clarity between summary and filter states.

This allows us to:

- Observe real user behaviour post-launch
- Measure click attempts or hover patterns (via telemetry)
- Decide empirically whether interactivity adds clarity or confusion

---

## Problem Statement

Currently, the OKR page has two separate UI components:

1. **Governance Status Bar** (`GovernanceStatusBar.tsx`)
   - Non-interactive summary strip showing cycle health metrics
   - Displays: Published/Draft counts, At Risk/Off Track KRs
   - Positioned above filter bar, below page title
   - Data from `/okr/insights/cycle-summary` with scope parameter

2. **OKR Filter Bar** (`OKRFilterBar.tsx`)
   - Interactive controls for filtering OKRs
   - Contains: Search, Status filters, Cycle selector
   - Positioned below Governance Status Bar

**Issues:**
- Potential redundancy: Both components show cycle/scope context
- Users may attempt to interact with the summary bar (currently non-interactive)
- Visual separation may create confusion about which controls filter vs. summarise
- Multiple data fetches for similar information

---

## Proposed Solution

### Option A: Unified Interactive Bar (Recommended for Evaluation)

Create a single `GovernanceFilterBar` component that:

1. **Left Side: Summary Metrics** (visual indicators)
   - Cycle health metrics (Published/Draft counts, At Risk/Off Track KRs)
   - Clickable to filter by that metric
   - Visual feedback on hover/click

2. **Right Side: Filter Controls** (existing functionality)
   - Search input
   - Status filters
   - Cycle selector

3. **Role-Aware Behaviour:**
   - Tenant Admin/Owner: Full metrics visible, all filters available
   - Manager/Lead: Team-scoped metrics, team-level filters
   - Contributor: Personal metrics, personal filters

### Option B: Enhanced Summary Bar (Conservative)

Keep separation but add:
- Tooltips explaining clickability (or lack thereof)
- Visual indicators for active filters
- Hover states on summary metrics

### Option C: Collapsible Summary

Keep summary bar but make it:
- Collapsible (expand/collapse)
- Contextual (only show when relevant)
- Linked to filters (highlight when filters affect summary)

---

## Implementation Approach

### Phase 1: Data Collection (Current)

**Already Implemented:**
- `governance_status_viewed` telemetry event
- `filter_applied` telemetry event
- Scope-aware filtering

**Additional Telemetry Needed:**
- `governance_summary_clicked` - Track click attempts on summary bar
- `governance_summary_hovered` - Track hover patterns
- `filter_bar_interaction` - Track filter usage patterns
- `summary_vs_filter_confusion` - Track user confusion (via "Why?" links or feedback)

### Phase 2: User Behaviour Analysis (Post-Launch)

**Metrics to Collect:**
1. **Click Patterns:**
   - Percentage of users clicking on summary metrics
   - Which metrics are clicked most frequently
   - Frequency of clicks vs. filter usage

2. **Hover Patterns:**
   - Hover duration on summary metrics
   - Hover-to-click conversion rate
   - Comparison with filter bar hover patterns

3. **User Feedback:**
   - "Why can't I click this?" inquiries
   - Support tickets about filtering
   - User interviews/surveys

**Decision Criteria:**
- If >20% of users attempt to click summary metrics → Consider Option A
- If <5% click attempts but high hover → Consider Option B
- If clear confusion patterns → Consider Option C

### Phase 3: Implementation (If Justified)

Based on data from Phase 2, implement the chosen option:

**Option A Implementation:**
- Create `GovernanceFilterBar.tsx` component
- Merge `GovernanceStatusBar` and `OKRFilterBar` logic
- Add click handlers to summary metrics
- Update telemetry to track new interactions
- Maintain backward compatibility during transition

**Option B Implementation:**
- Enhance `GovernanceStatusBar` with tooltips
- Add visual linking between summary and filters
- Improve hover states
- Add "Why?" links for non-interactive elements

**Option C Implementation:**
- Add collapse/expand functionality
- Implement contextual visibility logic
- Add filter highlighting

---

## Technical Considerations

### Current Architecture

**Governance Status Bar:**
- Component: `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx`
- Data: `/okr/insights/cycle-summary?scope={scope}&cycleId={cycleId}`
- Props: `cycleId`, `scope`
- Telemetry: `governance_status_viewed`

**Filter Bar:**
- Component: `apps/web/src/app/dashboard/okrs/components/OKRFilterBar.tsx`
- Contains: Search, Status filters, Cycle selector
- Telemetry: `filter_applied`

### Integration Points

1. **Shared State:**
   - Both components use `selectedScope` and `selectedCycleId`
   - Both fetch data based on same context

2. **Data Fetching:**
   - Could be optimised to fetch summary + filter options in single request
   - Consider `/okr/insights/context` endpoint that returns both

3. **RBAC:**
   - Both components respect scope and role
   - Unified component would need same RBAC checks

---

## Success Metrics

### User Experience
- **Clarity:** Reduced confusion about summary vs. filters
- **Efficiency:** Faster filtering workflow
- **Satisfaction:** Positive user feedback

### Technical
- **Performance:** No degradation in load times
- **Maintainability:** Clearer component structure
- **Telemetry:** Better insight into user behaviour

### Business
- **Adoption:** Increased filter usage (if interactivity added)
- **Engagement:** More users exploring governance metrics
- **Support:** Reduced support tickets about filtering

---

## Risks & Mitigation

### Risk 1: User Confusion During Transition
- **Mitigation:** Gradual rollout with feature flag
- **Mitigation:** Clear messaging about changes
- **Mitigation:** Keep old UI available as fallback

### Risk 2: Performance Impact
- **Mitigation:** Optimise data fetching (single request)
- **Mitigation:** Lazy load summary metrics
- **Mitigation:** Monitor performance budgets

### Risk 3: Accessibility Regression
- **Mitigation:** Maintain WCAG 2.1 AA compliance
- **Mitigation:** Test with screen readers
- **Mitigation:** Preserve keyboard navigation

---

## Dependencies

### Required
- Telemetry infrastructure (already in place)
- User behaviour analytics (PostHog/Mixpanel/analytics service)
- A/B testing framework (if implementing Option A)

### Optional
- User feedback mechanism (surveys, in-app feedback)
- Support ticket analysis
- User interviews

---

## Timeline

### Phase 1: Data Collection (Current - Mini Sprint 4.0)
- ✅ Telemetry events implemented
- ✅ Scope-aware filtering working
- ⏳ Monitor telemetry for 2-4 weeks post-launch

### Phase 2: Analysis (4-6 weeks post-launch)
- Collect and analyse telemetry data
- Review support tickets
- Conduct user interviews (if possible)
- Make data-driven decision

### Phase 3: Implementation (If justified)
- Design unified component
- Implement chosen option
- A/B test if applicable
- Gradual rollout

---

## Related Documents

- `docs/audit/OKR_MINI_SPRINT_4_0_NOTES.md` - Current implementation notes
- `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx` - Current summary bar
- `apps/web/src/app/dashboard/okrs/components/OKRFilterBar.tsx` - Current filter bar
- `docs/planning/OKR_SCREEN_MODERNISATION_PLAN.md` - Overall OKR page plan

---

## Notes

- This feature request is **data-driven** - implementation should be based on observed user behaviour
- **No immediate implementation** - wait for telemetry data before making changes
- Consider **user interviews** to validate assumptions
- Maintain **backward compatibility** during any transition

---

**Next Steps:**
1. Monitor telemetry events post-Mini Sprint 4.0 launch
2. Collect user feedback (surveys, support tickets)
3. Analyse data after 4-6 weeks
4. Schedule design review if data justifies change
5. Create implementation plan based on chosen option



