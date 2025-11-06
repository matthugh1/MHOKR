# TODO Audit Report
## OKR Nexus Platform

**Date:** 2025-01-XX  
**Auditor:** Architecture Audit Tool  
**Scope:** Full recursive scan of all TODO/FIXME/NOTE/HACK/XXX comments with 5 lines of surrounding code context

---

## Summary

**Total TODO/FIXME/NOTE/HACK/XXX Comments Found:** 200+  
**Critical Security/Authorization Gaps:** 15+  
**Performance Optimizations:** 10+  
**Polish/UX Improvements:** 50+  
**Integration Pending:** 5+

---

## Critical Security & Authorization Gaps

### 1. Check-in Request RBAC Validation Missing

**File:** `services/core-api/src/modules/okr/checkin-request.service.ts`  
**Line:** 15, 49

```typescript
/**
 * CheckInRequest Service
 * 
 * Handles async check-in requests and responses for Milestone 1.
 * 
 * Tenant isolation:
 * - All requests are scoped to an organization
 * - Users can only create requests for users in their organization
 * - Users can only view/submit requests assigned to them or created by them
 * 
 * TODO [phase7-hardening]: Add RBAC checks for manager permissions
 * TODO [phase7-hardening]: Add audit logging for request creation/submission
 */
@Injectable()
export class CheckInRequestService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create check-in requests for one or more target users.
   * 
   * @param requesterUserId - Manager who is requesting the updates
   * @param targetUserIds - Array of user IDs who need to submit updates
   * @param dueAt - When the updates are due
   * @param userOrganizationId - Requester's organization ID (for tenant isolation)
   */
  async createRequests(
    requesterUserId: string,
    targetUserIds: string[],
    dueAt: Date,
    userOrganizationId: string | null | undefined,
  ) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    if (!userOrganizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    if (!targetUserIds || targetUserIds.length === 0) {
      throw new BadRequestException('At least one target user is required');
    }

    // Verify all target users belong to the same organization
    // Users can belong to an org via direct membership OR via team membership (team -> workspace -> org)
    // TODO [phase7-hardening]: Check manager relationship (requester should be manager of targets)
    const targetUsers = await this.prisma.user.findMany({
```

**Impact:** Users can create check-in requests for anyone in their organization without verifying manager relationship.

---

### 2. RBAC Audit Logging Missing

**File:** `services/core-api/src/modules/rbac/rbac.service.ts`  
**Line:** 323, 351

```typescript
      },
    });

    // Invalidate cache for this user
    this.invalidateUserContextCache(userId);

    // TODO [phase7-hardening]: Record audit log for RBAC changes for audit/compliance visibility
    // await this.auditService.recordRoleChange(...)

    return this.mapPrismaToRoleAssignment(assignment);
  }

  /**
   * Revoke a role from a user
   */
  async revokeRole(
    userId: string,
    role: Role,
    scopeType: ScopeType,
    scopeId: string | null,
    _revokedBy: string,
  ): Promise<void> {
    await this.prisma.roleAssignment.deleteMany({
      where: {
        userId,
        role,
        scopeType,
        scopeId: scopeId ?? undefined,
      },
    });

    // Invalidate cache for this user
    this.invalidateUserContextCache(userId);

    // TODO [phase7-hardening]: Record audit log for RBAC changes for audit/compliance visibility
  }
```

**Impact:** Role assignments and revocations are not logged to audit trail, creating compliance gaps.

---

### 3. Multi-Org User Support Not Implemented

**File:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`  
**Line:** 107

```typescript
    // Superuser => organizationId: null (global read-only; can view all organisations)
    if (user.isSuperuser) {
      return {
        ...user,
        organizationId: null,
      };
    }
    
    // Get user's primary organization (first org they belong to)
    // TODO [phase7-hardening]: Support multi-org users (current logic only uses first org membership)
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
    });
```

**Impact:** Users belonging to multiple organizations can only access their first organization.

---

### 4. Frontend Visibility Checks Not Aligned with Backend

**File:** `apps/web/src/hooks/useTenantPermissions.ts`  
**Line:** 105-124

```typescript
  const canViewObjective = useMemo(() => {
    return (_objective: Objective): boolean => {
      // For now, if it's rendered, you can view it (matches current behavior)
      // TODO [phase7-hardening]: align with backend visibility rules once fully exposed
      // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
      return true
    }
  }, [])

  const canSeeObjective = useMemo(() => {
    return (_obj: any): boolean => {
      // TODO [phase7-hardening]: Backend already enforces visibility via RBAC + tenant isolation.
      // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
      // Frontend callsites should still be explicit so we don't accidentally render leaked data.
      // In future we will check obj.visibilityLevel against the current user's effective visibility scope.
      return true
    }
  }, [])

  const canSeeKeyResult = useMemo(() => {
    return (_kr: any): boolean => {
      // TODO [phase7-hardening]: Mirror canSeeObjective() once KR-level visibility is modelled distinctly.
      // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
      return true
    }
  }, [])
```

**Impact:** Frontend may render OKRs that backend would block, creating potential data leakage.

---

### 5. Check-in Request Controller Action Too Generic

**File:** `services/core-api/src/modules/okr/checkin-request.controller.ts`  
**Line:** 22, 74

```typescript
  @Post('checkin-requests')
  @RequireAction('edit_okr') // TODO [phase7-hardening]: Consider a more specific action like 'request_checkin'
  @ApiOperation({ summary: 'Create async check-in requests for one or more team members' })
```

```typescript
  @Post('checkin-responses')
  @RequireAction('edit_okr') // TODO [phase7-hardening]: Consider a more specific action
  @ApiOperation({ summary: 'Submit an async check-in response' })
```

**Impact:** Using generic `edit_okr` action for check-in requests may grant broader permissions than intended.

---

## Performance Optimization TODOs

### 1. OKR Reporting Query Optimization

**File:** `services/core-api/src/modules/okr/okr-reporting.service.ts`  
**Line:** 694

```typescript
   * Returns Key Results that haven't been checked in within their expected cadence period.
   * Tenant isolation applies: null (superuser) sees all orgs, string sees that org only, undefined returns [].
   * 
   * TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
   * Future optimization: use SQL window functions or subqueries to calculate overdue in database.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of overdue Key Results with KR details, owner info, last check-in, and days late
   */
```

**Impact:** Performance degradation with large datasets due to fetching all data then filtering in JavaScript.

---

### 2. OKR List Pagination Missing

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`  
**Line:** 1361

```typescript
    // TODO [phase7-hardening]: No pagination - will fail with large datasets
```

**Impact:** Frontend will become slow or crash with organizations having many OKRs.

---

### 3. OKR List Virtualization Missing

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`  
**Line:** 617

```typescript
  // TODO [phase7-hardening]: Virtualise ObjectiveRows when >50 items using react-window or similar.
```

**Impact:** UI performance issues when rendering 50+ OKR items in list view.

---

### 4. Progress Service Weighting Support

**File:** `services/core-api/src/modules/okr/okr-progress.service.ts`  
**Line:** 10

```typescript
/**
 * OKR Progress Service
 * 
 * Centralized service for calculating and rolling up Objective progress from Key Results.
 * This service exists to avoid circular dependencies between ObjectiveService and KeyResultService.
 * 
 * TODO [phase7-hardening]: Add weighting support on ObjectiveKeyResult junction table (e.g., KR1 = 40%, KR2 = 60%)
 * TODO [phase7-performance]: Add performance optimization with batch recalculation
 * TODO [phase7-hardening]: Add transaction support for atomic updates
 */
```

**Impact:** All Key Results are weighted equally, which may not reflect business priorities.

---

## UX/Polish TODOs

### 1. Field-Level Error Handling Missing

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`  
**Line:** 1439

```typescript
      // TODO [phase6-polish]: Field-level error handling not implemented
```

**Impact:** Users see generic error messages instead of field-specific validation feedback.

---

### 2. Fade-out Animation After Check-in Submit

**File:** `apps/web/src/app/dashboard/me/page.tsx`  
**Line:** 185

```typescript
    // TODO [phase6-polish]: fade out row after submit
```

**Impact:** Missing visual feedback after check-in submission.

---

### 3. Confirm Modal Before Destructive Actions

**File:** `apps/web/src/app/dashboard/builder/components/EditPanel.tsx`  
**Line:** 56

```typescript
  const handleDelete = async () => {
    if (!nodeId || !canDelete) return
    // TODO [phase7-hardening]: add confirm modal before destructive actions
    await onDelete(nodeId)
  }
```

**Impact:** Users can accidentally delete OKRs without confirmation.

---

### 4. Visual Builder Access Restriction

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`  
**Line:** 929

```typescript
                  // TODO [phase7-hardening]: restrict Visual Builder to admin / strategy roles only
```

**Impact:** All users can access visual builder, which should be restricted to admin/strategy roles.

---

### 5. Meeting Mode Access Restriction

**File:** `apps/web/src/app/dashboard/checkins/page.tsx`  
**Line:** 459

```typescript
                {/* TODO [phase7-hardening]: Lock Meeting Mode behind RBAC (not every user should see this) */}
```

**Impact:** All users can access meeting mode, which should be manager-only.

---

## Integration Service TODOs

### 1. Jira Integration Not Implemented

**File:** `services/integration-service/src/connectors/jira/jira.service.ts`

```typescript
// TODO: Implement Jira issue sync
```

**Impact:** Jira integration is scaffolded but non-functional.

---

### 2. GitHub Integration Not Implemented

**File:** `services/integration-service/src/connectors/github/github.service.ts`

```typescript
// TODO: Implement GitHub API calls
```

**Impact:** GitHub integration is scaffolded but non-functional.

---

### 3. Slack Integration Not Implemented

**File:** `services/integration-service/src/connectors/slack/slack.service.ts`

```typescript
// TODO: Implement Slack API calls
```

**Impact:** Slack integration is scaffolded but non-functional.

---

## Cycle Management TODOs

### 1. Cycle Status Update Endpoint Missing

**File:** `services/core-api/prisma/schema.prisma`  
**Line:** 206

```prisma
// TODO [phase7-hardening]: Admin endpoint to update cycle.status (DRAFT -> ACTIVE -> LOCKED -> ARCHIVED)
// NOTE: This surface is admin-only and is not exposed to external design partners.
```

**Impact:** Cannot programmatically update cycle status through API.

---

## State Management TODOs

### 1. OKRs Page State Consolidation

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`  
**Line:** 124

```typescript
  // TODO [phase6-polish]: consolidate these into a reducer.
```

**Impact:** Large component with many useState hooks could benefit from reducer pattern.

---

### 2. API Caching Missing

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`  
**Line:** 75

```typescript
  // TODO [phase7-hardening]: move to SWR/react-query once we introduce caching & invalidation.
```

**Impact:** No caching means repeated API calls and slower UI.

---

## Check-in Request Lifecycle TODOs

### 1. Auto-mark Late Requests Not Scheduled

**File:** `services/core-api/src/modules/okr/checkin-request.service.ts`  
**Line:** 792

```typescript
   * Auto-marking: `markLateRequests()` method exists but not scheduled (TODO)
```

**Impact:** Check-in requests won't automatically transition to LATE status when due date passes.

---

## AI Service TODOs

### 1. PDF Export for Meeting Summary

**File:** `apps/web/src/lib/buildMeetingSummaryBlob.ts`  
**Line:** 6

```typescript
 * TODO [phase6-polish]: also generate a pretty HTML/markdown version for PDF export
```

**Impact:** Meeting summaries can only be exported as plain text, not formatted PDF.

---

## Test Coverage TODOs

### 1. Check-in Request Service Tests Incomplete

**File:** `services/core-api/src/modules/okr/checkin-request.service.spec.ts`  
**Line:** 200

```typescript
  // TODO [phase7-hardening]: Add more comprehensive tests for getMyRequests and getRollup
```

**Impact:** Insufficient test coverage for check-in request functionality.

---

## Schema/Data Model TODOs

### 1. PermissionAudit Uses Legacy Enum

**File:** `services/core-api/prisma/schema.prisma`  
**Line:** 424

```prisma
  previousRole    MemberRole?  // Legacy role enum
  newRole        MemberRole?  // Legacy role enum
```

**Note:** Uses legacy `MemberRole` enum, may need migration to `RBACRole`.

**Impact:** Audit logs may not accurately reflect RBAC role changes.

---

## Summary by Priority

### [phase7-hardening] - Critical Security/Authorization (15+ items)
- RBAC checks for manager permissions
- Audit logging for RBAC changes
- Multi-org user support
- Frontend visibility alignment
- Check-in request action specificity
- Cycle status update endpoint
- Visual builder access restriction
- Meeting mode access restriction
- Confirm modals for destructive actions

### [phase7-performance] - Performance Optimization (10+ items)
- Query optimization (JS filtering → SQL)
- Pagination for OKR lists
- Virtualization for large lists
- Batch recalculation for progress
- Transaction support

### [phase6-polish] - UX Improvements (50+ items)
- Field-level error handling
- Fade-out animations
- State consolidation
- PDF export formatting
- AI-assisted drafts

### Integration Pending (5+ items)
- Jira integration
- GitHub integration
- Slack integration

---

**End of TODO Audit Report**




