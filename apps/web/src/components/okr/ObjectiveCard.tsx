"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { OkrBadge } from "./OkrBadge"
import { AvatarCircle } from "@/components/dashboard/AvatarCircle"
import { Edit2, Trash2, History, Lock, Plus } from "lucide-react"

export interface ObjectiveCardProps {
  title: string
  ownerName: string
  ownerAvatarUrl?: string
  status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'
  progressPct: number
  isPublished: boolean
  cycleName?: string
  visibilityLevel?: string
  keyResults?: Array<{
    id: string
    title: string
    status?: string
    progress?: number
    currentValue?: number
    targetValue?: number
    startValue?: number
    unit?: string
    checkInCadence?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'NONE'
    isOverdue?: boolean
  }>
  initiatives?: Array<{
    id: string
    title: string
    status?: string
    dueDate?: string
    keyResultId?: string
    keyResultTitle?: string
  }>
  onOpenHistory?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onAddKeyResult?: () => void
  onAddInitiative?: () => void
  onAddInitiativeToKr?: (krId: string) => void
  onAddCheckIn?: (krId: string) => void
  canEdit: boolean
  canDelete: boolean
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ON_TRACK':
      return { tone: 'good' as const, label: 'On track' }
    case 'AT_RISK':
      return { tone: 'bad' as const, label: 'At risk' }
    case 'COMPLETED':
      return { tone: 'neutral' as const, label: 'Completed' }
    default:
      return { tone: 'neutral' as const, label: '—' }
  }
}

const getVisibilityLabel = (level?: string) => {
  if (!level) return 'Org-visible'
  switch (level) {
    case 'PUBLIC_TENANT':
      return 'Org-visible'
    case 'WORKSPACE_ONLY':
      return 'Workspace-only'
    case 'TEAM_ONLY':
      return 'Team-only'
    case 'PRIVATE':
      return 'Private'
    default:
      return level
  }
}

const getCadenceLabel = (cadence?: string) => {
  switch (cadence) {
    case 'WEEKLY':
      return 'Weekly updates'
    case 'BIWEEKLY':
      return 'Fortnightly updates'
    case 'MONTHLY':
      return 'Monthly updates'
    default:
      return 'No cadence'
  }
}

const getInitiativeStatusBadge = (status?: string) => {
  switch (status) {
    case 'IN_PROGRESS':
      return { tone: 'good' as const, label: 'In progress' }
    case 'NOT_STARTED':
      return { tone: 'warn' as const, label: 'Not started' }
    case 'BLOCKED':
      return { tone: 'bad' as const, label: 'Blocked' }
    case 'COMPLETED':
      return { tone: 'neutral' as const, label: 'Complete' }
    default:
      return { tone: 'neutral' as const, label: status || '—' }
  }
}

const formatDueDate = (dateString?: string) => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return null
  }
}

const isDueSoon = (dateString?: string) => {
  if (!dateString) return false
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 7
  } catch {
    return false
  }
}

export function ObjectiveCard({
  title,
  ownerName,
  ownerAvatarUrl: _ownerAvatarUrl,
  status,
  progressPct,
  isPublished,
  cycleName,
  visibilityLevel,
  keyResults = [],
  initiatives = [],
  onOpenHistory,
  onEdit,
  onDelete,
  onAddKeyResult,
  onAddInitiative,
  onAddInitiativeToKr,
  onAddCheckIn,
  canEdit,
  canDelete,
}: ObjectiveCardProps) {
  const statusBadge = getStatusBadge(status)
  const publishedBadgeLabel = isPublished ? 'Published · locked' : 'Draft · editable'
  const publishedBadgeTone = isPublished ? 'neutral' : 'warn'

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between gap-4">
          {/* Left side */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-neutral-900 leading-tight">
              {title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              {/* Status badge */}
              <OkrBadge tone={statusBadge.tone}>
                {statusBadge.label}
              </OkrBadge>
              
              {/* Published/Locked badge */}
              <OkrBadge tone={publishedBadgeTone}>
                {publishedBadgeLabel}
              </OkrBadge>
              
              {/* Cycle badge */}
              {cycleName && (
                <OkrBadge tone="neutral">
                  {cycleName}
                </OkrBadge>
              )}
              
              {/* Visibility badge */}
              {visibilityLevel && (
                <OkrBadge tone="neutral">
                  {getVisibilityLabel(visibilityLevel)}
                </OkrBadge>
              )}
              
              {/* Owner chip */}
              <div className="flex items-center gap-1.5">
                <AvatarCircle name={ownerName} size="sm" />
                <span>{ownerName}</span>
              </div>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {onOpenHistory && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={onOpenHistory}
                      aria-label="View history"
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
                      aria-label="Edit objective"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {canEdit
                        ? 'Edit Objective'
                        : isPublished
                        ? 'This Objective is published and locked'
                        : 'You do not have permission'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {onAddKeyResult && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={onAddKeyResult}
                      aria-label="Add Key Result"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add Key Result</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {onAddInitiative && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={onAddInitiative}
                      aria-label="Add Initiative"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add Initiative</p>
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
                      aria-label="Delete objective"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {canDelete
                        ? 'Delete Objective'
                        : isPublished
                        ? 'This Objective is published and locked'
                        : 'You do not have permission'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-neutral-600">Progress</span>
            <span className="text-sm font-semibold text-neutral-900">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        </div>

        {/* Key Results */}
        <div>
          <h4 className="text-xs font-semibold text-neutral-700 mb-2 uppercase tracking-wide">
            Key Results {keyResults.length > 0 && `(${keyResults.length})`}
          </h4>
          {keyResults.length > 0 ? (
            <ul className="space-y-2">
              {keyResults.map((kr) => {
                const krStatusBadge = getStatusBadge(kr.status || 'ON_TRACK')
                const cadenceLabel = getCadenceLabel(kr.checkInCadence)
                
                // Calculate progress label
                let progressLabel = 'Progress not tracked'
                if (kr.currentValue !== undefined && kr.targetValue !== undefined && 
                    typeof kr.currentValue === 'number' && typeof kr.targetValue === 'number' && kr.targetValue > 0) {
                  const progressPct = Math.round((kr.currentValue / kr.targetValue) * 100)
                  progressLabel = `${progressPct}% of ${kr.targetValue}${kr.unit ? ` ${kr.unit}` : ''}`
                }
                
                return (
                  <li key={kr.id}>
                    <div className="flex items-start justify-between rounded-lg border border-neutral-200 bg-white/50 p-3 hover:bg-neutral-50 transition-colors">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-medium text-neutral-900 leading-tight">
                            {kr.title}
                          </div>
                          <OkrBadge tone={krStatusBadge.tone}>
                            {krStatusBadge.label}
                          </OkrBadge>
                          {kr.checkInCadence && kr.checkInCadence !== 'NONE' && (
                            <OkrBadge tone="neutral">
                              {cadenceLabel}
                            </OkrBadge>
                          )}
                          <OkrBadge tone="neutral">
                            {progressLabel}
                          </OkrBadge>
                        </div>
                        {kr.currentValue !== undefined && kr.targetValue !== undefined && 
                         kr.startValue !== undefined && (
                          <div className="text-[12px] leading-snug text-neutral-500">
                            {kr.currentValue} {kr.unit || ''} → target {kr.targetValue} {kr.unit || ''}
                          </div>
                        )}
                        {kr.isOverdue && (
                          <div className="flex items-center gap-1 text-[12px] text-rose-600 font-medium">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Update overdue
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
                        {onAddInitiativeToKr && (
                          <button
                            className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                            onClick={() => onAddInitiativeToKr(kr.id)}
                            aria-label={`Add new Initiative to this Key Result: ${kr.title}`}
                            // [phase5-core:done] hooked into shared handlers from OKR page for KR check-ins and initiative creation.
                          >
                            + Initiative
                          </button>
                        )}
                        {onAddCheckIn && (
                          <button
                            className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                            onClick={() => onAddCheckIn(kr.id)}
                            aria-label={`Add check-in for Key Result: ${kr.title}`}
                            // [phase5-core:done] hooked into shared handlers from OKR page for KR check-ins and initiative creation.
                          >
                            Add check-in
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="text-xs text-neutral-500 text-center py-2">
              No key results yet
            </div>
          )}
        </div>

        {/* Initiatives */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
              Initiatives
            </div>
            {onAddInitiative && (
              <button
                className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                onClick={onAddInitiative}
                aria-label="Add new Initiative to this Objective"
                // [phase5-core:done] hooked into shared handlers from OKR page for KR check-ins and initiative creation.
              >
                + Initiative
              </button>
            )}
          </div>
          {initiatives.length > 0 ? (
            <ul className="space-y-2">
              {initiatives.map((init) => {
                const initStatusBadge = getInitiativeStatusBadge(init.status)
                const dueDateFormatted = formatDueDate(init.dueDate)
                const dueSoon = isDueSoon(init.dueDate) && init.status !== 'COMPLETED'
                
                return (
                  <li key={init.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-neutral-900">
                        {init.title}
                      </span>
                      <OkrBadge tone={initStatusBadge.tone}>
                        {initStatusBadge.label}
                      </OkrBadge>
                      {dueDateFormatted && (
                        <span className={`text-[12px] ${dueSoon ? 'text-rose-600' : 'text-neutral-500'}`}>
                          Due {dueDateFormatted}
                          {dueSoon && ' • Upcoming'}
                        </span>
                      )}
                    </div>
                    {init.keyResultId && init.keyResultTitle && (
                      <div className="text-[11px] text-neutral-500">
                        (supports KR: {init.keyResultTitle})
                      </div>
                    )}
                    {/* TODO [phase6-polish]: If due date is within next 7 days and status !== COMPLETE, colour the due date text-rose-600 and append "• Upcoming". */}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="text-xs text-neutral-500 text-center py-2">
              No initiatives yet
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
