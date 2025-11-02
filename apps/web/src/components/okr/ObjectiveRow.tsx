"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { OkrBadge } from "./OkrBadge"
import { AvatarCircle } from "@/components/dashboard/AvatarCircle"
import { Edit2, Trash2, History, Plus, ChevronDown, ChevronUp, MoreVertical } from "lucide-react"
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
      return { tone: 'good' as const, label: 'On track' }
    case 'AT_RISK':
      return { tone: 'warn' as const, label: 'At risk' }
    case 'BLOCKED':
      return { tone: 'bad' as const, label: 'Blocked' }
    case 'COMPLETED':
      return { tone: 'neutral' as const, label: 'Completed' }
    case 'CANCELLED':
      return { tone: 'neutral' as const, label: 'Cancelled' }
    default:
      return { tone: 'neutral' as const, label: '—' }
  }
}

const getCadenceLabel = (cadence?: string) => {
  switch (cadence) {
    case 'WEEKLY':
      return 'Weekly check-ins'
    case 'BIWEEKLY':
      return 'Fortnightly check-ins'
    case 'MONTHLY':
      return 'Monthly check-ins'
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
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    const formattedDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    
    if (diffDays < 0) {
      return { text: `${formattedDate} • Overdue`, isOverdue: true }
    } else if (diffDays === 0) {
      return { text: `Due today (${formattedDate})`, isOverdue: false }
    } else if (diffDays === 1) {
      return { text: `Due in 1 day (${formattedDate})`, isOverdue: false }
    } else {
      return { text: `Due in ${diffDays} days (${formattedDate})`, isOverdue: false }
    }
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
    case 'CANCELLED':
      return 'bg-neutral-400'
    default:
      return 'bg-neutral-300'
  }
}

const formatProgressLabel = (kr: {
  currentValue?: number
  targetValue?: number
  unit?: string
}): string => {
  if (kr.currentValue === undefined || kr.targetValue === undefined) {
    return 'Progress not tracked'
  }
  
  const current = kr.currentValue
  const target = kr.targetValue
  const unit = kr.unit || ''
  
  if (unit.toLowerCase() === 'percentage') {
    return `${Math.round(current)}% of ${Math.round(target)}%`
  } else if (unit.toLowerCase() === 'seconds') {
    return `${Math.round(current)}s → ${Math.round(target)}s target`
  } else {
    return `${current} of ${target} ${unit}`.trim()
  }
}

const getCyclePill = (cycleLabel: string, cycleStatus: string) => {
  const baseClasses = "px-2 py-1 rounded-full text-[11px] font-medium leading-none"
  
  if (cycleStatus === "DRAFT") {
    return {
      text: cycleLabel,
      className: cn(baseClasses, "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300"),
      activeChip: null,
    }
  }
  if (cycleStatus === "ARCHIVED") {
    return {
      text: cycleLabel,
      className: cn(baseClasses, "bg-neutral-200 text-neutral-600"),
      activeChip: null,
    }
  }
  if (cycleStatus === "ACTIVE") {
    return {
      text: cycleLabel,
      className: cn(baseClasses, "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-300"),
      activeChip: { text: "Active", className: cn(baseClasses, "bg-emerald-500 text-white") },
    }
  }
  return {
    text: cycleLabel,
    className: cn(baseClasses, "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-300"),
    activeChip: null,
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const statusBadge = getStatusBadge(objective.status)
  const keyResults = objective.keyResults || []
  const initiatives = objective.initiatives || []
  const overdueCount = objective.overdueCountForObjective ?? 0
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle(objective.id)
    }
  }

  const progressBarColor = getProgressBarColor(objective.status)
  const cyclePill = getCyclePill(
    objective.cycleLabel || objective.cycleName || 'Unassigned',
    objective.cycleStatus || 'ACTIVE'
  )

  return (
    <section 
      className="border border-neutral-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200"
      aria-expanded={isExpanded}
    >
      {/* Collapsed header (always visible) */}
      <div
        className="py-3.5 px-4 cursor-pointer hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 rounded-t-xl"
        onClick={() => onToggle(objective.id)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} objective: ${objective.title}`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left block: Title, status, publication, cycle, owner */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 flex-1 min-w-0">
            {/* Title */}
            <h3 className="truncate text-[14px] font-medium text-neutral-900">
              {objective.title}
            </h3>
            
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status pill */}
              <OkrBadge tone={statusBadge.tone}>
                {statusBadge.label}
              </OkrBadge>
              
              {/* Publication/lock pill */}
              <OkrBadge tone={objective.isPublished ? 'neutral' : 'warn'}>
                {objective.isPublished ? 'Published' : 'Draft'}
              </OkrBadge>
              
              {/* Cycle pill */}
              {objective.cycleLabel && (
                <>
                  <span className={cyclePill.className}>
                    {cyclePill.text}
                  </span>
                  {cyclePill.activeChip && (
                    <span className={cyclePill.activeChip.className}>
                      {cyclePill.activeChip.text}
                    </span>
                  )}
                </>
              )}
              
              {/* Owner chip */}
              <div className="flex items-center gap-1.5">
                <AvatarCircle name={objective.owner.name} size="sm" />
                <span className="text-[11px] text-neutral-600">
                  {objective.owner.name}
                </span>
              </div>
            </div>
          </div>

          {/* Middle block: Progress bar and micro-metrics (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* Progress bar */}
            <div className="flex-1 h-1 rounded-full bg-neutral-200 overflow-hidden" style={{ height: '4px' }}>
              <motion.div
                className={cn("h-full rounded-full", progressBarColor)}
                initial={false}
                animate={{ width: `${Math.min(100, Math.max(0, objective.progress))}%` }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              />
            </div>
            
            {/* Micro-metrics pills */}
            <div className="flex items-center gap-2 text-[11px]">
              {/* Check-in discipline pill */}
              {overdueCount === 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-medium leading-none whitespace-nowrap">
                  All check-ins on time
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-medium leading-none whitespace-nowrap">
                  Overdue check-ins
                </span>
              )}
              
              {/* Update freshness pill */}
              {objective.lowestConfidence === null ? (
                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 font-medium leading-none whitespace-nowrap">
                  No recent update
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 font-medium leading-none whitespace-nowrap">
                  Updated recently
                </span>
              )}
            </div>
          </div>

          {/* Right block: Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* + KR button */}
            {onAddKeyResult && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[12px] font-medium"
                onClick={() => onAddKeyResult(objective.id, objective.title)}
                aria-label="Add Key Result"
              >
                + KR
              </Button>
            )}
            
            {/* + Initiative button */}
            {onAddInitiative && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[12px] font-medium"
                onClick={() => onAddInitiative(objective.id, objective.title)}
                aria-label="Add Initiative"
              >
                + Initiative
              </Button>
            )}
            
            {/* Edit button */}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[12px] font-medium"
                disabled={!canEdit}
                onClick={() => onEdit(objective.id)}
                aria-label="Edit objective"
              >
                Edit
              </Button>
            )}
            
            {/* Menu button */}
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="More actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              
              {/* Menu dropdown */}
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 rounded-md border bg-white shadow-lg text-[13px] z-50 min-w-[160px]">
                  {onDelete && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-neutral-100 rounded-t-md text-rose-600"
                      onClick={() => {
                        onDelete(objective.id)
                        setMenuOpen(false)
                      }}
                      disabled={!canDelete}
                    >
                      Delete Objective
                    </button>
                  )}
                  {onOpenHistory && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-neutral-100 rounded-b-md"
                      onClick={() => {
                        onOpenHistory()
                        setMenuOpen(false)
                      }}
                    >
                      View history
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Chevron */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="ml-1"
            >
              <ChevronDown className="h-5 w-5 text-neutral-400" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="overflow-hidden"
          >
            <div className="bg-neutral-50/80 border-t border-neutral-200 px-4 py-4 rounded-b-xl">
              {/* Key Results block */}
              <div className="mb-4">
                <h4 className="text-[13px] font-medium text-neutral-700 mb-2">
                  Key Results
                </h4>
                {keyResults.length > 0 ? (
                  <div className="space-y-3">
                    {keyResults.map((kr) => {
                      const krStatusBadge = getStatusBadge(kr.status || 'ON_TRACK')
                      const cadenceLabel = getCadenceLabel(kr.checkInCadence)
                      const progressLabel = formatProgressLabel(kr)
                      const krProgressBarColor = getProgressBarColor(kr.status || 'ON_TRACK')
                      
                      return (
                        <div
                          key={kr.id}
                          className="rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-2 flex-1 min-w-0">
                              {/* Title */}
                              <div className="text-[13px] text-neutral-900 font-medium">
                                {kr.title}
                              </div>
                              
                              {/* Badges row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <OkrBadge tone={krStatusBadge.tone}>
                                  {krStatusBadge.label}
                                </OkrBadge>
                                {kr.checkInCadence && kr.checkInCadence !== 'NONE' && (
                                  <OkrBadge tone="neutral">
                                    {cadenceLabel}
                                  </OkrBadge>
                                )}
                                {kr.isOverdue && (
                                  <OkrBadge tone="bad">
                                    Overdue
                                  </OkrBadge>
                                )}
                              </div>
                              
                              {/* Progress bar */}
                              {kr.progress !== undefined && (
                                <div className="w-full h-1 rounded-full bg-neutral-200 overflow-hidden">
                                  <motion.div
                                    className={cn("h-full rounded-full", krProgressBarColor)}
                                    initial={false}
                                    animate={{ width: `${Math.min(100, Math.max(0, kr.progress))}%` }}
                                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                  />
                                </div>
                              )}
                              
                              {/* Progress label */}
                              <div className="text-[12px] text-neutral-600">
                                {progressLabel}
                              </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              {onAddCheckIn && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] font-medium"
                                  onClick={() => onAddCheckIn(kr.id)}
                                >
                                  Check in
                                </Button>
                              )}
                              {onAddInitiativeToKr && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] font-medium"
                                  onClick={() => onAddInitiativeToKr(kr.id)}
                                >
                                  + Initiative
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-4 text-center">
                    <p className="text-[13px] text-neutral-600 mb-2">No Key Results yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-medium"
                      onClick={() => onAddKeyResult(objective.id, objective.title)}
                    >
                      + Add Key Result
                    </Button>
                  </div>
                )}
              </div>

              {/* Initiatives block */}
              <div className="mt-4">
                <h4 className="text-[13px] font-medium text-neutral-700 mb-2">
                  Initiatives
                </h4>
                {initiatives.length > 0 ? (
                  <div className="space-y-3">
                    {initiatives.map((init) => {
                      const initStatusBadge = getInitiativeStatusBadge(init.status)
                      const dueDateInfo = formatDueDate(init.dueDate)
                      
                      return (
                        <div
                          key={init.id}
                          className="rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              {/* Title */}
                              <div className="text-[13px] text-neutral-900 font-medium">
                                {init.title}
                              </div>
                              
                              {/* Badges row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <OkrBadge tone={initStatusBadge.tone}>
                                  {initStatusBadge.label}
                                </OkrBadge>
                                {dueDateInfo && (
                                  <span className={cn(
                                    "text-[12px]",
                                    dueDateInfo.isOverdue ? "text-rose-600" : "text-neutral-600"
                                  )}>
                                    {dueDateInfo.text}
                                  </span>
                                )}
                              </div>
                              
                              {/* Linked KR indicator */}
                              {init.keyResultId && init.keyResultTitle && (
                                <div className="text-[12px] text-neutral-500">
                                  supports: {init.keyResultTitle}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-4 text-center">
                    <p className="text-[13px] text-neutral-600 mb-2">No initiatives yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-medium"
                      onClick={() => onAddInitiative(objective.id, objective.title)}
                    >
                      + New Initiative
                    </Button>
                  </div>
                )}
                
                {/* Always show + New Initiative button at the end */}
                {initiatives.length > 0 && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-medium"
                      onClick={() => onAddInitiative(objective.id, objective.title)}
                    >
                      + New Initiative
                    </Button>
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
