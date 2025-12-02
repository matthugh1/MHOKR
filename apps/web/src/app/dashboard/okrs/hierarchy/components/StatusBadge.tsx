/**
 * Status Badge component for Hierarchy View
 * Adapted from test page design with backend status mapping
 */

import { OKRStatus, InitiativeStatus } from './types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: OKRStatus | InitiativeStatus
  className?: string
}

const okrStatusConfig = {
  'ON_TRACK': {
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotColor: 'bg-emerald-400',
    label: 'On Track',
  },
  'AT_RISK': {
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-400',
    label: 'At Risk',
  },
  'OFF_TRACK': {
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dotColor: 'bg-rose-400',
    label: 'Off Track',
  },
  'COMPLETED': {
    className: 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20',
    dotColor: 'bg-emerald-400',
    label: 'Completed',
  },
  'CANCELLED': {
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    dotColor: 'bg-slate-400',
    label: 'Cancelled',
  },
}

const initiativeStatusConfig = {
  'NOT_STARTED': {
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-400',
    label: 'Not Started',
  },
  'IN_PROGRESS': {
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotColor: 'bg-emerald-400',
    label: 'In Progress',
  },
  'COMPLETED': {
    className: 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20',
    dotColor: 'bg-emerald-400',
    label: 'Completed',
  },
  'BLOCKED': {
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dotColor: 'bg-rose-400',
    label: 'Blocked',
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Check if it's an initiative status
  const isInitiativeStatus = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'].includes(status) && 
    !['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'CANCELLED'].includes(status as string)
  
  const config = isInitiativeStatus 
    ? (initiativeStatusConfig[status as InitiativeStatus] || initiativeStatusConfig['NOT_STARTED'])
    : (okrStatusConfig[status as OKRStatus] || okrStatusConfig['ON_TRACK'])

  return (
    <span
      className={cn(
        'text-xs px-2 py-0.5 rounded-full border flex items-center gap-1',
        config.className,
        className
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  )
}


