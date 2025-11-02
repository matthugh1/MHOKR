'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ObjectiveRow } from '@/components/okr/ObjectiveRow'
import { cn } from '@/lib/utils'

interface PreparedObjective {
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
  canEdit: boolean
  canDelete: boolean
  canEditKeyResult?: (krId: string) => boolean
  canCheckInOnKeyResult?: (krId: string) => boolean
  objectiveForHook: any
}

interface OKRListVirtualisedProps {
  objectives: PreparedObjective[]
  expandedObjectiveId: string | null
  onToggleObjective: (id: string) => void
  onAction: {
    onEdit: (okr: any) => void
    onDelete: (okr: any) => void
    onAddKeyResult: (objectiveId: string, objectiveName: string) => void
    onAddInitiativeToObjective: (objectiveId: string, objectiveName: string) => void
    onAddInitiativeToKr: (krId: string, krTitle: string) => void
    onAddCheckIn: (krId: string) => void
    onOpenHistory: (entityType: 'OBJECTIVE' | 'KEY_RESULT', entityId: string, entityTitle?: string) => void
  }
  availableUsers?: Array<{ id: string; name: string; email?: string }>
}

const ROW_HEIGHT_ESTIMATE = 120
const BUFFER_ROWS = 2

export function OKRListVirtualised({
  objectives,
  expandedObjectiveId,
  onToggleObjective,
  onAction,
  availableUsers = [],
}: OKRListVirtualisedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const updateDimensions = () => {
      if (container) {
        setContainerHeight(container.clientHeight || 600)
      }
    }
    
    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)
    
    return () => {
      resizeObserver.disconnect()
    }
  }, [])
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleScroll = () => {
      setScrollTop(container.scrollTop)
    }
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])
  
  const visibleRange = useMemo(() => {
    if (objectives.length === 0) return { startIndex: 0, endIndex: 0 }
    
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_ESTIMATE) - BUFFER_ROWS)
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT_ESTIMATE)
    const endIndex = Math.min(
      objectives.length,
      startIndex + visibleCount + BUFFER_ROWS * 2
    )
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, objectives.length])
  
  const visibleObjectives = useMemo(() => {
    return objectives.slice(visibleRange.startIndex, visibleRange.endIndex)
  }, [objectives, visibleRange])
  
  const totalHeight = objectives.length * ROW_HEIGHT_ESTIMATE
  const offsetY = visibleRange.startIndex * ROW_HEIGHT_ESTIMATE
  
  const renderObjectiveRow = (objective: PreparedObjective) => {
    return (
      <ObjectiveRow
        key={objective.id}
        objective={{
          id: objective.id,
          title: objective.title,
          status: objective.status,
          progress: Math.round(objective.progress),
          isPublished: objective.isPublished,
          cycleName: objective.cycleName,
          cycleLabel: objective.cycleLabel,
          cycleStatus: objective.cycleStatus,
          visibilityLevel: objective.visibilityLevel,
          owner: objective.owner,
          overdueCountForObjective: objective.overdueCountForObjective,
          lowestConfidence: objective.lowestConfidence,
          keyResults: objective.keyResults || [],
          initiatives: objective.initiatives || [],
        }}
        isExpanded={expandedObjectiveId === objective.id}
        onToggle={onToggleObjective}
        onAddKeyResult={onAction.onAddKeyResult}
        onAddInitiative={onAction.onAddInitiativeToObjective}
        onEdit={() => onAction.onEdit(objective)}
        onDelete={() => onAction.onDelete(objective)}
        onOpenHistory={() => onAction.onOpenHistory('OBJECTIVE', objective.id, objective.title)}
        onAddInitiativeToKr={(krId) => {
          const kr = objective.keyResults?.find((k) => k.id === krId)
          if (kr) onAction.onAddInitiativeToKr(krId, kr.title)
        }}
        onAddCheckIn={onAction.onAddCheckIn}
        canEdit={objective.canEdit}
        canDelete={objective.canDelete}
        canEditKeyResult={objective.canEditKeyResult}
        canCheckInOnKeyResult={objective.canCheckInOnKeyResult}
        availableUsers={availableUsers}
      />
    )
  }
  
  if (objectives.length === 0) {
    return null
  }
  
  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-y-auto"
      style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '400px' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          <div className="space-y-4 md:space-y-6">
            {visibleObjectives.map((objective) => renderObjectiveRow(objective))}
          </div>
        </div>
      </div>
    </div>
  )
}

