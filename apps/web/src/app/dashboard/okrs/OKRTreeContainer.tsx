/**
 * OKR Tree Container
 * Fetches OKR data and renders tree view (mirrors OKRPageContainer logic)
 */

'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  
  const loadOKRs = useCallback(async () => {
    if (!currentOrganization?.id || !user?.id) return
    try {
      setLoading(true)
      setPermissionError(null)
      
      // Fetch all objectives using pagination (max pageSize is 50)
      const maxPageSize = 50
      let allObjectives: any[] = []
      let currentPage = 1
      let hasMore = true
      
      while (hasMore) {
        const params = new URLSearchParams({
          tenantId: currentOrganization.id,
          page: currentPage.toString(),
          pageSize: maxPageSize.toString(),
        })
        
        if (selectedCycleId) {
          params.set('cycleId', selectedCycleId)
        }
        
        if (selectedStatus) {
          params.set('status', selectedStatus)
        }
        
        // Apply scope-based filtering (backend handles RBAC/visibility)
        // Note: Backend visibility filtering handles scope-based access control
        // We don't need to add explicit scope params - backend RBAC enforces visibility
        if (selectedScope === 'my' && user?.id) {
          // My scope: backend visibility filtering handles this
        } else if (selectedScope === 'team-workspace') {
          // Team/Workspace scope: backend visibility filtering handles this
        } else if (selectedScope === 'tenant') {
          // Tenant scope: backend visibility filtering handles this
        }
        
        const response = await api.get(`/okr/overview?${params.toString()}`)
        
        const envelope = response.data || {}
        const objectives = envelope.objectives || []
        
        if (objectives.length === 0) {
          hasMore = false
        } else {
          allObjectives = [...allObjectives, ...objectives]
          // Check if there are more pages
          const totalCount = envelope.totalCount || 0
          const fetchedCount = allObjectives.length
          hasMore = fetchedCount < totalCount
          currentPage++
        }
      }
      
      const mapped = Array.isArray(allObjectives) ? allObjectives.map((obj: any) => 
        mapObjectiveDataForTree(obj, availableUsers, activeCycles, overdueCheckIns)
      ) : []
      
      setObjectivesPage(mapped)
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
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id, user?.id, selectedCycleId, selectedStatus, selectedScope, filterWorkspaceId, filterTeamId, filterOwnerId, searchQuery, selectedTimeframeKey])
  
  useEffect(() => {
    // Wait for both organization and user to be ready before loading
    if (currentOrganization?.id && user?.id) {
      loadOKRs()
    } else {
      // If we don't have org/user yet, stay in loading state
      setLoading(true)
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
