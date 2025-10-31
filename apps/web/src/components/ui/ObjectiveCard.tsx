'use client'

import { Badge } from './badge'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { StatusBadge, type ObjectiveStatus } from './StatusBadge'
import { Edit2, Trash2, History, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ObjectiveCardProps {
  title: string
  ownerName: string
  ownerAvatarUrl?: string
  status: ObjectiveStatus
  progressPct: number // 0-100
  isPublished: boolean
  nextCheckInDue?: string // optional
  onOpenHistory?: () => void
  onEdit?: () => void
  onDelete?: () => void
  canEdit: boolean // after publish lock + RBAC
  canDelete: boolean // after publish lock + RBAC
}


/**
 * @module ObjectiveCard
 * @see {@link https://github.com/matthugh1/MHOKR/blob/main/docs/architecture/DESIGN_SYSTEM.md Design System Documentation}
 * 
 * ObjectiveCard - Full objective card component with progress, status, and actions
 * 
 * Displays objective title, owner, status badge, progress bar, and action buttons.
 * Uses Phase 9 design tokens and integrates with StatusBadge component.
 */

const formatNextCheckIn = (dateString?: string) => {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)}d`
  } else if (diffDays === 0) {
    return 'Due today'
  } else if (diffDays === 1) {
    return 'Due tomorrow'
  } else {
    return `Due in ${diffDays}d`
  }
}

export function ObjectiveCard({
  title,
  ownerName,
  ownerAvatarUrl,
  status,
  progressPct,
  isPublished,
  nextCheckInDue,
  onOpenHistory,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: ObjectiveCardProps) {
  const nextCheckInText = formatNextCheckIn(nextCheckInDue)
  const initials = ownerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 p-4',
        'bg-white shadow-sm',
        'transition-all duration-200',
        'hover:ring-1 hover:ring-blue-200 hover:shadow-md'
      )}
    >
      {/* First row: title + status chip + published badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 mb-2 line-clamp-2">
            {title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={status} />
            {isPublished && (
              <Badge
                variant="outline"
                className="text-xs rounded-full border-slate-500/30 bg-slate-500/10 text-slate-400 flex items-center gap-1"
              >
                <Lock className="h-3 w-3" />
                Published
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Second row: progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-600">Progress</span>
          <span className="text-sm font-semibold text-slate-900">
            {Math.round(progressPct)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      </div>

      {/* Third row: owner, check-in, history */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            {ownerAvatarUrl ? (
              <img
                src={ownerAvatarUrl}
                alt={ownerName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-700">
                {initials}
              </div>
            )}
            <span className="text-slate-700">{ownerName}</span>
          </div>
          {nextCheckInText && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-xs">{nextCheckInText}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onOpenHistory && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={onOpenHistory}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View History</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onEdit && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={!canEdit}
                    onClick={onEdit}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {canEdit
                      ? 'Edit OKR'
                      : isPublished
                      ? 'This OKR is published and locked. You cannot change targets after publish.'
                      : 'You do not have permission to perform this action'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onDelete && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={!canDelete}
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {canDelete
                      ? 'Delete OKR'
                      : isPublished
                      ? 'This OKR is published and locked. You cannot change targets after publish.'
                      : 'You do not have permission to perform this action'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  )
}

