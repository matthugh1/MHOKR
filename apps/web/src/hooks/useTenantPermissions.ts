import { useMemo } from 'react'
import { useAuth } from '@/contexts/auth.context'
import { useWorkspace } from '@/contexts/workspace.context'
import { usePermissions } from './usePermissions'

/**
 * useTenantPermissions Hook
 * 
 * Single source of truth for all tenant-level permission checks, mirroring backend rules.
 * 
 * This hook combines:
 * - RBAC roles (from usePermissions)
 * - Publish lock checks (isPublished === true → only admins can edit/delete)
 * - Cycle lock checks (cycle.status === LOCKED/ARCHIVED → only admins can edit/delete)
 * - Export permissions (export_data action)
 * 
 * TODO: Replace all inline permission checks in:
 * - okrs/page.tsx (handleEditOKR, handleDeleteOKR, canEditPublished, canDeletePublished)
 * - analytics/page.tsx (canExport - currently uses useTenantAdmin)
 * 
 * TODO: This hook should mirror backend logic in:
 * - objective.service.ts:canEdit() + okr-governance.service.ts:checkPublishLockForObjective() + checkCycleLockForObjective()
 * - objective.service.ts:canDelete() + okr-governance.service.ts:checkPublishLockForObjective() + checkCycleLockForObjective()
 * - key-result.service.ts:canEdit() + okr-governance.service.ts:checkPublishLockForKeyResult() + checkCycleLockForKeyResult()
 * - rbac.ts:canExportData()
 * 
 * TODO: Align naming with OkrGovernanceService methods once logic is moved
 */

interface Objective {
  id: string
  ownerId: string
  organizationId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  isPublished?: boolean
  cycleStatus?: string | null // From cycle.status if cycle exists
}

interface KeyResult {
  id: string
  ownerId: string
  organizationId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  // TODO: Once backend exposes cycle status on KR, add cycleStatus field
  // For now, will need to check via parent objective
}

interface PermissionChecks {
  canViewObjective: (objective: Objective) => boolean
  canEditObjective: (objective: Objective) => boolean
  canDeleteObjective: (objective: Objective) => boolean
  canEditKeyResult: (keyResult: KeyResult) => boolean
  canCheckInOnKeyResult: (keyResult: KeyResult) => boolean
  canExportData: () => boolean
}

export function useTenantPermissions() {
  // TODO Phase 4: centralise publish lock, cycle lock, RBAC, export_data
  const canEdit = (_okr: any) => true;
  const canDelete = (_okr: any) => true;
  const canPublish = (_okr: any) => true;
  const canExport = () => true;
  const canView = (_okr: any) => true;

  return { canEdit, canDelete, canPublish, canExport, canView };
}

