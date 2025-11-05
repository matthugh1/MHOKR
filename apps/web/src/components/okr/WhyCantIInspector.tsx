'use client'

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WhyCantIInspectorProps {
  action: 'edit_okr' | 'delete_okr' | 'check_in_kr' | 'publish_okr'
  resource: any // OKR or KR resource
  className?: string
}

/**
 * Why Can't I Inspector Component
 * 
 * Shows a "Why?" link next to blocked actions when rbacInspector feature flag is enabled.
 * Provides production-safe explanation for why an action is blocked.
 */
export function WhyCantIInspector({ action, resource, className }: WhyCantIInspectorProps) {
  const featureFlags = useFeatureFlags()
  const { getLockInfoForObjective, getLockInfoForKeyResult } = useTenantPermissions()
  const [open, setOpen] = useState(false)

  // Only render if feature flag enabled
  if (!featureFlags.rbacInspector) {
    return null
  }

  // Get lock info based on action type
  let lockInfo: { isLocked: boolean; reason: 'published' | 'cycle_locked' | null; message: string } | null = null
  let reasonCode: string | null = null
  let effectiveRoles: string[] = []

  if (action === 'edit_okr' || action === 'delete_okr' || action === 'publish_okr') {
    lockInfo = resource ? getLockInfoForObjective(resource) : null
    if (lockInfo?.isLocked) {
      reasonCode = lockInfo.reason || 'not_owner'
      if (lockInfo.message?.includes('Platform administrator')) {
        reasonCode = 'superuser_readonly'
      }
    } else if (!lockInfo?.isLocked && resource) {
      // Check if it's an RBAC issue
      reasonCode = 'not_owner'
    }
  } else if (action === 'check_in_kr') {
    // For KR check-ins, check parent objective lock
    if (resource?.parentObjective) {
      lockInfo = getLockInfoForObjective(resource.parentObjective)
      if (lockInfo?.isLocked) {
        reasonCode = lockInfo.reason || 'not_owner'
      }
    }
    if (resource) {
      lockInfo = getLockInfoForKeyResult(resource)
      if (lockInfo?.isLocked) {
        reasonCode = lockInfo.reason || 'not_owner'
      }
    }
  }

  // Don't show if no reason found
  if (!reasonCode && !lockInfo?.isLocked) {
    return null
  }

  const getReasonLabel = () => {
    switch (reasonCode) {
      case 'published':
        return 'Publish Lock'
      case 'cycle_locked':
        return 'Cycle Locked'
      case 'superuser_readonly':
        return 'SUPERUSER Read-Only'
      case 'visibility_private':
        return 'Visibility (PRIVATE)'
      case 'not_owner':
        return 'Not Owner'
      default:
        return 'Permission Denied'
    }
  }

  const message = lockInfo?.message || 'You do not have permission to perform this action.'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground ${className}`}
          data-testid="why-link"
          aria-label="Why can't I perform this action?"
        >
          <HelpCircle className="h-3 w-3" />
          Why?
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" data-testid="why-popover">
        <div className="space-y-3">
          <div className="font-semibold text-sm">Why can&apos;t I {action.replace(/_/g, ' ')}?</div>
          
          {reasonCode && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Reason:</div>
              <div className="text-sm">{getReasonLabel()}</div>
            </div>
          )}
          
          {message && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Message:</div>
              <div className="text-sm text-foreground">{message}</div>
            </div>
          )}
          
          {effectiveRoles.length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground">Effective Roles:</div>
              <div className="text-xs text-foreground">{effectiveRoles.join(', ')}</div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

