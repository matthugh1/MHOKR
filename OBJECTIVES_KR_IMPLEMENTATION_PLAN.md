# Objectives & Key Results Implementation Plan

**Date:** 2025-01-27  
**Based On:** OBJECTIVES_AUDIT_REPORT.md  
**Purpose:** Actionable implementation plan to address gaps and enhance the OKR system

---

## Executive Summary

This plan addresses the gaps identified in the Objectives and Key Results audit, prioritizing enhancements that improve user experience, data consistency, and system transparency. The plan is organized by priority and includes implementation details, dependencies, and success criteria.

---

## Priority Classification

- **P0 (Critical)** - Blocks core functionality or creates data inconsistencies
- **P1 (High)** - Significant UX improvement or missing feature
- **P2 (Medium)** - Nice-to-have enhancement
- **P3 (Low)** - Future consideration

---

## Phase 1: Status Rollup Implementation (P1)

### Problem
Objectives do not automatically update their status based on Key Result statuses. Users must manually update Objective status, leading to inconsistencies.

### Solution
Implement automatic status rollup from Key Results to Objectives, similar to progress rollup.

### Tasks

#### 1.1 Add Status Calculation Logic to OkrProgressService
**File:** `services/core-api/src/modules/okr/okr-progress.service.ts`

**Changes:**
- Add `recalculateObjectiveStatus()` method
- Implement status calculation rules:
  - If any KR is `OFF_TRACK` → Objective should be `AT_RISK` (or `OFF_TRACK` if multiple)
  - If all KRs are `COMPLETED` → Objective should be `COMPLETED`
  - If majority (≥50%) of KRs are `AT_RISK` → Objective should be `AT_RISK`
  - If all KRs are `ON_TRACK` → Objective should be `ON_TRACK`
  - If any KR is `CANCELLED` → Consider Objective `AT_RISK` (unless all cancelled, then `CANCELLED`)

**Implementation:**
```typescript
async recalculateObjectiveStatus(objectiveId: string): Promise<void> {
  const objective = await this.prisma.objective.findUnique({
    where: { id: objectiveId },
    include: {
      keyResults: {
        include: {
          keyResult: {
            select: { status: true },
          },
        },
      },
      children: {
        select: { id: true, status: true },
      },
    },
  });

  if (!objective) return;

  let newStatus: OKRStatus = objective.status;

  // Priority 1: Calculate from Key Results
  if (objective.keyResults && objective.keyResults.length > 0) {
    const krStatuses = objective.keyResults.map(objKr => objKr.keyResult.status);
    
    // Count statuses
    const statusCounts = {
      ON_TRACK: krStatuses.filter(s => s === 'ON_TRACK').length,
      AT_RISK: krStatuses.filter(s => s === 'AT_RISK').length,
      OFF_TRACK: krStatuses.filter(s => s === 'OFF_TRACK').length,
      COMPLETED: krStatuses.filter(s => s === 'COMPLETED').length,
      CANCELLED: krStatuses.filter(s => s === 'CANCELLED').length,
    };

    // Rules (in priority order)
    if (statusCounts.OFF_TRACK > 0) {
      newStatus = statusCounts.OFF_TRACK >= krStatuses.length / 2 ? 'OFF_TRACK' : 'AT_RISK';
    } else if (statusCounts.COMPLETED === krStatuses.length) {
      newStatus = 'COMPLETED';
    } else if (statusCounts.AT_RISK >= krStatuses.length / 2) {
      newStatus = 'AT_RISK';
    } else if (statusCounts.ON_TRACK === krStatuses.length) {
      newStatus = 'ON_TRACK';
    } else if (statusCounts.CANCELLED === krStatuses.length) {
      newStatus = 'CANCELLED';
    }
  }
  // Priority 2: Calculate from child Objectives
  else if (objective.children && objective.children.length > 0) {
    // Similar logic for child Objectives
  }

  // Only update if status changed
  if (newStatus !== objective.status) {
    await this.prisma.objective.update({
      where: { id: objectiveId },
      data: { status: newStatus },
    });
  }

  // Cascade to parent
  if (objective.parent?.id) {
    await this.recalculateObjectiveStatus(objective.parent.id);
  }
}
```

**Dependencies:** None  
**Estimated Effort:** 4-6 hours  
**Testing:** Unit tests for status calculation rules, integration tests for cascading

---

#### 1.2 Integrate Status Rollup with Existing Triggers
**Files:**
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/objective.service.ts`

**Changes:**
- Call `recalculateObjectiveStatus()` after progress rollup triggers
- Update trigger points:
  - KR status change → trigger status rollup
  - KR check-in that changes status → trigger status rollup
  - KR creation → trigger status rollup
  - KR deletion → trigger status rollup

**Implementation:**
```typescript
// In key-result.service.ts after status changes
if (statusChanged) {
  await this.okrProgressService.refreshObjectiveProgressForKeyResult(id);
  await this.okrProgressService.recalculateObjectiveStatusForKR(id); // NEW
}
```

**Dependencies:** Task 1.1  
**Estimated Effort:** 2-3 hours  
**Testing:** Integration tests ensuring status updates cascade correctly

---

#### 1.3 Add Status Rollup Indicator in UI
**Files:**
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- `apps/web/src/components/okr/ObjectiveCard.tsx`

**Changes:**
- Add tooltip to Objective status badge: "Status calculated from Key Results"
- Show status breakdown on hover (similar to progress breakdown)
- Visual indicator (icon) showing status is auto-calculated

**Dependencies:** Task 1.1, 1.2  
**Estimated Effort:** 3-4 hours  
**Testing:** UI tests, accessibility checks

---

**Phase 1 Total Effort:** 9-13 hours  
**Phase 1 Priority:** P1 (High) - Improves data consistency

---

## Phase 2: Progress Rollup Visibility (P1)

### Problem
Users don't realize Objective progress is automatically calculated from Key Results. No breakdown showing which KRs contributed how much.

### Solution
Add visual indicators and breakdown tooltips showing how Objective progress is calculated.

### Tasks

#### 2.1 Add Progress Breakdown Tooltip Component
**File:** `apps/web/src/components/okr/ProgressBreakdownTooltip.tsx` (NEW)

**Features:**
- Shows which KRs contributed to Objective progress
- Displays weights and individual KR progress values
- Format: "75% = (KR1: 80% × 0.5) + (KR2: 70% × 0.5)"
- Visual breakdown with progress bars for each KR

**Implementation:**
```typescript
interface ProgressBreakdownTooltipProps {
  objectiveId: string
  objectiveProgress: number
  keyResults: Array<{
    id: string
    title: string
    progress: number
    weight: number
  }>
}

export function ProgressBreakdownTooltip({ ... }: ProgressBreakdownTooltipProps) {
  // Calculate weighted contributions
  const contributions = keyResults.map(kr => ({
    ...kr,
    contribution: (kr.progress * kr.weight) / totalWeight,
  }));

  return (
    <Tooltip>
      <TooltipTrigger>
        <InfoIcon className="h-4 w-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-2">
          <div className="font-semibold">Progress Breakdown</div>
          <div className="text-sm">
            {objectiveProgress}% = {contributions.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ' + '}
                ({c.title}: {c.progress}% × {c.weight})
              </span>
            ))}
          </div>
          {/* Visual breakdown bars */}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

**Dependencies:** None  
**Estimated Effort:** 4-5 hours  
**Testing:** Component tests, visual regression tests

---

#### 2.2 Integrate Breakdown Tooltip into Objective Components
**Files:**
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- `apps/web/src/components/okr/ObjectiveCard.tsx`

**Changes:**
- Add breakdown tooltip next to Objective progress bar
- Show on hover/click
- Include "Calculated from Key Results" label

**Dependencies:** Task 2.1  
**Estimated Effort:** 2-3 hours  
**Testing:** UI tests, accessibility checks

---

#### 2.3 Add Progress Rollup Indicator Badge
**Files:**
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- `apps/web/src/components/okr/ObjectiveCard.tsx`

**Changes:**
- Add small badge/icon next to progress: "Auto-calculated"
- Tooltip: "This progress is automatically calculated from Key Results"
- Visual distinction from manually set progress (if we add that feature)

**Dependencies:** Task 2.1  
**Estimated Effort:** 1-2 hours  
**Testing:** UI tests

---

**Phase 2 Total Effort:** 7-10 hours  
**Phase 2 Priority:** P1 (High) - Improves UX transparency

---

## Phase 3: Objective Progress Snapshots (P2)

### Problem
Cannot track Objective progress over time. Must reconstruct from KR check-ins, which is complex.

### Solution
Store Objective progress snapshots on each rollup, similar to KR check-ins.

### Tasks

#### 3.1 Create ObjectiveProgressSnapshot Model
**File:** `services/core-api/prisma/schema.prisma`

**Changes:**
```prisma
model ObjectiveProgressSnapshot {
  id          String    @id @default(cuid())
  objectiveId String
  objective   Objective @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  progress    Float     // Progress at snapshot time
  status      OKRStatus // Status at snapshot time
  triggeredBy String?   // What triggered this snapshot (e.g., "KR_CHECKIN", "KR_UPDATE")
  createdAt   DateTime  @default(now())

  @@index([objectiveId])
  @@index([createdAt])
  @@map("objective_progress_snapshots")
}
```

**Migration:**
- Create migration file
- Add relation to Objective model

**Dependencies:** None  
**Estimated Effort:** 1-2 hours  
**Testing:** Migration tests

---

#### 3.2 Store Snapshots on Progress Rollup
**File:** `services/core-api/src/modules/okr/okr-progress.service.ts`

**Changes:**
- After updating Objective progress, create snapshot
- Include trigger reason (e.g., "KR_CHECKIN", "KR_UPDATE", "KR_CREATE")
- Only create snapshot if progress changed significantly (>0.01)

**Implementation:**
```typescript
// After progress update
if (Math.abs(newProgress - objective.progress) > 0.01) {
  await this.prisma.objective.update({
    where: { id: objectiveId },
    data: { progress: newProgress },
  });

  // Create snapshot
  await this.prisma.objectiveProgressSnapshot.create({
    data: {
      objectiveId,
      progress: newProgress,
      status: objective.status,
      triggeredBy: triggerReason, // Pass from caller
    },
  });
}
```

**Dependencies:** Task 3.1  
**Estimated Effort:** 2-3 hours  
**Testing:** Unit tests, integration tests

---

#### 3.3 Add Progress Trend Endpoint
**File:** `services/core-api/src/modules/okr/objective.controller.ts`

**Changes:**
- Add `GET /objectives/:id/progress-trend` endpoint
- Return time-series progress data
- Similar to KR trend endpoint

**Implementation:**
```typescript
@Get(':id/progress-trend')
@ApiOperation({ summary: 'Get Objective progress trend' })
async getProgressTrend(@Param('id') id: string, @Req() req: any) {
  const snapshots = await this.objectiveService.getProgressTrend(
    id,
    req.user.tenantId
  );
  return snapshots;
}
```

**Dependencies:** Task 3.1, 3.2  
**Estimated Effort:** 2-3 hours  
**Testing:** API tests

---

#### 3.4 Add Objective Progress Trend Chart Component
**File:** `apps/web/src/components/okr/ObjectiveProgressTrendChart.tsx` (NEW)

**Changes:**
- Similar to `KeyResultTrendChart.tsx`
- Show Objective progress over time
- Optional: Overlay KR progress lines for comparison

**Dependencies:** Task 3.3  
**Estimated Effort:** 4-5 hours  
**Testing:** Component tests, visual regression tests

---

**Phase 3 Total Effort:** 9-13 hours  
**Phase 3 Priority:** P2 (Medium) - Analytics enhancement

---

## Phase 4: Status Trend Calculation (P2)

### Problem
Status trend calculation exists but returns "UNKNOWN". Cannot track if Objective status is improving or declining.

### Solution
Implement status trend calculation using Activity logs or progress snapshots.

### Tasks

#### 4.1 Implement Status Trend Calculation
**File:** `services/core-api/src/modules/okr/okr-insights.service.ts`

**Changes:**
- Update `getObjectiveInsights()` to calculate real status trends
- Use Activity logs or progress snapshots to track status changes
- Calculate: `IMPROVING`, `DECLINING`, `FLAT`, `UNKNOWN`

**Implementation:**
```typescript
// Get status history from Activity logs or snapshots
const statusHistory = await this.getStatusHistory(objectiveId);

if (statusHistory.length < 2) {
  return 'UNKNOWN';
}

const recentStatuses = statusHistory.slice(-3); // Last 3 changes
const currentStatus = recentStatuses[recentStatuses.length - 1].status;
const previousStatus = recentStatuses[recentStatuses.length - 2].status;

// Map statuses to numeric values for comparison
const statusValue = (s: OKRStatus) => {
  switch (s) {
    case 'COMPLETED': return 4;
    case 'ON_TRACK': return 3;
    case 'AT_RISK': return 2;
    case 'OFF_TRACK': return 1;
    case 'CANCELLED': return 0;
  }
};

const currentValue = statusValue(currentStatus);
const previousValue = statusValue(previousStatus);

if (currentValue > previousValue) return 'IMPROVING';
if (currentValue < previousValue) return 'DECLINING';
return 'FLAT';
```

**Dependencies:** Phase 3 (for snapshots) or Activity logs  
**Estimated Effort:** 3-4 hours  
**Testing:** Unit tests, edge cases

---

#### 4.2 Update UI to Show Status Trends
**File:** `apps/web/src/components/okr/InlineInsightBar.tsx`

**Changes:**
- Update status trend display to show real trends (not just UNKNOWN)
- Add visual indicators (arrows, colors) for improving/declining

**Dependencies:** Task 4.1  
**Estimated Effort:** 2-3 hours  
**Testing:** UI tests

---

**Phase 4 Total Effort:** 5-7 hours  
**Phase 4 Priority:** P2 (Medium) - Analytics enhancement

---

## Phase 5: Enhanced Trend Charts (P3)

### Problem
KR trend charts only show value, not progress. No comparison to target line.

### Solution
Enhance trend charts with progress overlay and target comparison.

### Tasks

#### 5.1 Enhance KeyResultTrendChart
**File:** `apps/web/src/components/okr/KeyResultTrendChart.tsx`

**Changes:**
- Add progress trend line (calculated from values)
- Add target line overlay
- Add confidence trend toggle
- Improve chart styling and interactivity

**Dependencies:** None  
**Estimated Effort:** 6-8 hours  
**Testing:** Component tests, visual regression tests

---

#### 5.2 Add Progress vs Value Comparison
**File:** `apps/web/src/components/okr/KeyResultTrendChart.tsx`

**Changes:**
- Dual Y-axis: value on left, progress % on right
- Show both trends simultaneously
- Toggle between value-only and progress-only views

**Dependencies:** Task 5.1  
**Estimated Effort:** 4-5 hours  
**Testing:** Component tests

---

**Phase 5 Total Effort:** 10-13 hours  
**Phase 5 Priority:** P3 (Low) - Future enhancement

---

## Phase 6: Progress Breakdown View (P3)

### Problem
No dedicated view showing KR contributions to Objective progress.

### Solution
Create a detailed breakdown view showing weights, contributions, and historical trends.

### Tasks

#### 6.1 Create Progress Breakdown Page/Modal
**File:** `apps/web/src/components/okr/ProgressBreakdownView.tsx` (NEW)

**Features:**
- Table/list showing each KR contribution
- Visual bars showing relative contribution
- Weight visualization
- Historical contribution tracking
- Export functionality

**Dependencies:** Phase 2 (breakdown tooltip)  
**Estimated Effort:** 8-10 hours  
**Testing:** Component tests, visual regression tests

---

#### 6.2 Add Breakdown View Access Points
**Files:**
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- `apps/web/src/components/okr/ObjectiveCard.tsx`

**Changes:**
- Add "View Breakdown" button/link
- Open breakdown modal/page
- Pass Objective and KR data

**Dependencies:** Task 6.1  
**Estimated Effort:** 2-3 hours  
**Testing:** UI tests

---

**Phase 6 Total Effort:** 10-13 hours  
**Phase 6 Priority:** P3 (Low) - Future enhancement

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Status Rollup
- **Phase 1:** Status Rollup Implementation
- **Total Effort:** 9-13 hours
- **Deliverables:**
  - Automatic status calculation from KRs
  - Status cascading to parent Objectives
  - UI indicators for auto-calculated status

### Sprint 2 (Week 3-4): Progress Visibility
- **Phase 2:** Progress Rollup Visibility
- **Total Effort:** 7-10 hours
- **Deliverables:**
  - Progress breakdown tooltips
  - Rollup indicators in UI
  - Clear communication that progress is calculated

### Sprint 3 (Week 5-6): Progress Snapshots
- **Phase 3:** Objective Progress Snapshots
- **Total Effort:** 9-13 hours
- **Deliverables:**
  - Progress snapshot storage
  - Trend endpoint
  - Trend chart component

### Sprint 4 (Week 7-8): Status Trends
- **Phase 4:** Status Trend Calculation
- **Total Effort:** 5-7 hours
- **Deliverables:**
  - Real status trend calculation
  - UI updates for trends

### Future Sprints: Enhancements
- **Phase 5:** Enhanced Trend Charts (P3)
- **Phase 6:** Progress Breakdown View (P3)

---

## Success Criteria

### Phase 1: Status Rollup
- ✅ Objective status automatically updates when KR statuses change
- ✅ Status cascades to parent Objectives
- ✅ UI shows status is auto-calculated
- ✅ Unit tests cover all status calculation rules
- ✅ Integration tests verify cascading works

### Phase 2: Progress Visibility
- ✅ Tooltip shows progress breakdown on hover
- ✅ Visual indicator shows progress is calculated
- ✅ Breakdown shows weights and contributions
- ✅ Accessible (keyboard navigation, screen readers)

### Phase 3: Progress Snapshots
- ✅ Snapshots stored on each progress change
- ✅ Trend endpoint returns time-series data
- ✅ Trend chart displays Objective progress over time
- ✅ Performance acceptable (<100ms query time)

### Phase 4: Status Trends
- ✅ Status trends calculated from history
- ✅ Trends show IMPROVING, DECLINING, FLAT, or UNKNOWN
- ✅ UI displays trends with visual indicators
- ✅ Accurate trend calculation (tested with various scenarios)

---

## Risk Assessment

### High Risk
- **None identified** - All changes are additive, no breaking changes

### Medium Risk
- **Performance:** Progress snapshots could grow large over time
  - **Mitigation:** Add retention policy (e.g., keep last 6 months), archive older data
- **Status Rollup Conflicts:** Manual status updates vs automatic rollup
  - **Mitigation:** Add "manual override" flag, or always recalculate (preferred)

### Low Risk
- **UI Complexity:** Too many indicators could clutter interface
  - **Mitigation:** Use progressive disclosure, tooltips, optional breakdown views

---

## Dependencies

### External Dependencies
- None

### Internal Dependencies
- Phase 1 → Phase 2 (status rollup enables status breakdown)
- Phase 3 → Phase 4 (snapshots enable better trend calculation)
- Phase 2 → Phase 6 (breakdown tooltip → breakdown view)

---

## Testing Strategy

### Unit Tests
- Status calculation rules (all scenarios)
- Progress calculation (edge cases)
- Trend calculation logic
- Snapshot creation logic

### Integration Tests
- Status rollup cascading
- Progress rollup cascading
- Snapshot creation on rollup
- API endpoints

### UI Tests
- Tooltip display and interaction
- Breakdown view rendering
- Trend chart rendering
- Accessibility (keyboard, screen readers)

### Performance Tests
- Snapshot query performance
- Trend calculation performance
- Large dataset handling

---

## Documentation Updates

### Required Updates
1. **API Documentation:** Document new endpoints (trend, breakdown)
2. **User Guide:** Explain automatic status/progress calculation
3. **Developer Guide:** Document status rollup rules
4. **Architecture Docs:** Update OKR progress system documentation

---

## Rollout Plan

### Phase 1-2: Core Features
1. Deploy backend changes (status rollup, snapshots)
2. Deploy frontend changes (indicators, tooltips)
3. Monitor for issues
4. Gather user feedback

### Phase 3-4: Analytics
1. Deploy snapshot system
2. Deploy trend endpoints
3. Deploy trend charts
4. Monitor performance

### Phase 5-6: Enhancements
1. Deploy enhanced charts
2. Deploy breakdown view
3. Gather feedback
4. Iterate based on usage

---

## Metrics to Track

### Adoption Metrics
- % of Objectives with auto-calculated status
- % of users viewing progress breakdowns
- % of users using trend charts

### Performance Metrics
- Snapshot query time (p95, p99)
- Trend calculation time
- UI render time for breakdowns

### Quality Metrics
- Status rollup accuracy (manual verification)
- Progress calculation accuracy
- UI accessibility score

---

## Conclusion

This implementation plan addresses all gaps identified in the audit, prioritized by impact and effort. The plan is structured to deliver value incrementally, with core features (status rollup, progress visibility) coming first, followed by analytics enhancements.

**Total Estimated Effort:** 40-56 hours (Phases 1-4, P1-P2)  
**Timeline:** 8 weeks (2 sprints per phase)  
**Risk Level:** Low (additive changes, no breaking changes)

---

**Plan Created:** 2025-01-27  
**Next Steps:** Review plan, prioritize phases, assign resources, begin Sprint 1

