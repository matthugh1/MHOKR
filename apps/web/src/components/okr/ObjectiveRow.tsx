"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { OkrBadge } from "./OkrBadge"
import { AvatarCircle } from "@/components/dashboard/AvatarCircle"
import { Edit2, Trash2, History, Plus, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ObjectiveRowProps {
  objective: {
    id: string
    title: string
    status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
    progress: number
    isPublished: boolean
    cycleName?: string
    cycleLabel?: string
    cycleStatus?: string
    visibilityLevel?: string
    owner: {
      id: string
      name: string
      email?: string | null
    }
    overdueCountForObjective?: number
    lowestConfidence?: number | null
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
      ownerId?: string
    }>
    initiatives?: Array<{
      id: string
      title: string
      status?: string
      dueDate?: string
      keyResultId?: string
      keyResultTitle?: string
    }>
  }
  isExpanded: boolean
  onToggle: (id: string) => void
  onAddKeyResult: (objectiveId: string, objectiveName: string) => void
  onAddInitiative: (objectiveId: string, objectiveName: string) => void
  onEdit: (objectiveId: string) => void
  onDelete: (objectiveId: string) => void
  onOpenHistory?: () => void
  onAddInitiativeToKr?: (krId: string) => void
  onAddCheckIn?: (krId: string) => void
  canEdit: boolean
  canDelete: boolean
  availableUsers?: Array<{ id: string; name: string; email?: string }>
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ON_TRACK':
      return { tone: 'good' as const, label: 'On Track' }
    case 'AT_RISK':
      return { tone: 'warn' as const, label: 'At Risk' }
    case 'BLOCKED':
      return { tone: 'bad' as const, label: 'Blocked' }
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
      return 'Weekly'
    case 'BIWEEKLY':
      return 'Fortnightly'
    case 'MONTHLY':
      return 'Monthly'
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

const getProgressBarColor = (status: string) => {
  switch (status) {
    case 'ON_TRACK':
      return 'bg-emerald-500'
    case 'AT_RISK':
      return 'bg-amber-500'
    case 'BLOCKED':
      return 'bg-rose-500'
    case 'COMPLETED':
      return 'bg-neutral-400'
    default:
      return 'bg-neutral-300'
  }
}

function getCheckInPill(overdueCount: number) {
  if (overdueCount === 0) {
    return {
      text: "All check-ins on time",
      className: "bg-emerald-500 text-white",
    }
  }
  if (overdueCount === 1) {
    return {
      text: "1 overdue check-in",
      className: "bg-amber-500 text-white",
    }
  }
  return {
    text: `${overdueCount} overdue check-ins`,
    className: "bg-rose-500 text-white",
  }
}

function getConfidencePill(conf: number | null) {
  if (conf === null) {
    return {
      text: "No recent update",
      className: "bg-neutral-200 text-neutral-700",
    }
  }
  if (conf >= 80) return { text: `Confidence ${conf}%`, className: "bg-emerald-500 text-white" }
  if (conf >= 50) return { text: `Confidence ${conf}%`, className: "bg-amber-500 text-white" }
  return { text: `Confidence ${conf}%`, className: "bg-rose-500 text-white" }
}

function getCyclePill(cycleLabel: string, cycleStatus: string) {
  if (cycleStatus === "DRAFT") {
    return {
      text: cycleLabel,
      className: "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300",
    }
  }
  if (cycleStatus === "ARCHIVED") {
    return {
      text: cycleLabel,
      className: "bg-neutral-200 text-neutral-600",
    }
  }
  return {
    text: cycleLabel,
    className: "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-300",
  }
}

export function ObjectiveRow({
  objective,
  isExpanded,
  onToggle,
  onAddKeyResult,
  onAddInitiative,
  onEdit,
  onDelete,
  onOpenHistory,
  onAddInitiativeToKr,
  onAddCheckIn,
  canEdit,
  canDelete,
  availableUsers = [],
}: ObjectiveRowProps) {
  const statusBadge = getStatusBadge(objective.status)
  const keyResults = objective.keyResults || []
  const initiatives = objective.initiatives || []
  
  // Calculate overdue count (use provided value or fallback to computed)
  const overdueCount = objective.overdueCountForObjective ?? keyResults.filter(kr => kr.isOverdue).length
  
  // Calculate progress bar color
  const progressBarColor = getProgressBarColor(objective.status)
  
  // Get execution metadata pills
  const checkInPill = getCheckInPill(overdueCount)
  const confidencePill = getConfidencePill(objective.lowestConfidence ?? null)
  const cyclePill = getCyclePill(
    objective.cycleLabel || objective.cycleName || 'Unassigned',
    objective.cycleStatus || 'ACTIVE'
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle(objective.id)
    }
  }

  return (
    <section className="border border-neutral-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200">
      {/* Collapsed header (always visible) */}
      <div
        className="py-3.5 px-4 cursor-pointer hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 rounded-t-xl"
        onClick={() => onToggle(objective.id)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} objective: ${objective.title}`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Title and badges */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {/* Title */}
            <h3 className="text-base font-semibold text-neutral-900 truncate">
              {objective.title}
            </h3>
            
            {/* Progress bar */}
            <div className="w-full h-1 rounded-full bg-neutral-200 overflow-hidden">
              {/* TODO [phase6-polish]: Animate progress bar changes with spring transition. */}
              <motion.div
                className={cn("h-full rounded-full", progressBarColor)}
                initial={false}
                animate={{ width: `${Math.min(100, Math.max(0, objective.progress))}%` }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              />
            </div>
            
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status */}
              <OkrBadge tone={statusBadge.tone}>
                {statusBadge.label}
              </OkrBadge>
              
              {/* Publication */}
              <OkrBadge tone={objective.isPublished ? 'neutral' : 'warn'}>
                {objective.isPublished ? 'Published' : 'Draft'}
              </OkrBadge>
              
              {/* Cycle name */}
              {objective.cycleName && (
                <OkrBadge tone="neutral">
                  {objective.cycleName}
                </OkrBadge>
              )}
              
              {/* Visibility */}
              {objective.visibilityLevel && (
                <OkrBadge tone="neutral">
                  {getVisibilityLabel(objective.visibilityLevel)}
                </OkrBadge>
              )}
              
              {/* Owner avatar chip */}
              <div className="flex items-center gap-1.5">
                <AvatarCircle name={objective.owner.name} size="sm" />
                <span className="text-xs text-neutral-600">
                  <span className="text-neutral-500">Owner:</span> {objective.owner.name}
                </span>
              </div>
              
              {/* Overdue badge */}
              {overdueCount > 0 && (
                <OkrBadge tone="bad">
                  {overdueCount} overdue check-in{overdueCount !== 1 ? 's' : ''}
                </OkrBadge>
              )}
            </div>
          </div>

          {/* Execution metadata chips (responsive visibility) */}
          {/* TODO [phase6-polish]: Add subtle fade/slide-in of these pills on row hover for visual focus without clutter. */}
          {/* TODO [phase6-polish]: animate pill colour on status changes with framer-motion layout + animate prop. */}
          <div className="hidden lg:flex items-center gap-2 ml-auto text-[11px]" onClick={(e) => e.stopPropagation()}>
            {/* Check-in discipline */}
            <span className={cn("px-2 py-1 rounded-full font-medium leading-none whitespace-nowrap", checkInPill.className)}>
              {checkInPill.text}
            </span>
            {/* Confidence level */}
            {/* TODO [phase6-polish]: Add a tiny ▲ / ▼ arrow based on change vs previous check-in. */}
            {/* TODO [phase7-hardening]: surface tooltip on hover explaining where the numbers come from. */}
            <span className={cn("px-2 py-1 rounded-full font-medium leading-none whitespace-nowrap", confidencePill.className)}>
              {confidencePill.text}
            </span>
            {/* Cycle period */}
            <span className={cn("px-2 py-1 rounded-full font-medium leading-none whitespace-nowrap", cyclePill.className)}>
              {cyclePill.text}
            </span>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {onAddKeyResult && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => onAddKeyResult(objective.id, objective.title)}
                      aria-label="Add Key Result"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>+ KR</p>
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
                      onClick={() => onAddInitiative(objective.id, objective.title)}
                      aria-label="Add Initiative"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>+ Initiative</p>
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
                      onClick={() => onEdit(objective.id)}
                      aria-label="Edit objective"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit</p>
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
                      onClick={() => onDelete(objective.id)}
                      aria-label="Delete objective"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
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
                    <p>History</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Chevron icon */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              <ChevronDown className="h-5 w-5 text-neutral-400" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Expanded body (visible only when isExpanded === true) */}
      {/* TODO [phase6-polish]: Animate expand/collapse using framer-motion height + opacity. */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-neutral-50/80 border-t">
          {/* Key Results section */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-neutral-700 mb-3 uppercase tracking-wide">
              Key Results
            </h4>
            {keyResults.length > 0 ? (
              <div className={cn(
                "space-y-2",
                keyResults.length > 6 && "max-h-[300px] overflow-y-auto"
              )}>
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
                    <div
                      key={kr.id}
                      className="rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          {/* Title and badges */}
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
                          
                          {/* Progress bar */}
                          {kr.progress !== undefined && (
                            <div className="w-full h-1 rounded-full bg-neutral-200 overflow-hidden">
                              {/* TODO [phase6-polish]: Animate progress bar changes with spring transition. */}
                              <motion.div
                                className={cn("h-full rounded-full", getProgressBarColor(kr.status || 'ON_TRACK'))}
                                initial={false}
                                animate={{ width: `${Math.min(100, Math.max(0, kr.progress))}%` }}
                                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                              />
                            </div>
                          )}
                          
                          {/* Current → target values */}
                          {kr.currentValue !== undefined && kr.targetValue !== undefined && 
                           kr.startValue !== undefined && (
                            <div className="text-[12px] leading-snug text-neutral-500">
                              {kr.currentValue} {kr.unit || ''} → target {kr.targetValue} {kr.unit || ''}
                            </div>
                          )}
                          
                          {/* [phase5-core:done] show KR owner avatar when not the same as objective owner */}
                          {kr.ownerId && kr.ownerId !== objective.owner.id && (
                            <div className="flex items-center gap-1.5">
                              <AvatarCircle 
                                name={availableUsers?.find(u => u.id === kr.ownerId)?.name || kr.ownerId} 
                                size="sm" 
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Action buttons for this KR */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {onAddInitiativeToKr && (
                            <button
                              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                              onClick={() => onAddInitiativeToKr(kr.id)}
                              aria-label={`Add new Initiative to this Key Result: ${kr.title}`}
                            >
                              + Initiative
                            </button>
                          )}
                          {onAddCheckIn && (
                            <button
                              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                              onClick={() => onAddCheckIn(kr.id)}
                              aria-label={`Add check-in for Key Result: ${kr.title}`}
                            >
                              Add check-in
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-4 text-center text-sm text-neutral-600">
                <p className="font-medium">No Key Results yet</p>
                <p className="text-[12px] text-neutral-500">Add measurable outcomes you'll track this period.</p>
                <button
                  className="mt-2 text-[12px] font-medium text-violet-700 hover:text-violet-900 underline underline-offset-2"
                  onClick={() => onAddKeyResult(objective.id, objective.title)}
                >
                  + Add Key Result
                </button>
              </div>
            )}
          </div>

          {/* Initiatives section */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-700 mb-3 uppercase tracking-wide">
              Initiatives
            </h4>
            {initiatives.length > 0 ? (
              <div className="space-y-2">
                {initiatives.map((init) => {
                  const initStatusBadge = getInitiativeStatusBadge(init.status)
                  const dueDateFormatted = formatDueDate(init.dueDate)
                  
                  return (
                    <div
                      key={init.id}
                      className="rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-neutral-900">
                              {init.title}
                            </span>
                            <OkrBadge tone={initStatusBadge.tone}>
                              {initStatusBadge.label}
                            </OkrBadge>
                            {dueDateFormatted && (
                              <span className="text-[12px] text-neutral-500">
                                Due {dueDateFormatted}
                              </span>
                            )}
                          </div>
                          {init.keyResultId && init.keyResultTitle && (
                            <div className="text-[11px] text-neutral-500">
                              (supports KR: {init.keyResultTitle})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-4 text-center text-sm text-neutral-600">
                <p className="font-medium">No Initiatives yet</p>
                <p className="text-[12px] text-neutral-500">Add initiatives that support this objective.</p>
                <button
                  className="mt-2 text-[12px] font-medium text-violet-700 hover:text-violet-900 underline underline-offset-2"
                  onClick={() => onAddInitiative(objective.id, objective.title)}
                >
                  + Add Initiative
                </button>
              </div>
            )}
          </div>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
    </section>
  )
}

