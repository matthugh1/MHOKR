/**
 * OKR Tree Container
 * Fetches OKR data and renders tree view (mirrors OKRPageContainer logic)
 */

'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { OKRTreeView } from './components/OKRTreeView'
import { TreeObjective } from '@/hooks/useOKRTree'
import { cn } from '@/lib/utils'
import { OkrRowSkeleton } from '@/components/ui/skeletons'
import { mapErrorToMessage } from '@/lib/error-mapping'

interface OKRTreeContainerProps {
  availableUsers: any[]
  activeCycles: Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    organizationId: string
  }>
  overdueCheckIns: Array<{ krId: string; objectiveId: string }>
  filterWorkspaceId: string
  filterTeamId: string
  filterOwnerId: string
  filterOverdue?: boolean
  searchQuery: string
  selectedTimeframeKey: string | null
  selectedStatus: string | null
  selectedCycleId: string | null
  selectedScope: 'my' | 'team-workspace' | 'tenant'
  onAction: {
    onEdit: (okr: any) => void
    onDelete: (okr: any) => void
    onAddKeyResult: (objectiveId: string, objectiveName: string) => void
    onAddInitiativeToObjective: (objectiveId: string, objectiveName: string) => void
    onAddInitiativeToKr: (krId: string, krTitle: string, objectiveId: string) => void
    onAddCheckIn: (krId: string) => void
    onOpenHistory: (entityType: 'OBJECTIVE' | 'KEY_RESULT', entityId: string, entityTitle?: string) => void
    onOpenContextualAddMenu?: (objectiveId: string) => void
    onContextualAddKeyResult?: (objectiveId: string, objectiveTitle: string) => void
    onContextualAddInitiative?: (objectiveId: string, objectiveTitle: string) => void
  }
  selectedNodeId?: string | null
  selectedNodeType?: 'objective' | 'keyResult' | 'initiative' | null
  onNodeClick: (nodeId: string, nodeType: 'objective' | 'keyResult' | 'initiative') => void
}

import { mapObjectiveData } from '@/lib/utils/mapObjectiveData'

// Use shared utility for mapping objective data
// Wrapper function for tree view with specific options
function mapObjectiveDataForTree(rawObj: any, availableUsers: any[], activeCycles: any[], overdueCheckIns: Array<{ krId: string; objectiveId: string }>) {
  return mapObjectiveData(rawObj, availableUsers, activeCycles, overdueCheckIns, {
    includeCheckInDates: false, // Tree view doesn't need check-in dates
    useParentObjectiveId: true, // Tree view uses parentObjectiveId
  })
}

export function OKRTreeContainer({
  availableUsers,
  activeCycles,
  overdueCheckIns,
  filterWorkspaceId,
  filterTeamId,
  filterOwnerId,
  filterOverdue = false,
  searchQuery,
  selectedTimeframeKey,
  selectedStatus,
  selectedCycleId,
  selectedScope,
  onAction,
  selectedNodeId,
  selectedNodeType,
  onNodeClick,
}: OKRTreeContainerProps) {
  const { currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()
  
  const [objectivesPage, setObjectivesPage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  
  // Phase 3.4: Lazy Loading - Track which objectives have loaded key results
  const [loadedKeyResults, setLoadedKeyResults] = useState<Set<string>>(new Set())
  const [loadingKeyResults, setLoadingKeyResults] = useState<Set<string>>(new Set())
  
  // Bug 1 Fix: AbortController to cancel in-flight key result requests when filters change
  const keyResultsAbortControllerRef = useRef<AbortController | null>(null)
  
  const loadOKRs = useCallback(async () => {
    if (!currentOrganization?.id || !user?.id) return
    
    // Bug 1 Fix: Abort any in-flight key result requests from previous filter state
    // This prevents stale data from old filters from corrupting the tracking sets
    if (keyResultsAbortControllerRef.current) {
      keyResultsAbortControllerRef.current.abort()
    }
    // Create a new AbortController for the new filter state
    keyResultsAbortControllerRef.current = new AbortController()
    
    try {
      setLoading(true)
      setPermissionError(null)
      
      // Phase 3.4: Lazy Loading - Fetch objectives without key results initially
      // Key results will be loaded on-demand when objectives are expanded
      // This reduces initial payload size significantly
      const params = new URLSearchParams({
        tenantId: currentOrganization.id,
        hierarchyView: 'true', // Fetch complete hierarchy in one request
        includeKeyResults: 'false', // Phase 3.4: Lazy load key results
      })
      
      if (selectedCycleId) {
        params.set('cycleId', selectedCycleId)
      }
      
      if (selectedStatus) {
        params.set('status', selectedStatus)
      }
      
      // Pass scope to backend for proper filtering
      if (selectedScope) {
        params.set('scope', selectedScope)
      }
      
      const response = await api.get(`/okr/overview?${params.toString()}`)
      
      const envelope = response.data || {}
      const objectives = envelope.objectives || []
      
      const mapped = Array.isArray(objectives) ? objectives.map((obj: any) => 
        mapObjectiveDataForTree(obj, availableUsers, activeCycles, overdueCheckIns)
      ) : []
      
      setObjectivesPage(mapped)
      
      // Bug 1 Fix: Reset key result tracking when filters change
      // When filter parameters change, we fetch a new set of objectives.
      // We must reset the tracking sets to avoid stale data from previous filters.
      setLoadedKeyResults(new Set())
      setLoadingKeyResults(new Set())
    } catch (error: any) {
      console.error('[OKR TREE CONTAINER] Failed to load OKRs', error)
      if (error.response?.status === 403) {
        setPermissionError('You do not have permission to view OKRs. Please contact your administrator.')
      } else if (error.response?.status === 404) {
        setPermissionError('OKR service not found. Please check that the API gateway is running.')
      } else {
        setPermissionError('Failed to load OKRs. Please try again later.')
      }
      setObjectivesPage([])
      // Bug 1 Fix: Also reset tracking when error occurs
      setLoadedKeyResults(new Set())
      setLoadingKeyResults(new Set())
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id, user?.id, selectedCycleId, selectedStatus, selectedScope, filterWorkspaceId, filterTeamId, filterOwnerId, searchQuery, selectedTimeframeKey])
  
  // Phase 3.4: Lazy Loading - Fetch key results for expanded objectives
  const loadKeyResultsForObjectives = useCallback(async (objectiveIds: string[]) => {
    if (!currentOrganization?.id || objectiveIds.length === 0) return
    
    // Bug 1 Fix: Check if the current filter state has changed (request was aborted)
    const abortSignal = keyResultsAbortControllerRef.current?.signal
    if (abortSignal?.aborted) {
      // Filters have changed, don't proceed with this request
      return
    }
    
    // Filter out objectives that are already loaded or currently loading
    const idsToLoad = objectiveIds.filter(id => 
      !loadedKeyResults.has(id) && !loadingKeyResults.has(id)
    )
    
    if (idsToLoad.length === 0) return
    
    try {
      // Mark as loading
      setLoadingKeyResults(prev => {
        const next = new Set(prev)
        idsToLoad.forEach(id => next.add(id))
        return next
      })
      
      // Fetch key results from backend
      const params = new URLSearchParams({
        tenantId: currentOrganization.id,
        objectiveIds: idsToLoad.join(','),
      })
      
      // Bug 1 Fix: Pass abort signal to cancel request if filters change
      const response = await api.get(`/okr/key-results/by-objectives?${params.toString()}`, {
        signal: abortSignal,
      })
      
      // Bug 1 Fix: Check if request was aborted before processing results
      if (abortSignal?.aborted) {
        // Filters changed during request, ignore results
        return
      }
      
      const { keyResultsByObjective } = response.data || {}
      
      // Track which objectives actually received data
      const successfullyLoadedIds = new Set<string>()
      
      // Bug 2 Fix: Track which objectives were requested but didn't receive data
      // These should be marked as "loaded" with empty key results to prevent infinite retry loops
      const requestedButMissingIds = new Set<string>(idsToLoad)
      
      // Update objectives with loaded key results (recursively for nested children)
      // Phase 3.4: Transform lazy-loaded key results to match expected format
      const updateObjectiveWithKeyResults = (obj: any): any => {
        const keyResults = keyResultsByObjective[obj.id]
        if (keyResults) {
          // Mark this objective as successfully loaded
          successfullyLoadedIds.add(obj.id)
          requestedButMissingIds.delete(obj.id)
          
          // Transform lazy-loaded key results to junction table format expected by mapping function
          // The mapping function expects: { keyResult: {...}, weight: number }
          const transformedKeyResults = keyResults.map((kr: any) => ({
            id: kr.id, // Junction table ID (we'll use KR ID as fallback)
            weight: 1.0, // Default weight (could be enhanced to fetch actual weights)
            keyResult: {
              ...kr,
              // Ensure all required fields are present
              id: kr.id,
              title: kr.title,
              status: kr.status,
              progress: kr.progress,
              startValue: kr.startValue,
              targetValue: kr.targetValue,
              currentValue: kr.currentValue,
              unit: kr.unit,
              ownerId: kr.ownerId,
              owner: kr.owner,
              initiatives: kr.initiatives || [],
            },
          }))
          
          // Re-map the entire objective with new key results to ensure consistency
          const updatedObj = {
            ...obj,
            keyResults: transformedKeyResults,
            // Recursively update children if they exist
            children: obj.children ? obj.children.map((child: any) => updateObjectiveWithKeyResults(child)) : obj.children,
          }
          // Re-map using the same function used for initial load
          return mapObjectiveDataForTree(updatedObj, availableUsers, activeCycles, overdueCheckIns)
        }
        // Even if this objective doesn't have key results, recursively update its children
        if (obj.children && obj.children.length > 0) {
          return {
            ...obj,
            children: obj.children.map((child: any) => updateObjectiveWithKeyResults(child)),
          }
        }
        return obj
      }
      
      setObjectivesPage(prev => prev.map(obj => updateObjectiveWithKeyResults(obj)))
      
      // Bug 1 Fix: Check again if request was aborted before updating tracking sets
      if (abortSignal?.aborted) {
        // Filters changed during state update, ignore results
        return
      }
      
      // Mark objectives as loaded: both those that received data and those that didn't
      // Bug 2 Fix: Objectives that don't receive data are marked as "loaded" with empty key results
      // This prevents infinite retry loops while still allowing them to be refreshed if needed
      setLoadedKeyResults(prev => {
        const next = new Set(prev)
        // Add objectives that successfully received data
        successfullyLoadedIds.forEach(id => next.add(id))
        // Add objectives that were requested but didn't receive data (mark as loaded with empty results)
        requestedButMissingIds.forEach(id => next.add(id))
        return next
      })
    } catch (error: any) {
      // Bug 1 Fix: Don't handle errors if request was aborted (filters changed)
      const isAborted = 
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError' ||
        error?.code === 'ERR_CANCELED' ||
        abortSignal?.aborted
      
      if (isAborted) {
        // Request was cancelled due to filter change, this is expected
        return
      }
      
      console.error('[OKR TREE CONTAINER] Failed to load key results', error)
      toast({
        title: 'Failed to load key results',
        description: 'Some key results could not be loaded. Please try expanding again.',
        variant: 'destructive',
      })
    } finally {
      // Bug 1 Fix: Only remove from loading set if request wasn't aborted
      if (!abortSignal?.aborted) {
        setLoadingKeyResults(prev => {
          const next = new Set(prev)
          idsToLoad.forEach(id => next.delete(id))
          return next
        })
      }
    }
  }, [currentOrganization?.id, loadedKeyResults, loadingKeyResults, toast, availableUsers, activeCycles, overdueCheckIns])
  
  // Handle objective expansion - trigger key result loading
  const handleObjectiveExpand = useCallback((objectiveId: string) => {
    // Check if key results are already loaded
    if (!loadedKeyResults.has(objectiveId) && !loadingKeyResults.has(objectiveId)) {
      loadKeyResultsForObjectives([objectiveId])
    }
  }, [loadedKeyResults, loadingKeyResults, loadKeyResultsForObjectives])
  
  useEffect(() => {
    // Wait for both organization and user to be ready before loading
    if (currentOrganization?.id && user?.id) {
      loadOKRs()
    } else {
      // If we don't have org/user yet, stay in loading state
      setLoading(true)
    }
    
    // Bug 1 Fix: Cleanup - abort any pending key result requests on unmount
    return () => {
      if (keyResultsAbortControllerRef.current) {
        keyResultsAbortControllerRef.current.abort()
      }
    }
  }, [currentOrganization?.id, user?.id, loadOKRs])
  
  // Apply client-side filters
  const filteredOKRs = useMemo(() => {
    return objectivesPage.filter(okr => {
      // Overdue filter: only show objectives with overdue KRs
      if (filterOverdue) {
        const hasOverdueKr = overdueCheckIns.some(item => item.objectiveId === okr.id)
        if (!hasOverdueKr) {
          return false
        }
      }
      
      if (!selectedTimeframeKey || selectedTimeframeKey === 'all') {
        // No timeframe filter
      } else {
        const okrTimeframeKey = okr.cycleId || 'unassigned'
        if (okrTimeframeKey !== selectedTimeframeKey) {
          return false
        }
      }
      
      if (filterWorkspaceId !== 'all' && okr.workspaceId !== filterWorkspaceId) {
        return false
      }
      
      if (filterTeamId !== 'all' && okr.teamId !== filterTeamId) {
        return false
      }
      
      if (filterOwnerId !== 'all' && okr.ownerId !== filterOwnerId) {
        return false
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = okr.title?.toLowerCase().includes(query)
        const matchesDescription = okr.description?.toLowerCase().includes(query)
        const matchesOwner = okr.owner?.name?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesDescription && !matchesOwner) {
          return false
        }
      }
      
      return true
    })
  }, [objectivesPage, filterWorkspaceId, filterTeamId, filterOwnerId, filterOverdue, searchQuery, selectedTimeframeKey, overdueCheckIns])
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterWorkspaceId, filterTeamId, filterOwnerId, searchQuery, selectedTimeframeKey, selectedScope, selectedCycleId, selectedStatus])
  
  // Calculate pagination
  const effectiveTotalCount = filteredOKRs.length
  const totalPages = Math.ceil(effectiveTotalCount / pageSize)
  
  // Apply client-side pagination
  const paginatedFilteredOKRs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredOKRs.slice(startIndex, endIndex)
  }, [filteredOKRs, currentPage, pageSize])
  
  const preparedObjectives = useMemo(() => {
    return filteredOKRs.map((okr: any) => {
      const canEdit = okr.canEdit !== undefined ? okr.canEdit : false
      const canDelete = okr.canDelete !== undefined ? okr.canDelete : false
      
      const normalised = mapObjectiveDataForTree(okr, availableUsers, activeCycles, overdueCheckIns)
      
      const visibleKeyResults = normalised.keyResults
      
      const objectiveForHook = {
        id: okr.id,
        ownerId: okr.ownerId,
        organizationId: okr.organizationId,
        workspaceId: okr.workspaceId,
        teamId: okr.teamId,
        isPublished: okr.isPublished,
        visibilityLevel: okr.visibilityLevel,
        cycle: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
          ? { id: okr.cycleId, status: activeCycles.find(c => c.id === okr.cycleId)!.status }
          : null,
        cycleStatus: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
          ? activeCycles.find(c => c.id === okr.cycleId)!.status
          : null,
      }
      
      const canEditKeyResult = (krId: string): boolean => {
        const kr = visibleKeyResults.find((k: any) => k.id === krId)
        if (!kr) return false
        return tenantPermissions.canEditKeyResult({
          id: kr.id,
          ownerId: kr.ownerId || okr.ownerId,
          tenantId: okr.tenantId || okr.organizationId,
          workspaceId: okr.workspaceId,
          teamId: okr.teamId,
          parentObjective: objectiveForHook,
        })
      }
      
      const canCheckInOnKeyResult = (krId: string): boolean => {
        const kr = visibleKeyResults.find((k: any) => k.id === krId)
        if (!kr) return false
        if (kr.canCheckIn !== undefined) {
          return kr.canCheckIn
        }
        return tenantPermissions.canCheckInOnKeyResult({
          id: kr.id,
          ownerId: kr.ownerId || okr.ownerId,
          tenantId: okr.tenantId || okr.organizationId,
          workspaceId: okr.workspaceId,
          teamId: okr.teamId,
          parentObjective: objectiveForHook,
        })
      }
      
      return {
        ...normalised,
        keyResults: visibleKeyResults.map((kr: any) => ({
          ...kr,
          objectiveId: okr.id,
        })),
        canEdit,
        canDelete,
        canEditKeyResult,
        canCheckInOnKeyResult,
        canCreateKeyResult: canEdit,
        canCreateInitiative: canEdit,
        objectiveForHook,
      } as TreeObjective
    })
  }, [paginatedFilteredOKRs, availableUsers, activeCycles, overdueCheckIns, tenantPermissions])
  
  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading OKRs...</div>
  }
  
  if (permissionError) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">Access Restricted</h3>
            <p className="text-yellow-800 mb-4">{permissionError}</p>
            <p className="text-sm text-yellow-700">
              If you believe you should have access, please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  if (filteredOKRs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm text-neutral-600">
          {selectedTimeframeKey === 'unassigned' ? (
            <p>No objectives are currently unassigned to a planning cycle.</p>
          ) : selectedTimeframeKey && selectedTimeframeKey !== 'all' ? (
            <p>No objectives found for the selected filters.</p>
          ) : (
            <p>No OKRs found</p>
          )}
        </div>
      </div>
    )
  }
  
  return (
    <>
      {/* Debug panel - always visible to diagnose pagination issue */}
      <div className="mb-4 p-4 bg-yellow-100 border-2 border-yellow-500 rounded-lg text-sm font-mono shadow-lg z-50 relative">
        <strong className="text-yellow-900 text-base">🔍 Tree View Pagination Debug:</strong>
        <div className="mt-2 space-y-1 text-yellow-900">
          <div><strong>filteredOKRs.length:</strong> {filteredOKRs.length}</div>
          <div><strong>effectiveTotalCount:</strong> {effectiveTotalCount}</div>
          <div><strong>pageSize:</strong> {pageSize}</div>
          <div><strong>totalPages:</strong> {totalPages}</div>
          <div><strong>currentPage:</strong> {currentPage}</div>
          <div><strong>paginatedFilteredOKRs.length:</strong> {paginatedFilteredOKRs.length}</div>
          <div className="mt-2 p-2 bg-yellow-200 rounded font-bold text-yellow-900">
            Should show pagination? {totalPages > 1 ? '✅ YES' : '❌ NO'}
          </div>
        </div>
      </div>
      
      <OKRTreeView
        objectives={preparedObjectives}
        selectedNodeId={selectedNodeId}
        selectedNodeType={selectedNodeType}
        onNodeClick={onNodeClick}
        onAddKeyResult={onAction.onAddKeyResult}
        onAddInitiative={onAction.onAddInitiativeToObjective}
        onAddInitiativeToKr={onAction.onAddInitiativeToKr}
        onAddSubObjective={onAction.onContextualAddKeyResult ? (parentId, parentTitle) => {
          // Create sub-objective handler - for now, we'll need to add a proper handler
          // Sub-objectives are created as objectives with a parentId
          // For now, we'll use the contextual add objective flow
          // In a full implementation, we'd have a dedicated sub-objective creation handler
          console.warn('[OKRTreeContainer] Sub-objective creation not yet implemented')
        } : undefined}
        onExpand={handleObjectiveExpand}
        loadingKeyResults={loadingKeyResults}
      />
      
      {/* Pagination controls */}
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4 text-sm text-neutral-700" aria-label="Pagination">
          <div className="text-neutral-600" role="status">
            Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, effectiveTotalCount)} of {effectiveTotalCount} objectives
          </div>
          <div className="flex items-center gap-4">
            <button
              className={cn(
                "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-ring",
                "focus:ring-offset-2"
              )}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              ‹ Previous
            </button>
            <div className="tabular-nums text-neutral-600" aria-current="page">
              Page {currentPage} of {totalPages}
            </div>
            <button
              className={cn(
                "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-ring",
                "focus:ring-offset-2"
              )}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              Next ›
            </button>
          </div>
        </nav>
      )}
    </>
  )
}
