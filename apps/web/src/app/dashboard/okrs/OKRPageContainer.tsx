'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { OKRListVirtualised } from './OKRListVirtualised'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OKRPageContainerProps {
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
  searchQuery: string
  selectedTimeframeKey: string | null
  selectedStatus: string | null
  selectedCycleId: string | null
  onAction: {
    onEdit: (okr: any) => void
    onDelete: (okr: any) => void
    onAddKeyResult: (objectiveId: string, objectiveName: string) => void
    onAddInitiativeToObjective: (objectiveId: string, objectiveName: string) => void
    onAddInitiativeToKr: (krId: string, krTitle: string) => void
    onAddCheckIn: (krId: string) => void
    onOpenHistory: (entityType: 'OBJECTIVE' | 'KEY_RESULT', entityId: string, entityTitle?: string) => void
  }
  expandedObjectiveId: string | null
  onToggleObjective: (id: string) => void
}

function mapObjectiveToViewModel(rawObjective: any): any {
  const normaliseLabelToKey = (label: string): string => {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
  
  let timeframeKey: string = 'unassigned'
  
  if (rawObjective.cycleId) {
    timeframeKey = rawObjective.cycleId
  } else if (rawObjective.plannedCycleId) {
    timeframeKey = rawObjective.plannedCycleId
  } else if (rawObjective.cycleName) {
    timeframeKey = normaliseLabelToKey(rawObjective.cycleName)
  } else if (rawObjective.periodLabel) {
    timeframeKey = normaliseLabelToKey(rawObjective.periodLabel)
  } else if (rawObjective.timeframeLabel) {
    timeframeKey = normaliseLabelToKey(rawObjective.timeframeLabel)
  } else if (rawObjective.cycle?.id) {
    timeframeKey = rawObjective.cycle.id
  } else if (rawObjective.cycle?.name) {
    timeframeKey = normaliseLabelToKey(rawObjective.cycle.name)
  }
  
  return {
    ...rawObjective,
    timeframeKey,
  }
}

function mapObjectiveData(rawObj: any, availableUsers: any[], activeCycles: any[], overdueCheckIns: Array<{ krId: string; objectiveId: string }>) {
  const cycle = rawObj.cycle || (rawObj.cycleId ? activeCycles.find(c => c.id === rawObj.cycleId) : null)
  const cycleName = cycle?.name ?? rawObj.cycleName ?? undefined
  const cycleStatus = rawObj.cycleStatus || (cycle?.status ?? 'ACTIVE')
  
  let cycleLabel = cycleName || 'Unassigned'
  if (cycleStatus === 'DRAFT' && cycleName) {
    cycleLabel = `${cycleName} (draft)`
  }
  
  const keyResults = (rawObj.keyResults || []).map((kr: any): any => {
    const isOverdue = overdueCheckIns.some(item => item.krId === kr.keyResultId || item.krId === kr.id)
    
    return {
      id: kr.keyResultId || kr.id,
      title: kr.title,
      status: kr.status,
      progress: kr.progress,
      currentValue: kr.currentValue,
      targetValue: kr.targetValue,
      startValue: kr.startValue,
      unit: kr.unit,
      checkInCadence: kr.cadence,
      isOverdue,
      ownerId: kr.ownerId,
      canCheckIn: kr.canCheckIn !== undefined ? kr.canCheckIn : false,
    }
  })
  
  const overdueCountForObjective = rawObj.overdueCheckInsCount !== undefined 
    ? rawObj.overdueCheckInsCount 
    : keyResults.filter((kr: any) => kr.isOverdue).length
  
  const lowestConfidence = rawObj.latestConfidencePct !== undefined 
    ? rawObj.latestConfidencePct 
    : null
  
  const allInitiatives = [
    ...(rawObj.initiatives || []),
    ...(rawObj.keyResults || []).flatMap((kr: any) => 
      (kr.initiatives || []).map((init: any) => ({
        ...init,
        keyResultId: kr.keyResultId || kr.id,
        keyResultTitle: kr.title,
      }))
    )
  ]
  
  const initiatives = allInitiatives.map((init: any) => ({
    id: init.id,
    title: init.title,
    status: init.status,
    dueDate: init.dueDate,
    keyResultId: init.keyResultId,
    keyResultTitle: init.keyResultTitle,
  }))
  
  const owner = rawObj.owner || availableUsers.find(u => u.id === rawObj.ownerId)
  
  return {
    id: rawObj.objectiveId || rawObj.id,
    title: rawObj.title,
    status: rawObj.status || 'ON_TRACK',
    isPublished: rawObj.isPublished ?? false,
    visibilityLevel: rawObj.visibilityLevel,
    cycleName,
    cycleLabel,
    cycleStatus,
    owner: {
      id: rawObj.ownerId || owner?.id,
      name: owner?.name || owner?.email || 'Unassigned',
      email: owner?.email || null,
    },
    progress: rawObj.progress ?? 0,
    keyResults,
    initiatives,
    overdueCountForObjective,
    lowestConfidence,
    ownerId: rawObj.ownerId,
    organizationId: rawObj.organizationId,
    workspaceId: rawObj.workspaceId,
    teamId: rawObj.teamId,
    cycleId: rawObj.cycle?.id || rawObj.cycleId,
    canEdit: rawObj.canEdit !== undefined ? rawObj.canEdit : false,
    canDelete: rawObj.canDelete !== undefined ? rawObj.canDelete : false,
  }
}

export function OKRPageContainer({
  availableUsers,
  activeCycles,
  overdueCheckIns,
  filterWorkspaceId,
  filterTeamId,
  filterOwnerId,
  searchQuery,
  selectedTimeframeKey,
  selectedStatus,
  selectedCycleId,
  onAction,
  expandedObjectiveId,
  onToggleObjective,
}: OKRPageContainerProps) {
  const { currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()
  
  const [objectivesPage, setObjectivesPage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  
  useEffect(() => {
    if (currentOrganization?.id) {
      loadOKRs()
    }
  }, [currentOrganization?.id, selectedCycleId, selectedStatus, currentPage, filterWorkspaceId, filterTeamId, filterOwnerId, searchQuery, selectedTimeframeKey])
  
  const loadOKRs = async () => {
    if (!currentOrganization?.id) return
    try {
      setLoading(true)
      setPermissionError(null)
      
      const params = new URLSearchParams({
        organizationId: currentOrganization.id,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })
      
      if (selectedCycleId) {
        params.set('cycleId', selectedCycleId)
      }
      
      if (selectedStatus) {
        params.set('status', selectedStatus)
      }
      
      const response = await api.get(`/okr/overview?${params.toString()}`)
      
      // Backend now returns paginated envelope
      const envelope = response.data || {}
      const objectives = envelope.objectives || []
      
      setTotalCount(envelope.totalCount || 0)
      
      const mapped = Array.isArray(objectives) ? objectives.map((obj: any) => 
        mapObjectiveData(obj, availableUsers, activeCycles, overdueCheckIns)
      ) : []
      
      setObjectivesPage(mapped)
    } catch (error: any) {
      console.error('[OKR PAGE CONTAINER] Failed to load OKRs', error)
      if (error.response?.status === 403) {
        setPermissionError('You do not have permission to view OKRs. Please contact your administrator.')
      } else if (error.response?.status === 404) {
        setPermissionError('OKR service not found. Please check that the API gateway is running.')
      } else {
        setPermissionError('Failed to load OKRs. Please try again later.')
      }
      setObjectivesPage([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }
  
  const objectivesViewModel = useMemo(() => {
    const safeObjectives = Array.isArray(objectivesPage) ? objectivesPage : []
    return safeObjectives.map(mapObjectiveToViewModel)
  }, [objectivesPage])
  
  // Apply client-side filters (workspace, team, owner, search, timeframe)
  // Note: Visibility filtering is now done server-side, but we still need to filter
  // by workspace/team/owner/search/timeframe on the client since backend doesn't support these yet
  const filteredOKRs = useMemo(() => {
    return objectivesViewModel.filter(okr => {
      if (!selectedTimeframeKey || selectedTimeframeKey === 'all') {
      } else {
        if (okr.timeframeKey !== selectedTimeframeKey) {
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
  }, [objectivesViewModel, filterWorkspaceId, filterTeamId, filterOwnerId, searchQuery, selectedTimeframeKey])
  
  const totalPages = Math.ceil(totalCount / pageSize)
  
  const preparedObjectives = useMemo(() => {
    return filteredOKRs.map((okr: any) => {
      // Backend provides canEdit/canDelete flags, use them directly
      const canEdit = okr.canEdit !== undefined ? okr.canEdit : false
      const canDelete = okr.canDelete !== undefined ? okr.canDelete : false
      
      const normalised = mapObjectiveData(okr, availableUsers, activeCycles, overdueCheckIns)
      
      // Backend already filtered visible key results and provides canCheckIn flags
      const visibleKeyResults = normalised.keyResults
      
      const canEditKeyResult = (krId: string): boolean => {
        const kr = visibleKeyResults.find((k: any) => k.id === krId)
        if (!kr) return false
        
        // For now, use frontend permission check for canEditKeyResult
        // Backend doesn't provide this flag yet
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
        
        return tenantPermissions.canEditKeyResult({
          id: kr.id,
          ownerId: kr.ownerId || okr.ownerId,
          organizationId: okr.organizationId,
          workspaceId: okr.workspaceId,
          teamId: okr.teamId,
          parentObjective: objectiveForHook,
        })
      }
      
      const canCheckInOnKeyResult = (krId: string): boolean => {
        const kr = visibleKeyResults.find((k: any) => k.id === krId)
        if (!kr) return false
        
        // Use backend-provided canCheckIn flag if available
        if (kr.canCheckIn !== undefined) {
          return kr.canCheckIn
        }
        
        // Fallback to frontend permission check
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
        
        return tenantPermissions.canCheckInOnKeyResult({
          id: kr.id,
          ownerId: kr.ownerId || okr.ownerId,
          organizationId: okr.organizationId,
          workspaceId: okr.workspaceId,
          teamId: okr.teamId,
          parentObjective: objectiveForHook,
        })
      }
      
      return {
        ...normalised,
        keyResults: visibleKeyResults,
        canEdit,
        canDelete,
        canEditKeyResult,
        canCheckInOnKeyResult,
      }
    })
  }, [filteredOKRs, availableUsers, activeCycles, overdueCheckIns, tenantPermissions])
  
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
  
  if (totalCount === 0 || filteredOKRs.length === 0) {
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
    <div>
      <OKRListVirtualised
        objectives={preparedObjectives}
        expandedObjectiveId={expandedObjectiveId}
        onToggleObjective={onToggleObjective}
        onAction={onAction}
        availableUsers={availableUsers}
      />
      
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4 text-sm text-neutral-700">
          <div className="text-neutral-600">
            Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} objectives
          </div>
          <div className="flex items-center gap-4">
            <button
              className={cn(
                "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              )}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              ‹ Previous
            </button>
            <div className="tabular-nums text-neutral-600">
              Page {currentPage} of {totalPages}
            </div>
            <button
              className={cn(
                "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              )}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
