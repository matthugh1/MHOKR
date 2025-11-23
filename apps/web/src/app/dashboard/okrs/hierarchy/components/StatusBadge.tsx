/**
 * Status Badge component for Hierarchy View
 * Adapted from test page design with backend status mapping
 */

import { OKRStatus } from './types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: OKRStatus
  className?: string
}

const statusConfig = {
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

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['ON_TRACK']

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


