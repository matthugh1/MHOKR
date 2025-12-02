/**
 * Initiatives Section component
 * Displays list of linked initiatives with status, progress, due dates
 */

'use client'

import React from 'react'
import { Rocket, Calendar, AlertCircle } from 'lucide-react'
import { cn, clampProgress } from '@/lib/utils'
import { format } from 'date-fns'

interface InitiativesSectionProps {
  hideTitle?: boolean
  detail: {
    initiatives?: Array<{
      id: string
      title: string
      description?: string | null
      status: string
      progress: number
      dueDate?: string | null
      ownerId?: string | null
    }>
  } | null
  onInitiativeClick?: (initiativeId: string) => void
  onCreateInitiative?: () => void
  canCreate?: boolean
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'IN_PROGRESS':
      return { className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', label: 'In Progress' }
    case 'NOT_STARTED':
      return { className: 'bg-amber-500/10 text-amber-300 border-amber-500/20', label: 'Not Started' }
    case 'BLOCKED':
      return { className: 'bg-rose-500/10 text-rose-300 border-rose-500/20', label: 'Blocked' }
    case 'COMPLETED':
      return { className: 'bg-slate-500/10 text-slate-300 border-slate-500/20', label: 'Completed' }
    default:
      return { className: 'bg-slate-500/10 text-slate-300 border-slate-500/20', label: status }
  }
}

const formatDueDate = (dateString: string | null | undefined): { text: string; isOverdue: boolean } | null => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const formattedDate = format(date, 'MMM d, yyyy')

    if (diffDays < 0) {
      return { text: `${formattedDate} • Overdue`, isOverdue: true }
    } else if (diffDays === 0) {
      return { text: `Due today (${formattedDate})`, isOverdue: false }
    } else if (diffDays === 1) {
      return { text: `Due tomorrow (${formattedDate})`, isOverdue: false }
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days (${formattedDate})`, isOverdue: false }
    } else {
      return { text: `Due ${formattedDate}`, isOverdue: false }
    }
  } catch {
    return null
  }
}

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function InitiativesSection({ detail, onInitiativeClick, onCreateInitiative, canCreate = false, hideTitle = false }: InitiativesSectionProps) {
  const initiatives = detail?.initiatives || []
  const hasInitiatives = initiatives.length > 0

  // Show section if there are initiatives OR if user can create
  if (!hasInitiatives && !canCreate) {
    return null
  }

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Rocket size={16} className="text-slate-500" />
            Initiatives ({initiatives.length})
          </h4>
          {canCreate && onCreateInitiative && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCreateInitiative}
              className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Plus size={14} className="mr-1" />
              Add Initiative
            </Button>
          )}
        </div>
      )}

      {!hasInitiatives && canCreate && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-6 text-center">
          <Rocket size={24} className="text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-3">No initiatives yet</p>
          {onCreateInitiative && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateInitiative}
              className="bg-slate-800 border-slate-700 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              <Plus size={14} className="mr-1" />
              Create Initiative
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {initiatives.map((initiative) => {
          const statusBadge = getStatusBadge(initiative.status)
          const dueDateInfo = formatDueDate(initiative.dueDate)

          return (
            <div
              key={initiative.id}
              onClick={() => onInitiativeClick?.(initiative.id)}
              className={cn(
                'bg-slate-800/50 rounded-lg border border-slate-800 p-4 transition-all',
                onInitiativeClick && 'hover:bg-slate-800/70 hover:border-slate-700 cursor-pointer'
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h5 className="text-sm font-medium text-slate-200 flex-1 break-words">{initiative.title}</h5>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border flex-shrink-0', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              </div>

              {initiative.description && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{initiative.description}</p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${clampProgress(initiative.progress)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{Math.round(clampProgress(initiative.progress))}%</span>
                </div>

                {dueDateInfo && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar size={12} className={dueDateInfo.isOverdue ? 'text-rose-400' : 'text-slate-500'} />
                    <span className={dueDateInfo.isOverdue ? 'text-rose-400' : 'text-slate-400'}>
                      {dueDateInfo.text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

