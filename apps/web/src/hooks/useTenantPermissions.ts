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
 * This hook mirrors backend logic in:
 * - objective.service.ts:canEdit() + okr-governance.service.ts:checkPublishLockForObjective() + checkCycleLockForObjective()
 * - objective.service.ts:canDelete() + okr-governance.service.ts:checkPublishLockForObjective() + checkCycleLockForObjective()
 * - key-result.service.ts:canEdit() + okr-governance.service.ts:checkPublishLockForKeyResult() + checkCycleLockForKeyResult()
 * - rbac.ts:canExportData()
 */

interface Objective {
  id: string
  ownerId: string
  organizationId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  isPublished?: boolean
  cycle?: {
    id: string
    status: string // 'LOCKED' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  } | null
  cycleStatus?: string | null // Alternative: direct cycleStatus field if cycle relation not loaded
}

interface KeyResult {
  id: string
  ownerId: string
  organizationId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  // Key Results inherit publish/cycle lock from parent objective
  // Pass parent objective info when checking permissions
  parentObjective?: {
    id: string
    organizationId?: string | null
    isPublished?: boolean
    cycle?: {
      id: string
      status: string
    } | null
    cycleStatus?: string | null
  } | null
}

interface LockInfo {
  isLocked: boolean
  reason: 'published' | 'cycle_locked' | null
}

interface PermissionChecks {
  canViewObjective: (objective: Objective) => boolean
  canEditObjective: (objective: Objective) => boolean
  canDeleteObjective: (objective: Objective) => boolean
  canEditKeyResult: (keyResult: KeyResult) => boolean
  canCheckInOnKeyResult: (keyResult: KeyResult) => boolean
  canExportData: () => boolean
  getLockInfoForObjective: (objective: Objective) => LockInfo
  getLockInfoForKeyResult: (keyResult: KeyResult) => LockInfo
}

export function useTenantPermissions(): PermissionChecks {
  const { user } = useAuth()
  const { currentOrganization } = useWorkspace()
  const permissions = usePermissions()

  // Helper: Check if user can override publish/cycle locks (tenant admin/owner)
  const canOverrideLocks = useMemo(() => {
    return (organizationId?: string | null): boolean => {
      return permissions.isTenantAdminOrOwner(organizationId || undefined)
    }
  }, [permissions])

  // Helper: Check if cycle is locked (status === 'LOCKED' or 'ARCHIVED')
  const isCycleLocked = useMemo(() => {
    return (cycleStatus?: string | null): boolean => {
      return cycleStatus === 'LOCKED' || cycleStatus === 'ARCHIVED'
    }
  }, [])

  // Helper: Get cycle status from objective (from cycle relation or direct field)
  const getCycleStatus = useMemo(() => {
    return (objective: Objective): string | null => {
      return objective.cycle?.status || objective.cycleStatus || null
    }
  }, [])

  const canViewObjective = useMemo(() => {
    return (objective: Objective): boolean => {
      // For now, if it's rendered, you can view it (matches current behavior)
      // TODO [phase6-frontend-hardening]: align with backend visibility rules once fully exposed
      return true
    }
  }, [])

  const canEditObjective = useMemo(() => {
    return (objective: Objective): boolean => {
      // Check basic RBAC edit permission
      const canEditRBAC = permissions.canEditOKR({
        ownerId: objective.ownerId,
        organizationId: objective.organizationId || undefined,
        workspaceId: objective.workspaceId || undefined,
        teamId: objective.teamId || undefined,
      })

      if (!canEditRBAC) {
        return false
      }

      // Check publish lock: if published, only tenant admin/owner can edit
      const isPublished = objective.isPublished === true
      if (isPublished && !canOverrideLocks(objective.organizationId)) {
        return false
      }

      // Check cycle lock: if cycle is locked, only tenant admin/owner can edit
      const cycleStatus = getCycleStatus(objective)
      if (isCycleLocked(cycleStatus) && !canOverrideLocks(objective.organizationId)) {
        return false
      }

      return true
    }
  }, [permissions, canOverrideLocks, isCycleLocked, getCycleStatus])

  const canDeleteObjective = useMemo(() => {
    return (objective: Objective): boolean => {
      // Check basic RBAC delete permission
      const canDeleteRBAC = permissions.canDeleteOKR({
        ownerId: objective.ownerId,
        organizationId: objective.organizationId || undefined,
        workspaceId: objective.workspaceId || undefined,
        teamId: objective.teamId || undefined,
      })

      if (!canDeleteRBAC) {
        return false
      }

      // Check publish lock: if published, only tenant admin/owner can delete
      const isPublished = objective.isPublished === true
      if (isPublished && !canOverrideLocks(objective.organizationId)) {
        return false
      }

      // Check cycle lock: if cycle is locked, only tenant admin/owner can delete
      const cycleStatus = getCycleStatus(objective)
      if (isCycleLocked(cycleStatus) && !canOverrideLocks(objective.organizationId)) {
        return false
      }

      return true
    }
  }, [permissions, canOverrideLocks, isCycleLocked, getCycleStatus])

  const canEditKeyResult = useMemo(() => {
    return (keyResult: KeyResult): boolean => {
      // Check basic RBAC edit permission for the KR
      const canEditRBAC = permissions.canEditOKR({
        ownerId: keyResult.ownerId,
        organizationId: keyResult.organizationId || undefined,
        workspaceId: keyResult.workspaceId || undefined,
        teamId: keyResult.teamId || undefined,
      })

      if (!canEditRBAC) {
        return false
      }

      // Check publish/cycle lock from parent objective
      const parentObjective = keyResult.parentObjective
      if (!parentObjective) {
        // TODO [phase6-frontend-hardening]: parent objective should always be available
        // For now, allow if RBAC passes
        return true
      }

      // Check publish lock from parent objective
      const isPublished = parentObjective.isPublished === true
      if (isPublished && !canOverrideLocks(parentObjective.organizationId || keyResult.organizationId)) {
        return false
      }

      // Check cycle lock from parent objective
      const cycleStatus = parentObjective.cycle?.status || parentObjective.cycleStatus || null
      if (isCycleLocked(cycleStatus) && !canOverrideLocks(parentObjective.organizationId || keyResult.organizationId)) {
        return false
      }

      return true
    }
  }, [permissions, canOverrideLocks, isCycleLocked])

  const canCheckInOnKeyResult = useMemo(() => {
    return (keyResult: KeyResult): boolean => {
      // Check-in uses same logic as edit for now
      // TODO [phase6-frontend-hardening]: align with backend logic - check-ins may be slightly looser
      return canEditKeyResult(keyResult)
    }
  }, [canEditKeyResult])

  const canExportData = useMemo(() => {
    return (): boolean => {
      // Match backend RBAC canExportData() logic
      // TENANT_OWNER, TENANT_ADMIN, and TENANT_VIEWER can export
      // This matches useTenantAdmin logic but uses the hook for consistency
      return permissions.isTenantAdminOrOwner(currentOrganization?.id)
    }
  }, [permissions, currentOrganization?.id])

  const getLockInfoForObjective = useMemo(() => {
    return (objective: Objective): LockInfo => {
      const isPublished = objective.isPublished === true
      const canOverride = canOverrideLocks(objective.organizationId)
      const cycleStatus = getCycleStatus(objective)
      const cycleLocked = isCycleLocked(cycleStatus)

      // Publish lock takes precedence
      if (isPublished && !canOverride) {
        return {
          isLocked: true,
          reason: 'published',
        }
      }

      // Cycle lock
      if (cycleLocked && !canOverride) {
        return {
          isLocked: true,
          reason: 'cycle_locked',
        }
      }

      return {
        isLocked: false,
        reason: null,
      }
    }
  }, [canOverrideLocks, isCycleLocked, getCycleStatus])

  const getLockInfoForKeyResult = useMemo(() => {
    return (keyResult: KeyResult): LockInfo => {
      const parentObjective = keyResult.parentObjective
      if (!parentObjective) {
        // No parent objective info available
        return {
          isLocked: false,
          reason: null,
        }
      }

      const isPublished = parentObjective.isPublished === true
      const canOverride = canOverrideLocks(parentObjective.organizationId || keyResult.organizationId)
      const cycleStatus = parentObjective.cycle?.status || parentObjective.cycleStatus || null
      const cycleLocked = isCycleLocked(cycleStatus)

      // Publish lock takes precedence
      if (isPublished && !canOverride) {
        return {
          isLocked: true,
          reason: 'published',
        }
      }

      // Cycle lock
      if (cycleLocked && !canOverride) {
        return {
          isLocked: true,
          reason: 'cycle_locked',
        }
      }

      return {
        isLocked: false,
        reason: null,
      }
    }
  }, [canOverrideLocks, isCycleLocked])

  return {
    canViewObjective,
    canEditObjective,
    canDeleteObjective,
    canEditKeyResult,
    canCheckInOnKeyResult,
    canExportData,
    getLockInfoForObjective,
    getLockInfoForKeyResult,
  }
}

