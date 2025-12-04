/**
 * Progress Bar component for Hierarchy View
 */

import { OKRStatus, InitiativeStatus } from './types'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  status: OKRStatus | InitiativeStatus
  className?: string
}

const getProgressColor = (status: OKRStatus | InitiativeStatus): string => {
  switch (status) {
    case 'ON_TRACK':
    case 'COMPLETED':
      return 'bg-emerald-500'
    case 'AT_RISK':
      return 'bg-amber-500'
    case 'OFF_TRACK':
      return 'bg-rose-500'
    case 'CANCELLED':
      return 'bg-slate-500'
    case 'NOT_STARTED':
      return 'bg-slate-400'
    case 'IN_PROGRESS':
      return 'bg-blue-500'
    case 'BLOCKED':
      return 'bg-rose-500'
    default:
      return 'bg-emerald-500'
  }
}

export function ProgressBar({ value, status, className }: ProgressBarProps) {
  const color = getProgressColor(status)
  const clampedValue = Math.min(Math.max(value, 0), 100)

  return (
    <div
      className={cn(
        'h-2 w-full bg-slate-700/50 rounded-full overflow-hidden',
        className
      )}
    >
      <div
        className={cn('h-full transition-all duration-500', color)}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  )
}


