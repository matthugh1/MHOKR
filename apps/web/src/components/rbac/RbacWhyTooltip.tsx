'use client'

import { ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { Info } from 'lucide-react'

interface ActionDecision {
  allowed: boolean
  reasons: {
    rbac: boolean
    publishLock: boolean
    tenant: boolean
    visibilityPrivate: boolean
    superuserReadonly: boolean
    execOnlyFlag: boolean
  }
}

interface RbacWhyTooltipProps {
  action: string
  resource: any // OKR or other resource
  children: ReactNode
  allowed: boolean
}

/**
 * RBAC Why Tooltip Component
 * 
 * Shows permission reasoning tooltips when an action is denied.
 * Only renders if the current user has rbacInspector feature flag enabled.
 * 
 * Security: Never reveals cross-tenant resources or raw IDs the caller cannot already access.
 */
export function RbacWhyTooltip({ action, resource, children, allowed }: RbacWhyTooltipProps) {
  const featureFlags = useFeatureFlags()
  const { canEditObjective, canDeleteObjective, getLockInfoForObjective } = useTenantPermissions()

  // Only render if feature flag enabled
  if (!featureFlags.rbacInspector) {
    return <>{children}</>
  }

  // Only show tooltip if action is denied
  if (allowed) {
    return <>{children}</>
  }

  // Determine deny reasons based on action and resource
  const reasons: ActionDecision['reasons'] = {
    rbac: false,
    publishLock: false,
    tenant: false,
    visibilityPrivate: false,
    superuserReadonly: false,
    execOnlyFlag: false,
  }

  let denyMessage = ''

  // Check specific deny reasons
  if (action === 'edit_okr' || action === 'delete_okr') {
    const lockInfo = resource ? getLockInfoForObjective(resource) : null
    if (lockInfo?.isLocked) {
      reasons.publishLock = true
      denyMessage = lockInfo.message || 'Published OKRs can only be edited by Tenant Owner/Admin.'
      
      // Add data-testid based on lock reason
      const testId = lockInfo.reason === 'published' 
        ? 'tip-publish-lock'
        : lockInfo.reason === 'cycle_locked'
        ? 'tip-cycle-lock'
        : lockInfo.message?.includes('Platform administrator')
        ? 'tip-superuser-readonly'
        : null
      
      if (testId) {
        // Store testId for later use in tooltip
        (resource as any)._lockTestId = testId
      }
    }

    // Check if can edit (combines RBAC + locks)
    const canEdit = resource ? canEditObjective(resource) : false
    if (!canEdit) {
      reasons.rbac = true
    }

    if (resource?.visibilityLevel === 'PRIVATE' && !canEdit) {
      reasons.visibilityPrivate = true
      if (!denyMessage) {
        denyMessage = 'PRIVATE OKRs require explicit access permission.'
      }
    }

    if (resource?.visibilityLevel === 'EXEC_ONLY' && !canEdit && resource?.isPublished) {
      reasons.execOnlyFlag = true
      if (!denyMessage) {
        denyMessage = 'EXEC_ONLY published OKRs require tenant admin with allowTenantAdminExecVisibility flag.'
      }
    }
    
    // SUPERUSER read-only check
    if (lockInfo?.message?.includes('Platform administrator')) {
      (resource as any)._lockTestId = 'tip-superuser-readonly'
    }
  }

  if (action === 'publish_okr') {
    const canEdit = resource ? canEditObjective(resource) : false
    if (!canEdit) {
      reasons.rbac = true
      denyMessage = 'You do not have permission to publish OKRs in this scope.'
    }
  }

  // Default message if none set
  if (!denyMessage && !allowed) {
    denyMessage = 'You do not have permission to perform this action.'
  }

  // Build tooltip content
  const tooltipContent = (
    <div className="space-y-2 text-xs max-w-xs">
      <div className="font-semibold">Why can&apos;t I {action.replace(/_/g, ' ')}?</div>
      {denyMessage && (
        <div className="text-slate-300">{denyMessage}</div>
      )}
      <div className="space-y-1 pt-2 border-t border-slate-600">
        <div className="flex items-center gap-2">
          <span>{reasons.rbac ? '❌' : '✅'}</span>
          <span>RBAC Permission</span>
        </div>
        {action === 'edit_okr' || action === 'delete_okr' ? (
          <>
            <div className="flex items-center gap-2">
              <span>{reasons.publishLock ? '❌' : '✅'}</span>
              <span>Publish Lock</span>
            </div>
            {resource?.visibilityLevel === 'PRIVATE' && (
              <div className="flex items-center gap-2">
                <span>{reasons.visibilityPrivate ? '❌' : '✅'}</span>
                <span>Visibility (PRIVATE)</span>
              </div>
            )}
            {resource?.visibilityLevel === 'EXEC_ONLY' && (
              <div className="flex items-center gap-2">
                <span>{reasons.execOnlyFlag ? '❌' : '✅'}</span>
                <span>EXEC_ONLY Flag</span>
              </div>
            )}
          </>
        ) : null}
        <div className="flex items-center gap-2">
          <span>{reasons.tenant ? '❌' : '✅'}</span>
          <span>Tenant Match</span>
        </div>
      </div>
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1" data-testid={(resource as any)?._lockTestId}>
            {children}
            <Info className="h-3 w-3 text-slate-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 text-slate-100 border-slate-700">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

