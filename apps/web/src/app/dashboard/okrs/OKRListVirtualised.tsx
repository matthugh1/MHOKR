'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ObjectiveRow } from '@/components/okr/ObjectiveRow'
import { cn } from '@/lib/utils'

interface PreparedObjective {
  id: string
  title: string
  status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
  publishState?: 'PUBLISHED' | 'DRAFT' // W4.M1: New field
  progress: number
  isPublished: boolean // W4.M1: Kept for backward compatibility
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
    onAddInitiativeToKr: (krId: string, krTitle: string, objectiveId: string) => void
    onAddCheckIn: (krId: string) => void
    onOpenHistory: (entityType: 'OBJECTIVE' | 'KEY_RESULT', entityId: string, entityTitle?: string) => void
    onEditKeyResult?: (krId: string) => void
    // Story 5: Contextual Add menu handlers
    onOpenContextualAddMenu?: (objectiveId: string) => void
    onContextualAddKeyResult?: (objectiveId: string, objectiveTitle: string) => void
    onContextualAddInitiative?: (objectiveId: string, objectiveTitle: string) => void
  }
  availableUsers?: Array<{ id: string; name: string; email?: string }>
}

const ROW_HEIGHT_ESTIMATE = 120
const EXPANDED_ROW_BASE_HEIGHT = 200 // Base height for expanded row (header + padding)
const KEY_RESULT_HEIGHT_ESTIMATE = 120 // Height per Key Result
const INITIATIVE_HEIGHT_ESTIMATE = 90 // Height per Initiative
const SECTION_SPACING = 40 // Spacing between sections
const BUFFER_ROWS = 2

// Calculate dynamic height for expanded rows based on content
function calculateExpandedRowHeight(objective: PreparedObjective): number {
  const krCount = objective.keyResults?.length || 0
  const initiativeCount = objective.initiatives?.length || 0
  
  // Base height + Key Results section + Initiatives section + spacing
  let height = EXPANDED_ROW_BASE_HEIGHT
  
  if (krCount > 0) {
    height += SECTION_SPACING + (krCount * KEY_RESULT_HEIGHT_ESTIMATE)
  }
  
  if (initiativeCount > 0) {
    height += SECTION_SPACING + (initiativeCount * INITIATIVE_HEIGHT_ESTIMATE)
  }
  
  // Add extra padding for "Add" buttons if sections exist
  if (krCount > 0 || initiativeCount > 0) {
    height += SECTION_SPACING
  }
  
  // Ensure minimum height
  return Math.max(height, 400)
}

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
    
    // Calculate cumulative heights to find which rows are visible
    let cumulativeHeight = 0
    let startIndex = 0
    let endIndex = objectives.length
    
    // Find startIndex by finding where scrollTop falls
    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i]
      const isExpanded = expandedObjectiveId === obj.id
      const rowHeight = isExpanded ? calculateExpandedRowHeight(obj) : ROW_HEIGHT_ESTIMATE
      
      if (cumulativeHeight + rowHeight > scrollTop) {
        startIndex = Math.max(0, i - BUFFER_ROWS)
        break
      }
      cumulativeHeight += rowHeight
    }
    
    // Find endIndex by finding how many rows fit in containerHeight
    let visibleHeight = 0
    for (let i = startIndex; i < objectives.length; i++) {
      const obj = objectives[i]
      const isExpanded = expandedObjectiveId === obj.id
      const rowHeight = isExpanded ? calculateExpandedRowHeight(obj) : ROW_HEIGHT_ESTIMATE
      
      if (visibleHeight + rowHeight > containerHeight + (BUFFER_ROWS * ROW_HEIGHT_ESTIMATE * 2)) {
        endIndex = Math.min(objectives.length, i + BUFFER_ROWS)
        break
      }
      visibleHeight += rowHeight
    }
    
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, objectives, expandedObjectiveId])
  
  const visibleObjectives = useMemo(() => {
    return objectives.slice(visibleRange.startIndex, visibleRange.endIndex)
  }, [objectives, visibleRange])
  
  // Calculate total height accounting for expanded rows with dynamic height calculation
  const totalHeight = useMemo(() => {
    return objectives.reduce((sum, obj) => {
      const isExpanded = expandedObjectiveId === obj.id
      return sum + (isExpanded ? calculateExpandedRowHeight(obj) : ROW_HEIGHT_ESTIMATE)
    }, 0)
  }, [objectives, expandedObjectiveId])
  
  // Calculate offset accounting for expanded rows before the visible range
  const offsetY = useMemo(() => {
    let offset = 0
    for (let i = 0; i < visibleRange.startIndex; i++) {
      const obj = objectives[i]
      const isExpanded = expandedObjectiveId === obj.id
      offset += isExpanded ? calculateExpandedRowHeight(obj) : ROW_HEIGHT_ESTIMATE
    }
    return offset
  }, [objectives, visibleRange.startIndex, expandedObjectiveId])
  
  const renderObjectiveRow = (objective: PreparedObjective) => {
    return (
      <ObjectiveRow
        key={objective.id}
        objective={{
          id: objective.id,
          title: objective.title,
          status: objective.status,
          publishState: objective.publishState, // W4.M1: Pass publishState
          progress: Math.round(objective.progress),
          isPublished: objective.isPublished,
          cycleName: objective.cycleName,
          cycleLabel: objective.cycleLabel,
          cycleStatus: objective.cycleStatus,
          visibilityLevel: objective.visibilityLevel,
          ownerId: objective.ownerId,
          organizationId: objective.organizationId,
          workspaceId: objective.workspaceId,
          teamId: objective.teamId,
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
          if (kr) onAction.onAddInitiativeToKr(krId, kr.title, objective.id)
        }}
        onAddCheckIn={onAction.onAddCheckIn}
        onEditKeyResult={onAction.onEditKeyResult}
        canEdit={objective.canEdit}
        canDelete={objective.canDelete}
        canEditKeyResult={objective.canEditKeyResult}
        canCheckInOnKeyResult={objective.canCheckInOnKeyResult}
        // Story 5: RBAC-aware permissions for contextual Add menu
        canCreateKeyResult={objective.canEdit} // Can create KR if can edit objective
        canCreateInitiative={objective.canEdit} // Can create Initiative if can edit objective
        onOpenContextualAddMenu={() => onAction.onOpenContextualAddMenu?.(objective.id)}
        onContextualAddKeyResult={(objectiveId, objectiveTitle) => {
          onAction.onContextualAddKeyResult?.(objectiveId, objectiveTitle)
        }}
        onContextualAddInitiative={(objectiveId, objectiveTitle) => {
          onAction.onContextualAddInitiative?.(objectiveId, objectiveTitle)
        }}
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

