'use client'

import React, { useState, useMemo } from 'react'
import { ObjectiveRow } from '@/components/okr/ObjectiveRow'
import { Target, BarChart3, Rocket, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface PreparedObjective {
  id: string
  title: string
  status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'NOT_STARTED'
  publishState?: 'PUBLISHED' | 'DRAFT'
  progress: number
  isPublished: boolean
  cycleName?: string
  cycleLabel?: string
  cycleStatus?: string
  visibilityLevel?: string
  parentId?: string | null
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
  ownerId?: string
  organizationId?: string
  workspaceId?: string
  teamId?: string
}

interface HierarchyNode {
  objective: PreparedObjective
  children: HierarchyNode[]
  level: number
}

interface OKRHierarchyListProps {
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
    onOpenContextualAddMenu?: (objectiveId: string) => void
    onContextualAddKeyResult?: (objectiveId: string, objectiveTitle: string) => void
    onContextualAddInitiative?: (objectiveId: string, objectiveTitle: string) => void
  }
  availableUsers?: Array<{ id: string; name: string; email?: string }>
}

// Build hierarchy tree from flat objectives list
function buildHierarchy(objectives: PreparedObjective[]): HierarchyNode[] {
  const objectiveMap = new Map<string, PreparedObjective>()
  const rootNodes: HierarchyNode[] = []
  
  // First pass: create map of all objectives
  objectives.forEach(obj => {
    objectiveMap.set(obj.id, obj)
  })
  
  // Second pass: build tree structure
  const nodeMap = new Map<string, HierarchyNode>()
  
  objectives.forEach(obj => {
    const node: HierarchyNode = {
      objective: obj,
      children: [],
      level: 0,
    }
    nodeMap.set(obj.id, node)
  })
  
  // Third pass: assign children and calculate levels
  const missingParents = new Set<string>()
  objectives.forEach(obj => {
    const node = nodeMap.get(obj.id)!
    // Check if this objective has a parent that exists in the current dataset
    // Explicitly check for null/undefined to ensure root nodes are correctly identified
    const hasParent = obj.parentId !== null && obj.parentId !== undefined && obj.parentId !== ''
    if (hasParent && nodeMap.has(obj.parentId!)) {
      const parentNode = nodeMap.get(obj.parentId!)!
      parentNode.children.push(node)
    } else if (hasParent) {
      // Parent not in dataset - log warning but treat as root node
      missingParents.add(obj.parentId!)
      console.warn(`[OKRHierarchyList] Objective "${obj.title.substring(0, 50)}" has parentId ${obj.parentId} but parent not found in dataset. Treating as root node.`)
      rootNodes.push(node)
    } else {
      // No parent = root node
      rootNodes.push(node)
    }
  })
  
  // Log summary of missing parents
  if (missingParents.size > 0) {
    console.warn(`[OKRHierarchyList] Found ${missingParents.size} objectives with missing parents. These will appear as root nodes. Missing parent IDs:`, Array.from(missingParents))
  }
  
  // Calculate levels recursively
  function setLevels(nodes: HierarchyNode[], level: number) {
    nodes.forEach(node => {
      node.level = level
      setLevels(node.children, level + 1)
    })
  }
  
  setLevels(rootNodes, 0)
  
  // Sort hierarchy: root nodes by title, then recursively sort children
  function sortNodes(nodes: HierarchyNode[]): void {
    // All nodes in rootNodes are already root nodes, just sort by title
    nodes.sort((a, b) => {
      return a.objective.title.localeCompare(b.objective.title)
    })
    
    // Recursively sort children to maintain hierarchy order
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortNodes(node.children)
      }
    })
  }
  
  // Sort root nodes and their children
  sortNodes(rootNodes)
  
  return rootNodes
}

// Flatten hierarchy for rendering (respecting expand/collapse)
function flattenHierarchy(
  nodes: HierarchyNode[],
  expandedIds: Set<string>,
  result: Array<{ node: HierarchyNode; isChild: boolean; isLastChild: boolean; parentHasMoreSiblings: boolean }> = [],
  parentHasMoreSiblings: boolean = false
): Array<{ node: HierarchyNode; isChild: boolean; isLastChild: boolean; parentHasMoreSiblings: boolean }> {
  nodes.forEach((node, index) => {
    const isChild = node.level > 0
    const isLastChild = index === nodes.length - 1
    result.push({ node, isChild, isLastChild, parentHasMoreSiblings })
    
    // If expanded or is root level, show children
    if (expandedIds.has(node.objective.id) || node.level === 0) {
      flattenHierarchy(node.children, expandedIds, result, !isLastChild)
    }
  })
  
  return result
}

export function OKRHierarchyList({
  objectives,
  expandedObjectiveId,
  onToggleObjective,
  onAction,
  availableUsers = [],
}: OKRHierarchyListProps) {
  // Track which objectives are expanded (for showing children)
  // Initialize with all root nodes expanded by default so hierarchy is visible
  const [expandedHierarchyIds, setExpandedHierarchyIds] = useState<Set<string>>(() => {
    const rootIds = new Set<string>()
    objectives.forEach(obj => {
      // Explicitly check for null or undefined parentId
      if (obj.parentId === null || obj.parentId === undefined) {
        rootIds.add(obj.id)
      }
      })
      return rootIds
  })
  
  // Build hierarchy tree
  const hierarchy = useMemo(() => {
    return buildHierarchy(objectives)
  }, [objectives])
  
  // Update expandedHierarchyIds when objectives change (to include new root nodes)
  React.useEffect(() => {
    setExpandedHierarchyIds(prev => {
      const updated = new Set(prev)
      objectives.forEach(obj => {
        // Explicitly check for null or undefined parentId
        if ((obj.parentId === null || obj.parentId === undefined) && !updated.has(obj.id)) {
          updated.add(obj.id)
        }
      })
      return updated
    })
  }, [objectives])
  
  // Flatten hierarchy for rendering
  const flattenedList = useMemo(() => {
    return flattenHierarchy(hierarchy, expandedHierarchyIds)
  }, [hierarchy, expandedHierarchyIds])
  
  // Toggle hierarchy expansion (for showing/hiding children)
  const toggleHierarchyExpansion = (objectiveId: string) => {
    setExpandedHierarchyIds(prev => {
      const next = new Set(prev)
      if (next.has(objectiveId)) {
        next.delete(objectiveId)
      } else {
        next.add(objectiveId)
      }
      return next
    })
  }
  
  // Count children (objectives, KRs, initiatives)
  const getChildCounts = (node: HierarchyNode) => {
    const childObjectives = node.children.length
    const krs = node.objective.keyResults?.length || 0
    const initiatives = node.objective.initiatives?.length || 0
    return {
      objectives: childObjectives,
      keyResults: krs,
      initiatives,
      total: childObjectives + krs + initiatives,
    }
  }
  
  const renderObjectiveRow = (
    node: HierarchyNode,
    isChild: boolean,
    isLastChild: boolean = false,
    parentHasMoreSiblings: boolean = false
  ) => {
    const { objective } = node
    const isExpanded = expandedObjectiveId === objective.id
    const isHierarchyExpanded = expandedHierarchyIds.has(objective.id)
    const hasChildren = node.children.length > 0
    const childCounts = getChildCounts(node)
    const indentLevel = node.level * 24 // Increased from 20px to 24px per level
    
    return (
      <div
        key={objective.id}
        className={cn(
          "relative mb-2 group transition-all duration-200",
          "hover:translate-x-0.5", // Subtle hover shift
          isChild && "pl-8" // Increased padding for better visual separation
        )}
        style={{
          marginLeft: isChild ? `${indentLevel}px` : '0px',
        }}
      >
        {/* Tree-style connecting lines */}
        {isChild && (
          <>
            {/* Vertical line from parent */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-neutral-300"
              style={{
                left: `${indentLevel - 24}px`,
                height: isLastChild ? 'calc(50% + 12px)' : '100%', // Stop at middle if last child
              }}
            />
            {/* Horizontal line connecting to this node */}
            <div 
              className="absolute top-6 w-6 h-0.5 bg-neutral-300"
              style={{
                left: `${indentLevel - 24}px`,
              }}
            />
            {/* Continue vertical line if parent has more siblings */}
            {parentHasMoreSiblings && !isLastChild && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-neutral-300"
                style={{
                  left: `${indentLevel - 48}px`,
                }}
              />
            )}
          </>
        )}
        
        {/* Hierarchy expand/collapse button - more prominent */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleHierarchyExpansion(objective.id)
            }}
            className={cn(
              'absolute flex items-center justify-center w-6 h-6 rounded-md',
              'bg-white border shadow-sm z-20',
              'transition-all duration-200 ease-in-out',
              isHierarchyExpanded 
                ? 'border-purple-300 bg-purple-50 shadow-md scale-105' 
                : 'border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-md',
              'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1',
              'active:scale-95' // Press animation
            )}
            style={{
              left: isChild ? `${indentLevel - 20}px` : '8px',
              top: '24px',
            }}
            aria-label={isHierarchyExpanded ? 'Collapse children' : 'Expand children'}
          >
            <div
              className={cn(
                "transition-transform duration-200 ease-in-out",
                isHierarchyExpanded && "rotate-90"
              )}
            >
              {isHierarchyExpanded ? (
                <ChevronDown className="h-4 w-4 text-purple-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-neutral-600" />
              )}
            </div>
          </button>
        )}
        
        {/* Hierarchy depth indicator - show level badge for non-root objectives */}
        {node.level > 0 && (
          <div 
            className="absolute z-10 pointer-events-none"
            style={{
              left: isChild ? `${indentLevel - 12}px` : '40px',
              top: '26px',
            }}
          >
            <Badge 
              variant="outline" 
              className={cn(
                "text-[9px] px-1.5 py-0.5 h-4 font-medium shadow-sm",
                node.level === 1 && "bg-blue-50 text-blue-700 border-blue-200",
                node.level === 2 && "bg-purple-50 text-purple-700 border-purple-200",
                node.level >= 3 && "bg-neutral-50 text-neutral-600 border-neutral-200"
              )}
            >
              Level {node.level + 1}
            </Badge>
          </div>
        )}
        
        {/* Child count badge - subtle, positioned in title area */}
        {hasChildren && !isHierarchyExpanded && (
          <div 
            className="absolute z-10 pointer-events-none"
            style={{
              left: isChild ? `${indentLevel - 12}px` : '40px',
              top: node.level > 0 ? '42px' : '26px', // Adjust if depth badge is shown
            }}
          >
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-white/90 text-neutral-500 border-neutral-300 shadow-sm">
              {childCounts.objectives} {childCounts.objectives === 1 ? 'child' : 'children'}
            </Badge>
          </div>
        )}
        
        {/* Visual grouping indicator - subtle background for hierarchy levels */}
        <div 
          className={cn(
            "absolute inset-0 rounded-lg pointer-events-none -z-10 transition-all duration-200",
            "hover:opacity-100 opacity-0 group-hover:opacity-100",
            node.level === 0 && "bg-purple-50/30 border border-purple-100/50",
            node.level === 1 && "bg-blue-50/20 border border-blue-100/30",
            node.level >= 2 && "bg-neutral-50/10"
          )}
          style={{
            marginLeft: isChild ? `${indentLevel}px` : '0px',
          }}
        />
        
        <ObjectiveRow
          objective={{
            id: objective.id,
            title: objective.title,
            status: objective.status,
            publishState: objective.publishState,
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
          isExpanded={isExpanded}
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
          canCreateKeyResult={objective.canEdit}
          canCreateInitiative={objective.canEdit}
          onOpenContextualAddMenu={() => onAction.onOpenContextualAddMenu?.(objective.id)}
          onContextualAddKeyResult={(objectiveId, objectiveTitle) => {
            onAction.onContextualAddKeyResult?.(objectiveId, objectiveTitle)
          }}
          onContextualAddInitiative={(objectiveId, objectiveTitle) => {
            onAction.onContextualAddInitiative?.(objectiveId, objectiveTitle)
          }}
          availableUsers={availableUsers}
          hierarchyLevel={node.level}
          hasChildren={hasChildren}
          isHierarchyExpanded={isHierarchyExpanded}
        />
      </div>
    )
  }
  
  if (objectives.length === 0) {
    return null
  }
  
  return (
    <div className="space-y-4 md:space-y-6">
      {flattenedList.map(({ node, isChild, isLastChild, parentHasMoreSiblings }) => 
        renderObjectiveRow(node, isChild, isLastChild, parentHasMoreSiblings)
      )}
    </div>
  )
}

