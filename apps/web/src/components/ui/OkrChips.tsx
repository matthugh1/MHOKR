/**
 * OKR Status Chip Component
 * 
 * W5.M3: Accessible chip component with aria-labels
 * Ensures colour contrast ≥ 4.5:1 and proper semantic roles
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusValue = 'ON_TRACK' | 'AT_RISK' | 'BLOCKED' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'
export type PublishStateValue = 'PUBLISHED' | 'DRAFT'
export type VisibilityLevelValue = 'PUBLIC_TENANT' | 'PRIVATE'

interface StatusChipProps {
  status: StatusValue
  interactive?: boolean
  onClick?: () => void
  className?: string
}

interface PublishStateChipProps {
  publishState: PublishStateValue
  interactive?: boolean
  onClick?: () => void
  className?: string
}

interface VisibilityChipProps {
  visibilityLevel: VisibilityLevelValue
  interactive?: boolean
  onClick?: () => void
  className?: string
}

const statusConfig: Record<StatusValue, { label: string; ariaLabel: string; className: string }> = {
  ON_TRACK: {
    label: 'On track',
    ariaLabel: 'Status: On track',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
  AT_RISK: {
    label: 'At risk',
    ariaLabel: 'Status: At risk',
    className: 'bg-amber-100 text-amber-700 border-amber-300',
  },
  BLOCKED: {
    label: 'Blocked',
    ariaLabel: 'Status: Blocked',
    className: 'bg-rose-100 text-rose-700 border-rose-300',
  },
  OFF_TRACK: {
    label: 'Off track',
    ariaLabel: 'Status: Off track',
    className: 'bg-rose-100 text-rose-700 border-rose-300',
  },
  COMPLETED: {
    label: 'Completed',
    ariaLabel: 'Status: Completed',
    className: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    ariaLabel: 'Status: Cancelled',
    className: 'bg-neutral-100 text-neutral-500 border-neutral-300',
  },
}

const publishStateConfig: Record<PublishStateValue, { label: string; ariaLabel: string; className: string }> = {
  PUBLISHED: {
    label: 'Published',
    ariaLabel: 'Publish state: Published',
    className: 'bg-violet-100 text-violet-700 border-violet-300',
  },
  DRAFT: {
    label: 'Draft',
    ariaLabel: 'Publish state: Draft',
    className: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  },
}

const visibilityConfig: Record<VisibilityLevelValue, { label: string; ariaLabel: string; className: string }> = {
  PUBLIC_TENANT: {
    label: 'Public',
    ariaLabel: 'Visibility: Public (Tenant)',
    className: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  PRIVATE: {
    label: 'Private',
    ariaLabel: 'Visibility: Private',
    className: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  },
}

export function StatusChip({ status, interactive = false, onClick, className }: StatusChipProps) {
  const config = statusConfig[status]

  if (interactive && onClick) {
    return (
      <Badge
        variant="outline"
        className={cn(config.className, 'cursor-pointer hover:ring-2 hover:ring-ring focus:ring-2 focus:ring-ring focus:outline-none', className)}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={config.ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {config.label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
      role="status"
      aria-label={config.ariaLabel}
    >
      {config.label}
    </Badge>
  )
}

export function PublishStateChip({ publishState, interactive = false, onClick, className }: PublishStateChipProps) {
  const config = publishStateConfig[publishState]

  if (interactive && onClick) {
    return (
      <Badge
        variant="outline"
        className={cn(config.className, 'cursor-pointer hover:ring-2 hover:ring-ring focus:ring-2 focus:ring-ring focus:outline-none', className)}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={config.ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {config.label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
      role="status"
      aria-label={config.ariaLabel}
    >
      {config.label}
    </Badge>
  )
}

export function VisibilityChip({ visibilityLevel, interactive = false, onClick, className }: VisibilityChipProps) {
  const config = visibilityConfig[visibilityLevel]

  if (interactive && onClick) {
    return (
      <Badge
        variant="outline"
        className={cn(config.className, 'cursor-pointer hover:ring-2 hover:ring-ring focus:ring-2 focus:ring-ring focus:outline-none', className)}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={config.ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {config.label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
      role="status"
      aria-label={config.ariaLabel}
    >
      {config.label}
    </Badge>
  )
}

