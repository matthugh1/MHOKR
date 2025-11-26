/**
 * Hook for fetching and managing hierarchical OKR data
 * Implements expand-on-demand loading: initial load fetches only root objectives,
 * child objectives are loaded when nodes are expanded.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'
import { transformToHierarchy } from '../components/utils/transformToHierarchy'
import { HierarchyTreeData, HierarchyOKRNode } from '../components/types'

interface UseHierarchyOKRsParams {
  tenantId: string | null
  cycleId: string | null
  status?: string | null
  scope?: 'my' | 'team-workspace' | 'tenant'
  searchQuery?: string
  enabled?: boolean
  page?: number
  pageSize?: number
}

interface UseHierarchyOKRsReturn {
  treeData: HierarchyTreeData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  loadChildren: (nodeId: string) => Promise<void>
  loadingNodeIds: Set<string>
  pagination: {
    currentPage: number
    totalCount: number
    pageSize: number
    totalPages: number
  }
}

export function useHierarchyOKRs({
  tenantId,
  cycleId,
  status,
  scope,
  searchQuery,
  enabled = true,
  page = 1,
  pageSize = 20,
}: UseHierarchyOKRsParams): UseHierarchyOKRsReturn {
  const [treeData, setTreeData] = useState<HierarchyTreeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(new Set())
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(page)
  
  // Track which nodes have had their children loaded
  const loadedNodeIdsRef = useRef<Set<string>>(new Set())

  // Fetch root objectives only (parentId is null)
  const fetchRootObjectives = useCallback(async (pageNum: number = 1) => {
    if (!enabled || !tenantId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        tenantId,
        page: pageNum.toString(),
        pageSize: pageSize.toString(),
      })

      // Don't use hierarchyView=true as it bypasses pagination
      // We'll fetch paginated results and filter for root objectives client-side
      
      if (cycleId) {
        params.set('cycleId', cycleId)
      }

      if (status) {
        params.set('status', status)
      }

      if (scope) {
        params.set('scope', scope)
      }

      if (searchQuery) {
        params.set('search', searchQuery)
      }

      const response = await api.get(`/okr/overview?${params.toString()}`)
      const envelope = response.data || {}
      const objectives = envelope.objectives || []

      // Filter to only root objectives (parentId is null or undefined)
      const rootObjectives = objectives.filter((obj: any) => !obj.parentId && !obj.parentObjectiveId)
      
      // Calculate total count of root objectives
      // Since we're filtering client-side, we need to estimate
      // If we got a full page of root objectives, there might be more
      // For now, use a simple heuristic: if we got pageSize root objectives, assume there are more
      if (rootObjectives.length === pageSize && objectives.length === pageSize) {
        // Got a full page, estimate there are more root objectives
        // Use a conservative estimate: assume at least 2 pages worth
        setTotalCount(Math.max(rootObjectives.length * 2, envelope.totalCount || 0))
      } else {
        // Got fewer than pageSize, this is likely all root objectives
        setTotalCount(rootObjectives.length)
      }
      
      setCurrentPage(pageNum)

      // Transform root objectives to hierarchical structure
      const transformed = transformToHierarchy(rootObjectives)
      setTreeData(transformed)
    } catch (err: any) {
      console.error('[useHierarchyOKRs] Failed to fetch root OKRs:', err)
      if (err.response?.status === 403) {
        setError('You do not have permission to view OKRs. Please contact your administrator.')
      } else if (err.response?.status === 404) {
        setError('OKR service not found. Please check that the API gateway is running.')
      } else {
        setError(err.response?.data?.message || 'Failed to load OKRs. Please try again later.')
      }
      setTreeData(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, cycleId, status, scope, searchQuery, enabled, pageSize])

  // Load children of a specific objective
  const loadChildren = useCallback(async (nodeId: string) => {
    if (!enabled || !tenantId || loadedNodeIdsRef.current.has(nodeId)) {
      return // Already loaded or disabled
    }

    try {
      setLoadingNodeIds(prev => new Set(prev).add(nodeId))

      const params = new URLSearchParams({
        tenantId,
        page: '1',
        pageSize: '50', // Load a reasonable batch size
      })

      // Apply same filters as root fetch
      if (cycleId) {
        params.set('cycleId', cycleId)
      }

      if (status) {
        params.set('status', status)
      }

      if (scope) {
        params.set('scope', scope)
      }

      const response = await api.get(`/okr/overview?${params.toString()}`)
      const envelope = response.data || {}
      const allObjectives = envelope.objectives || []

      // Filter to only children of this node (client-side filter since backend doesn't expose parentId query param)
      const children = allObjectives.filter((obj: any) => 
        (obj.parentId === nodeId || obj.parentObjectiveId === nodeId)
      )

      if (children.length === 0) {
        // No children found, mark as loaded anyway
        loadedNodeIdsRef.current.add(nodeId)
        setLoadingNodeIds(prev => {
          const next = new Set(prev)
          next.delete(nodeId)
          return next
        })
        return
      }

      // Merge children into existing tree structure
      setTreeData(prev => {
        if (!prev) return null

        const newAllNodes = new Map(prev.allNodes)
        const findAndUpdateNode = (nodes: HierarchyOKRNode[]): HierarchyOKRNode[] => {
          return nodes.map(node => {
            if (node.id === nodeId) {
              // Transform children and add them to this node
              const childNodes = children.map((child: any) => {
                const childNode: HierarchyOKRNode = {
                  id: child.objectiveId || child.id,
                  type: 'objective',
                  title: child.title,
                  status: child.status as HierarchyOKRNode['status'],
                  progress: child.progress,
                  ownerId: child.ownerId,
                  owner: child.owner || undefined,
                  parentId: nodeId,
                  expanded: false,
                  children: [],
                  cycleId: child.cycleId || child.cycle?.id || null,
                  cycleName: child.cycle?.name || child.cycleName || null,
                  visibilityLevel: child.visibilityLevel,
                  isPublished: child.isPublished,
                  workspaceId: child.workspaceId || null,
                  teamId: child.teamId || null,
                  pillarId: child.pillarId || null,
                }

                // Add key results as children of this child objective
                if (child.keyResults && child.keyResults.length > 0) {
                  child.keyResults.forEach((kr: any) => {
                    const krData = kr.keyResult || kr
                    const krId = krData.id || kr.keyResultId || kr.id || `kr-${childNode.id}-${krData.title || kr.title}`
                    const krNode: HierarchyOKRNode = {
                      id: krId,
                      type: 'keyResult',
                      title: krData.title || kr.title,
                      status: krData.status || kr.status,
                      progress: krData.progress ?? kr.progress ?? 0,
                      ownerId: krData.ownerId || kr.ownerId,
                      owner: krData.owner || kr.owner || undefined,
                      parentId: childNode.id,
                      expanded: false,
                      children: [],
                      currentValue: krData.currentValue ?? kr.currentValue ?? null,
                      targetValue: krData.targetValue ?? kr.targetValue ?? null,
                      startValue: krData.startValue ?? kr.startValue ?? null,
                      unit: krData.unit || kr.unit || null,
                      keyResultId: krId,
                      objectiveId: childNode.id,
                    }
                    newAllNodes.set(krId, krNode)
                    childNode.children.push(krNode)
                  })
                }

                newAllNodes.set(childNode.id, childNode)
                return childNode
              })

              return {
                ...node,
                children: [...node.children, ...childNodes],
              }
            }
            return {
              ...node,
              children: findAndUpdateNode(node.children),
            }
          })
        }

        const updatedRoots = findAndUpdateNode(prev.roots)

        return {
          roots: updatedRoots,
          allNodes: newAllNodes,
        }
      })

      // Mark this node as loaded
      loadedNodeIdsRef.current.add(nodeId)
    } catch (err: any) {
      console.error(`[useHierarchyOKRs] Failed to load children for ${nodeId}:`, err)
    } finally {
      setLoadingNodeIds(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    }
  }, [tenantId, cycleId, status, scope, enabled])

  // Initial fetch of root objectives
  useEffect(() => {
    // Reset to page 1 when filters change (but not when just page changes)
    if (currentPage === 1 || page === 1) {
      loadedNodeIdsRef.current.clear()
    }
    fetchRootObjectives(currentPage)
  }, [fetchRootObjectives, currentPage, tenantId, cycleId, status, scope, searchQuery])

  // Update current page when prop changes
  useEffect(() => {
    setCurrentPage(page)
  }, [page])

  return {
    treeData,
    loading,
    error,
    refetch: () => fetchRootObjectives(currentPage),
    loadChildren,
    loadingNodeIds,
    pagination: {
      currentPage,
      totalCount,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  }
}

