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
  sortBy?: 'title-asc' | 'title-desc' | 'none'
  enabled?: boolean
  page?: number
  pageSize?: number
}

interface UseHierarchyOKRsReturn {
  treeData: HierarchyTreeData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  loadChildren: (nodeId: string, force?: boolean) => Promise<void>
  clearLoadedNode: (nodeId: string) => void
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
  sortBy,
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

  // Request counter to prevent race conditions
  const requestCounterRef = useRef(0)

  // Fetch root objectives only (parentId is null)
  const fetchRootObjectives = useCallback(async (pageNum: number = 1) => {
    // Increment request counter to track this request
    requestCounterRef.current += 1
    const thisRequestId = requestCounterRef.current

    console.log('[useHierarchyOKRs] fetchRootObjectives called', {
      requestId: thisRequestId, enabled, tenantId, cycleId, scope, pageNum
    })

    if (!enabled || !tenantId) {
      console.log('[useHierarchyOKRs] Early return - not enabled or no tenantId')
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
        parentId: 'null', // Fetch only root objectives
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

      if (sortBy && sortBy !== 'none') {
        params.set('sortBy', sortBy)
      }

      console.log('[useHierarchyOKRs] Fetching:', `/okr/overview?${params.toString()}`)
      const response = await api.get(`/okr/overview?${params.toString()}`)

      // Check if this request is still the latest one
      if (thisRequestId !== requestCounterRef.current) {
        console.log('[useHierarchyOKRs] Ignoring stale response', {
          thisRequestId, currentRequestId: requestCounterRef.current
        })
        return // Ignore stale responses
      }

      const envelope = response.data || {}
      const objectives = envelope.objectives || []

      console.log('[useHierarchyOKRs] Received', objectives.length, 'objectives, totalCount:', envelope.totalCount)
      console.log('[useHierarchyOKRs] Full API response envelope:', {
        hasObjectives: !!envelope.objectives,
        objectivesLength: envelope.objectives?.length || 0,
        totalCount: envelope.totalCount,
        envelopeKeys: Object.keys(envelope),
      })
      
      // Debug: Check if Key Results and Initiatives are included
      if (objectives.length > 0) {
        const firstObj = objectives[0]
        console.log('[useHierarchyOKRs] First objective sample:', {
          id: firstObj.objectiveId || firstObj.id,
          title: firstObj.title,
          keyResultsCount: firstObj.keyResults?.length || 0,
          initiativesCount: firstObj.initiatives?.length || 0,
          hasKeyResults: !!firstObj.keyResults,
          hasInitiatives: !!firstObj.initiatives,
          keyResults: firstObj.keyResults, // Log the actual array
          keyResultsType: Array.isArray(firstObj.keyResults) ? 'array' : typeof firstObj.keyResults,
          keyResultsSample: firstObj.keyResults?.[0] ? {
            hasKeyResultId: !!firstObj.keyResults[0].keyResultId,
            hasKeyResult: !!firstObj.keyResults[0].keyResult,
            hasTitle: !!firstObj.keyResults[0].title,
            structure: Object.keys(firstObj.keyResults[0]),
            fullSample: firstObj.keyResults[0],
          } : 'No first KR',
          initiativesSample: firstObj.initiatives?.[0] ? {
            keys: Object.keys(firstObj.initiatives[0]),
            id: firstObj.initiatives[0].id,
            title: firstObj.initiatives[0].title,
            status: firstObj.initiatives[0].status,
            progress: firstObj.initiatives[0].progress,
            objectiveId: firstObj.initiatives[0].objectiveId,
            keyResultId: firstObj.initiatives[0].keyResultId,
            ownerId: firstObj.initiatives[0].ownerId,
            fullSample: firstObj.initiatives[0],
          } : 'No first Initiative',
          fullObjectiveKeys: Object.keys(firstObj),
        })
      } else {
        console.log('[useHierarchyOKRs] No objectives returned. Full response:', JSON.stringify(envelope, null, 2))
      }

      // Backend now filters by parentId=null, so all returned objectives are roots
      const rootObjectives = objectives

      // Use total count from backend response
      // The backend calculates totalCount based on visibility filtering of all matching objectives
      // Handle explicit 0 correctly (0 || length would be length if length > 0, which is wrong if total is 0 but we have local items?? No, impossible)
      // But safer to check type
      const total = typeof envelope.totalCount === 'number' ? envelope.totalCount : rootObjectives.length
      console.log('[useHierarchyOKRs] Setting totalCount:', total, 'from envelope:', envelope.totalCount)
      setTotalCount(total)

      setCurrentPage(pageNum)

      // Transform root objectives to hierarchical structure
      console.log('[useHierarchyOKRs] Before transform - rootObjectives:', rootObjectives.length, 'objectives')
      if (rootObjectives.length > 0) {
        console.log('[useHierarchyOKRs] First objective before transform:', {
          id: rootObjectives[0].objectiveId || rootObjectives[0].id,
          title: rootObjectives[0].title,
          keyResultsCount: rootObjectives[0].keyResults?.length || 0,
          initiativesCount: rootObjectives[0].initiatives?.length || 0,
          hasKeyResults: !!rootObjectives[0].keyResults,
          keyResults: rootObjectives[0].keyResults,
        })
      }
      const transformed = transformToHierarchy(rootObjectives)
      console.log('[useHierarchyOKRs] Transformed to', transformed.roots.length, 'root nodes')
      if (transformed.roots.length > 0) {
        console.log('[useHierarchyOKRs] First root node after transform:', {
          id: transformed.roots[0].id,
          title: transformed.roots[0].title,
          childrenCount: transformed.roots[0].children.length,
          childrenTypes: transformed.roots[0].children.map(c => c.type),
        })
      }
      setTreeData(transformed)
    } catch (err: any) {
      // Check if this request is still the latest one
      if (thisRequestId !== requestCounterRef.current) {
        console.log('[useHierarchyOKRs] Ignoring stale error', {
          thisRequestId, currentRequestId: requestCounterRef.current
        })
        return // Ignore stale errors
      }

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
      // Only update loading state if this is still the latest request
      if (thisRequestId === requestCounterRef.current) {
        setLoading(false)
      }
    }
  }, [tenantId, cycleId, status, scope, searchQuery, enabled, pageSize])

  // Clear a specific node from loaded cache (useful when filters change)
  const clearLoadedNode = useCallback((nodeId: string) => {
    loadedNodeIdsRef.current.delete(nodeId)
  }, [])

  // Load children of a specific objective
  const loadChildren = useCallback(async (nodeId: string, force: boolean = false) => {
    if (!enabled || !tenantId) {
      return // Disabled
    }
    
    // Check if already loaded (unless forcing)
    if (!force && loadedNodeIdsRef.current.has(nodeId)) {
      return // Already loaded
    }

    try {
      setLoadingNodeIds(prev => new Set(prev).add(nodeId))

      const params = new URLSearchParams({
        tenantId,
        page: '1',
        pageSize: '50', // Load a reasonable batch size
        parentId: nodeId, // Fetch children of this node
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

      console.log('[useHierarchyOKRs] loadChildren called for node:', nodeId)
      
      // Fetch children (sub-objectives)
      const response = await api.get(`/okr/overview?${params.toString()}`)
      const envelope = response.data || {}
      const allObjectives = envelope.objectives || []

      // Fetch the parent objective directly using the objectives endpoint to get its initiatives
      // The overview endpoint with parentId filter won't return the parent itself
      let parentObjective: any = null
      try {
        const parentResponse = await api.get(`/objectives/${nodeId}`)
        parentObjective = parentResponse.data
        console.log('[useHierarchyOKRs] Fetched parent objective directly:', {
          nodeId,
          parentFound: !!parentObjective,
          parentInitiatives: parentObjective?.initiatives?.length || 0,
          parentInitiativesSample: parentObjective?.initiatives?.[0] ? {
            id: parentObjective.initiatives[0].id,
            title: parentObjective.initiatives[0].title,
            objectiveId: parentObjective.initiatives[0].objectiveId,
            keyResultId: parentObjective.initiatives[0].keyResultId,
          } : null,
        })
      } catch (err: any) {
        console.warn('[useHierarchyOKRs] Failed to fetch parent objective:', err.message)
        // Continue without parent initiatives - they might already be in the tree
      }
      
      console.log('[useHierarchyOKRs] loadChildren received:', {
        nodeId,
        objectivesCount: allObjectives.length,
        parentFound: !!parentObjective,
        parentInitiativesCount: parentObjective?.initiatives?.length || 0,
        allObjectives: allObjectives.map((obj: any) => ({
          id: obj.objectiveId || obj.id,
          title: obj.title,
          type: obj.objectiveId ? 'objective' : 'unknown',
          keyResultsCount: obj.keyResults?.length || 0,
        })),
        firstObjective: allObjectives[0] ? {
          id: allObjectives[0].objectiveId || allObjectives[0].id,
          title: allObjectives[0].title,
          keyResultsCount: allObjectives[0].keyResults?.length || 0,
          hasKeyResults: !!allObjectives[0].keyResults,
        } : null,
      })

      // Backend now filters by parentId=nodeId
      const children = allObjectives

      if (children.length === 0) {
        console.log('[useHierarchyOKRs] No children found for node:', nodeId)
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
              // Get initiatives from the parent objective we fetched
              // If parentObjective not found in response, try to get from existing node or fetch separately
              let parentInitiatives = parentObjective?.initiatives || []
              
              // If we didn't get initiatives from the parent fetch, the parent node might already have them
              // Check existing children for initiatives
              if (parentInitiatives.length === 0) {
                const existingInitiatives = node.children.filter(child => child.type === 'initiative')
                if (existingInitiatives.length > 0) {
                  console.log('[useHierarchyOKRs] Using existing initiatives from node:', existingInitiatives.length)
                  // We'll preserve these existing initiatives
                }
              }
              
              console.log('[useHierarchyOKRs] loadChildren - Parent initiatives:', {
                nodeId,
                parentInitiativesCount: parentInitiatives.length,
                existingInitiativesCount: node.children.filter(c => c.type === 'initiative').length,
                parentInitiatives: parentInitiatives.map((init: any) => ({
                  id: init.id,
                  title: init.title,
                  objectiveId: init.objectiveId,
                  keyResultId: init.keyResultId,
                })),
              })
              
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

              // Add initiatives from the parent objective
              const initiativeNodes: HierarchyOKRNode[] = []
              
              // Group initiatives by whether they're linked to KRs or the objective
              const initiativesByKR = new Map<string, typeof parentInitiatives>()
              const objectiveInitiatives: typeof parentInitiatives = []
              
              parentInitiatives.forEach((initiative: any) => {
                if (initiative.keyResultId) {
                  if (!initiativesByKR.has(initiative.keyResultId)) {
                    initiativesByKR.set(initiative.keyResultId, [])
                  }
                  initiativesByKR.get(initiative.keyResultId)!.push(initiative)
                } else {
                  objectiveInitiatives.push(initiative)
                }
              })

              // Add initiatives linked to Key Results as children of those KRs
              initiativesByKR.forEach((initiatives, krId) => {
                const krNode = newAllNodes.get(krId)
                if (krNode && krNode.type === 'keyResult') {
                  initiatives.forEach((initiative: any) => {
                    const initiativeNode: HierarchyOKRNode = {
                      id: initiative.id,
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
                      objectiveId: nodeId,
                      initiativeId: initiative.id,
                    }
                    newAllNodes.set(initiative.id, initiativeNode)
                    krNode.children.push(initiativeNode)
                  })
                }
              })

              // Add initiatives linked directly to the objective
              objectiveInitiatives.forEach((initiative: any) => {
                const initiativeNode: HierarchyOKRNode = {
                  id: initiative.id,
                  type: 'initiative',
                  title: initiative.title,
                  status: initiative.status as HierarchyOKRNode['status'],
                  progress: initiative.progress ?? 0,
                  ownerId: initiative.ownerId,
                  owner: initiative.owner || undefined,
                  parentId: nodeId,
                  expanded: false,
                  children: [],
                  objectiveId: nodeId,
                  initiativeId: initiative.id,
                }
                newAllNodes.set(initiative.id, initiativeNode)
                initiativeNodes.push(initiativeNode)
              })

              console.log('[useHierarchyOKRs] loadChildren - Added initiatives:', {
                nodeId,
                objectiveInitiativesCount: objectiveInitiatives.length,
                krInitiativesCount: initiativesByKR.size,
                totalInitiativeNodes: initiativeNodes.length,
              })

              // Preserve existing initiatives and other non-objective children (like KRs)
              const existingNonObjectiveChildren = node.children.filter(child => 
                child.type !== 'objective' && child.type !== 'initiative'
              )
              const existingInitiatives = node.children.filter(child => child.type === 'initiative')
              
              // Combine: existing non-objective children + new child objectives + new/existing initiatives
              // Remove duplicates by ID
              const allInitiatives = [...existingInitiatives, ...initiativeNodes]
              const uniqueInitiatives = Array.from(
                new Map(allInitiatives.map(init => [init.id, init])).values()
              )

              return {
                ...node,
                children: [...existingNonObjectiveChildren, ...childNodes, ...uniqueInitiatives],
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
    console.log('[useHierarchyOKRs] useEffect triggered', { tenantId, cycleId, status, scope, searchQuery, currentPage })
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
    clearLoadedNode,
    loadingNodeIds,
    pagination: {
      currentPage,
      totalCount,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  }
}

