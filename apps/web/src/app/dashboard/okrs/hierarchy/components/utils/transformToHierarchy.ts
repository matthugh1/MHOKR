/**
 * Transform flat API response to hierarchical tree structure
 */

import { HierarchyOKRNode, HierarchyTreeData } from '../types'

interface APIObjective {
  objectiveId?: string
  id?: string
  title: string
  status: string
  progress: number
  ownerId: string
  owner?: {
    id: string
    name: string
    email?: string | null
  } | null
  parentId?: string | null
  parentObjectiveId?: string | null
  cycleId?: string | null
  cycle?: {
    id: string
    name: string
    status: string
  } | null
  cycleName?: string
  visibilityLevel?: string
  isPublished?: boolean
  pillarId?: string | null
  pillar?: {
    id: string
    name: string
    color?: string | null
  } | null
  workspaceId?: string | null
  teamId?: string | null
  keyResults?: Array<{
    id?: string
    keyResultId?: string
    title: string
    status: string
    progress: number
    currentValue?: number | null
    targetValue?: number | null
    startValue?: number | null
    unit?: string | null
    ownerId: string
    owner?: {
      id: string
      name: string
      email?: string | null
    } | null
    keyResult?: {
      id: string
      title: string
      status: string
      progress: number
      currentValue?: number | null
      targetValue?: number | null
      startValue?: number | null
      unit?: string | null
      ownerId: string
      owner?: {
        id: string
        name: string
        email?: string | null
      } | null
    }
  }>
  initiatives?: Array<{
    id: string
    title: string
    status: string
    progress: number
    ownerId: string
    owner?: {
      id: string
      name: string
      email?: string | null
    } | null
    objectiveId?: string | null
    keyResultId?: string | null
    description?: string | null
    dueDate?: string | null
  }>
}

/**
 * Transform flat API objectives array into hierarchical tree structure
 */
export function transformToHierarchy(objectives: APIObjective[]): HierarchyTreeData {
  const allNodes = new Map<string, HierarchyOKRNode>()
  const roots: HierarchyOKRNode[] = []

  // First pass: Create all objective nodes
  objectives.forEach((obj) => {
    const objectiveId = obj.objectiveId || obj.id
    if (!objectiveId) {
      console.warn('[transformToHierarchy] Objective missing ID:', obj)
      return
    }

    const node: HierarchyOKRNode = {
      id: objectiveId,
      type: 'objective',
      title: obj.title,
      status: obj.status as HierarchyOKRNode['status'],
      progress: obj.progress,
      ownerId: obj.ownerId,
      owner: obj.owner || undefined,
      parentId: obj.parentId || obj.parentObjectiveId || null,
      expanded: false,
      children: [],
      // Use cycleId directly, or fall back to cycle.id if cycleId is missing
      cycleId: obj.cycleId || obj.cycle?.id || null,
      cycleName: obj.cycle?.name || obj.cycleName || null,
      visibilityLevel: obj.visibilityLevel,
      isPublished: obj.isPublished,
      // Extract pillarId from direct field or pillar relation
      pillarId: obj.pillarId || obj.pillar?.id || null,
      workspaceId: obj.workspaceId || null,
      teamId: obj.teamId || null,
    }

    allNodes.set(objectiveId, node)

    // Debug: Log first objective's structure
    if (objectives.indexOf(obj) === 0) {
      console.log('[transformToHierarchy] First objective structure:', {
        id: objectiveId,
        title: obj.title,
        hasKeyResults: !!obj.keyResults,
        keyResultsLength: obj.keyResults?.length || 0,
        keyResultsSample: obj.keyResults?.[0] ? {
          keys: Object.keys(obj.keyResults[0]),
          hasKeyResult: !!obj.keyResults[0].keyResult,
          hasKeyResultId: !!obj.keyResults[0].keyResultId,
          hasId: !!obj.keyResults[0].id,
          hasTitle: !!obj.keyResults[0].title,
          sample: obj.keyResults[0],
        } : null,
      })
    }

    // Add key results as children
    if (obj.keyResults && obj.keyResults.length > 0) {
      console.log(`[transformToHierarchy] Processing ${obj.keyResults.length} Key Results for objective ${objectiveId}`)
      obj.keyResults.forEach((kr, idx) => {
        // Handle both direct KR format and nested keyResult format
        const krData = kr.keyResult || kr
        const krId = krData.id || kr.keyResultId || kr.id || `kr-${objectiveId}-${krData.title || kr.title}`
        const krTitle = krData.title || kr.title
        const krStatus = krData.status || kr.status
        const krProgress = krData.progress ?? kr.progress ?? 0
        const krOwnerId = krData.ownerId || kr.ownerId
        const krOwner = krData.owner || kr.owner || null

        if (idx === 0) {
          console.log(`[transformToHierarchy] First KR sample:`, {
            krId,
            krTitle,
            krStatus,
            krDataKeys: Object.keys(krData),
            krKeys: Object.keys(kr),
          })
        }

        const krNode: HierarchyOKRNode = {
          id: krId,
          type: 'keyResult',
          title: krTitle,
          status: krStatus as HierarchyOKRNode['status'],
          progress: krProgress,
          ownerId: krOwnerId,
          owner: krOwner || undefined,
          parentId: objectiveId,
          expanded: false,
          children: [],
          currentValue: krData.currentValue ?? kr.currentValue ?? null,
          targetValue: krData.targetValue ?? kr.targetValue ?? null,
          startValue: krData.startValue ?? kr.startValue ?? null,
          unit: krData.unit || kr.unit || null,
          keyResultId: krId,
          objectiveId: objectiveId,
        }

        allNodes.set(krId, krNode)
        node.children.push(krNode)
      })
      console.log(`[transformToHierarchy] Added ${node.children.length} Key Results to objective ${objectiveId}`)
    } else {
      console.log(`[transformToHierarchy] No Key Results found for objective ${objectiveId}`)
    }

    // Add initiatives as children - can be linked to objective or key results
    console.log(`[transformToHierarchy] Checking initiatives for objective ${objectiveId}:`, {
      hasInitiatives: !!obj.initiatives,
      initiativesType: typeof obj.initiatives,
      isArray: Array.isArray(obj.initiatives),
      length: obj.initiatives?.length || 0,
      sample: obj.initiatives?.[0] ? {
        keys: Object.keys(obj.initiatives[0]),
        id: obj.initiatives[0].id,
        title: obj.initiatives[0].title,
        objectiveId: obj.initiatives[0].objectiveId,
        keyResultId: obj.initiatives[0].keyResultId,
      } : null,
    })
    
    if (obj.initiatives && obj.initiatives.length > 0) {
      console.log(`[transformToHierarchy] Processing ${obj.initiatives.length} Initiatives for objective ${objectiveId}`)
      
      // First, collect initiatives linked to Key Results
      const initiativesByKR = new Map<string, typeof obj.initiatives>()
      const objectiveInitiatives: typeof obj.initiatives = []
      
      obj.initiatives.forEach((initiative) => {
        if (initiative.keyResultId) {
          // Initiative is linked to a Key Result
          if (!initiativesByKR.has(initiative.keyResultId)) {
            initiativesByKR.set(initiative.keyResultId, [])
          }
          initiativesByKR.get(initiative.keyResultId)!.push(initiative)
        } else {
          // Initiative is linked to the objective
          objectiveInitiatives.push(initiative)
        }
      })

      // Add initiatives linked to Key Results as children of those KRs
      initiativesByKR.forEach((initiatives, krId) => {
        const krNode = allNodes.get(krId)
        if (krNode) {
          initiatives.forEach((initiative) => {
            const initiativeId = initiative.id
            if (!initiativeId) {
              console.warn('[transformToHierarchy] Initiative missing ID:', initiative)
              return
            }

            const initiativeNode: HierarchyOKRNode = {
              id: initiativeId,
              type: 'initiative',
              title: initiative.title,
              status: initiative.status as HierarchyOKRNode['status'],
              progress: initiative.progress ?? 0,
              ownerId: initiative.ownerId,
              owner: initiative.owner || undefined,
              parentId: krId,
              expanded: false,
              children: [],
              keyResultId: krId,
              objectiveId: objectiveId,
              initiativeId: initiativeId,
            }

            allNodes.set(initiativeId, initiativeNode)
            krNode.children.push(initiativeNode)
          })
        }
      })

      // Add initiatives linked directly to the objective
      objectiveInitiatives.forEach((initiative) => {
        const initiativeId = initiative.id
        if (!initiativeId) {
          console.warn('[transformToHierarchy] Initiative missing ID:', initiative)
          return
        }

        const initiativeNode: HierarchyOKRNode = {
          id: initiativeId,
          type: 'initiative',
          title: initiative.title,
          status: initiative.status as HierarchyOKRNode['status'],
          progress: initiative.progress ?? 0,
          ownerId: initiative.ownerId,
          owner: initiative.owner || undefined,
          parentId: objectiveId,
          expanded: false,
          children: [],
          objectiveId: objectiveId,
          initiativeId: initiativeId,
        }

        allNodes.set(initiativeId, initiativeNode)
        node.children.push(initiativeNode)
      })
      
      console.log(`[transformToHierarchy] Added ${objectiveInitiatives.length} Initiatives to objective ${objectiveId}, ${initiativesByKR.size} KRs have initiatives`)
    } else {
      console.log(`[transformToHierarchy] No Initiatives found for objective ${objectiveId}`)
    }
  })

  // Second pass: Build parent-child relationships for objectives
  allNodes.forEach((node) => {
    if (node.type === 'objective' && node.parentId) {
      const parent = allNodes.get(node.parentId)
      if (parent && parent.type === 'objective') {
        parent.children.push(node)
      }
    } else if (node.type === 'objective' && !node.parentId) {
      roots.push(node)
    }
  })

  // Sort roots and children by title for consistent display
  const sortNodes = (nodes: HierarchyOKRNode[]): HierarchyOKRNode[] => {
    return nodes
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }))
  }

  return {
    roots: sortNodes(roots),
    allNodes,
  }
}

/**
 * Find a node in the hierarchy by ID
 */
export function findNodeById(
  nodes: HierarchyOKRNode[],
  id: string
): HierarchyOKRNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    const found = findNodeById(node.children, id)
    if (found) {
      return found
    }
  }
  return null
}

/**
 * Get the path from root to a node (for breadcrumbs)
 */
export function getNodePath(
  nodes: HierarchyOKRNode[],
  targetId: string,
  path: HierarchyOKRNode[] = []
): HierarchyOKRNode[] | null {
  for (const node of nodes) {
    const currentPath = [...path, node]
    if (node.id === targetId) {
      return currentPath
    }
    const found = getNodePath(node.children, targetId, currentPath)
    if (found) {
      return found
    }
  }
  return null
}

