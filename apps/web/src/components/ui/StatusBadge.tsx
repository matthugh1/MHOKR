'use client'

import { Badge } from './badge'
import { cn } from '@/lib/utils'

export type ObjectiveStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'

export interface StatusBadgeProps {
  status: ObjectiveStatus
  className?: string
}

const getStatusBadgeConfig = (status: ObjectiveStatus) => {
  switch (status) {
    case 'ON_TRACK':
      return {
        className: 'bg-green-500/20 text-green-300 border-green-500/30',
        label: 'On Track',
      }
    case 'AT_RISK':
      return {
        className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse',
        label: 'At Risk',
      }
    case 'OFF_TRACK':
      return {
        className: 'bg-red-500/20 text-red-300 border-red-500/30',
        label: 'Off Track',
      }
    case 'COMPLETED':
      return {
        className: 'bg-green-600/20 text-green-400 border-green-600/30',
        label: 'Completed',
      }
    case 'CANCELLED':
      return {
        className: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        label: 'Cancelled',
      }
    default:
      return {
        className: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        label: status,
      }
  }
}

/**
 * StatusBadge - Standardized status indicator for objectives and key results
 * 
 * Displays status with appropriate color coding and animation (for AT_RISK).
 * Follows Phase 9 design system for consistent badge styling.
 * 
 * @example
 * ```tsx
 * <StatusBadge status="ON_TRACK" />
 * <StatusBadge status="AT_RISK" />
 * ```
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = getStatusBadgeConfig(status)
  
  return (
    <Badge
      variant="outline"
      className={cn('text-xs rounded-full border', statusConfig.className, className)}
    >
      {statusConfig.label}
    </Badge>
  )
}

