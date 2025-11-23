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
      owner: obj.owner || null,
      parentId: obj.parentId || obj.parentObjectiveId || null,
      expanded: false,
      children: [],
      cycleId: obj.cycleId || null,
      cycleName: obj.cycle?.name || obj.cycleName || null,
      visibilityLevel: obj.visibilityLevel,
      isPublished: obj.isPublished,
    }

    allNodes.set(objectiveId, node)

    // Add key results as children
    if (obj.keyResults && obj.keyResults.length > 0) {
      obj.keyResults.forEach((kr) => {
        // Handle both direct KR format and nested keyResult format
        const krData = kr.keyResult || kr
        const krId = krData.id || kr.keyResultId || kr.id || `kr-${objectiveId}-${krData.title || kr.title}`
        const krTitle = krData.title || kr.title
        const krStatus = krData.status || kr.status
        const krProgress = krData.progress ?? kr.progress ?? 0
        const krOwnerId = krData.ownerId || kr.ownerId
        const krOwner = krData.owner || kr.owner || null

        const krNode: HierarchyOKRNode = {
          id: krId,
          type: 'keyResult',
          title: krTitle,
          status: krStatus as HierarchyOKRNode['status'],
          progress: krProgress,
          ownerId: krOwnerId,
          owner: krOwner,
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

