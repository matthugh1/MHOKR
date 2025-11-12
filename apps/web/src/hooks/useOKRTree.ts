/**
 * Hook to map flat OKR arrays to hierarchical tree structure
 * 
 * Supports:
 * - Root Objectives (no parentObjectiveId)
 * - Child Objectives (parentObjectiveId links)
 * - Key Results (linked by objectiveId)
 * - Initiatives (linked by keyResultId or objectiveId)
 */

import { useMemo } from 'react'

export interface TreeObjective {
  id: string
  title: string
  status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
  publishState?: 'PUBLISHED' | 'DRAFT'
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
  organizationId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  parentObjectiveId?: string | null
  level?: 'Org' | 'Dept' | 'Team' | 'Personal'
  overdueCountForObjective?: number
  lowestConfidence?: number | null
  keyResults?: TreeKeyResult[]
  initiatives?: TreeInitiative[]
  children?: TreeObjective[]
  canEdit: boolean
  canDelete: boolean
  canEditKeyResult?: (krId: string) => boolean
  canCheckInOnKeyResult?: (krId: string) => boolean
  canCreateKeyResult?: boolean
  canCreateInitiative?: boolean
  objectiveForHook?: any
}

export interface TreeKeyResult {
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
  objectiveId: string
  initiatives?: TreeInitiative[]
}

export interface TreeInitiative {
  id: string
  title: string
  status?: string
  dueDate?: string
  keyResultId?: string | null
  objectiveId?: string | null
  keyResultTitle?: string | null
}

export interface OKRTreeNode {
  type: 'objective' | 'keyResult' | 'initiative'
  id: string
  data: TreeObjective | TreeKeyResult | TreeInitiative
  children?: OKRTreeNode[]
  parent?: OKRTreeNode
  level: number
}

/**
 * Determine objective level based on organizationId, workspaceId, teamId
 */
function getObjectiveLevel(objective: any): 'Org' | 'Dept' | 'Team' | 'Personal' {
  if (objective.organizationId && !objective.workspaceId && !objective.teamId) {
    return 'Org'
  }
  if (objective.workspaceId && !objective.teamId) {
    return 'Dept'
  }
  if (objective.teamId) {
    return 'Team'
  }
  return 'Personal'
}

/**
 * Map flat OKR arrays to hierarchical tree structure
 */
export function useOKRTree(objectives: TreeObjective[]): {
  rootNodes: TreeObjective[]
  nodeMap: Map<string, TreeObjective>
  getNodePath: (nodeId: string, nodeType: 'objective' | 'keyResult' | 'initiative') => Array<{ id: string; title: string; type: string }>
} {
  const treeData = useMemo(() => {
    // Create a map of all objectives by ID
    const objectiveMap = new Map<string, TreeObjective>()
    
    // First pass: create all objectives with their level and empty children arrays
    objectives.forEach(obj => {
      objectiveMap.set(obj.id, {
        ...obj,
        level: getObjectiveLevel(obj),
        children: [],
        keyResults: [],
        initiatives: [],
      })
    })
    
    // Second pass: build parent-child relationships
    objectives.forEach(obj => {
      const mappedObj = objectiveMap.get(obj.id)!
      
      // Link key results
      if (obj.keyResults && obj.keyResults.length > 0) {
        mappedObj.keyResults = obj.keyResults.map(kr => ({
          ...kr,
          objectiveId: obj.id,
          initiatives: [],
        }))
      }
      
      // Link initiatives directly to objective
      if (obj.initiatives && obj.initiatives.length > 0) {
        mappedObj.initiatives = obj.initiatives.filter(init => !init.keyResultId)
      }
      
      // Link initiatives to key results
      if (mappedObj.keyResults && obj.initiatives) {
        obj.initiatives.forEach(init => {
          if (init.keyResultId) {
            const kr = mappedObj.keyResults!.find(k => k.id === init.keyResultId)
            if (kr) {
              if (!kr.initiatives) {
                kr.initiatives = []
              }
              kr.initiatives.push(init)
            }
          }
        })
      }
      
      // Handle parent-child relationships
      // Note: parentId may not be included in API response (per requirements: don't modify backend)
      // If parentId exists in the raw data, use it; otherwise treat as root
      const parentId = (obj as any).parentId || (obj as any).parentObjectiveId
      if (parentId && objectiveMap.has(parentId)) {
        const parent = objectiveMap.get(parentId)!
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(mappedObj)
      }
    })
    
    // Find root nodes (objectives with no parent or parent not in current dataset)
    const rootNodes: TreeObjective[] = []
    objectiveMap.forEach(obj => {
      const parentId = (obj as any).parentId || (obj as any).parentObjectiveId
      // If no parentId, or parentId exists but parent is not in current dataset, treat as root
      if (!parentId || !objectiveMap.has(parentId)) {
        rootNodes.push(obj)
      }
    })
    
    // Sort root nodes for consistent display (can be customized)
    rootNodes.sort((a, b) => {
      // Sort by title for now (can be improved with priority/date sorting)
      return a.title.localeCompare(b.title)
    })
    
    return {
      rootNodes,
      nodeMap: objectiveMap,
    }
  }, [objectives])
  
  /**
   * Get the path from root to a specific node
   */
  const getNodePath = (nodeId: string, nodeType: 'objective' | 'keyResult' | 'initiative'): Array<{ id: string; title: string; type: string }> => {
    const path: Array<{ id: string; title: string; type: string }> = []
    
    if (nodeType === 'objective') {
      const obj = treeData.nodeMap.get(nodeId)
      if (!obj) return path
      
      // Build path by traversing up parent chain
      const buildPath = (current: TreeObjective): void => {
        const parentId = (current as any).parentId || (current as any).parentObjectiveId
        if (parentId && treeData.nodeMap.has(parentId)) {
          const parent = treeData.nodeMap.get(parentId)!
          buildPath(parent)
        }
        path.push({ id: current.id, title: current.title, type: 'objective' })
      }
      
      buildPath(obj)
    } else if (nodeType === 'keyResult') {
      // Find the KR and its parent objective
      treeData.nodeMap.forEach(obj => {
        const kr = obj.keyResults?.find(k => k.id === nodeId)
        if (kr) {
          // Add objective path first
          const objPath = getNodePath(obj.id, 'objective')
          path.push(...objPath)
          path.push({ id: kr.id, title: kr.title, type: 'keyResult' })
        }
      })
    } else if (nodeType === 'initiative') {
      // Find the initiative and its parent KR or objective
      treeData.nodeMap.forEach(obj => {
        // Check objective-level initiatives
        const init = obj.initiatives?.find(i => i.id === nodeId)
        if (init) {
          const objPath = getNodePath(obj.id, 'objective')
          path.push(...objPath)
          path.push({ id: init.id, title: init.title, type: 'initiative' })
          return
        }
        
        // Check KR-level initiatives
        obj.keyResults?.forEach(kr => {
          const init = kr.initiatives?.find(i => i.id === nodeId)
          if (init) {
            const objPath = getNodePath(obj.id, 'objective')
            path.push(...objPath)
            path.push({ id: kr.id, title: kr.title, type: 'keyResult' })
            path.push({ id: init.id, title: init.title, type: 'initiative' })
          }
        })
      })
    }
    
    return path
  }
  
  return {
    rootNodes: treeData.rootNodes,
    nodeMap: treeData.nodeMap,
    getNodePath,
  }
}
