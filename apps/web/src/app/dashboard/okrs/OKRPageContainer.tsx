'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { OKRListVirtualised } from './OKRListVirtualised'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OkrRowSkeleton } from '@/components/ui/skeletons'
import { mapErrorToMessage } from '@/lib/error-mapping'

interface OKRPageContainerProps {
  availableUsers: any[]
  activeCycles: Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    tenantId: string
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
  // New filter props
  myOkrsOnly?: boolean
  selectedVisibility?: 'ALL' | 'PUBLIC_TENANT' | 'PRIVATE'
  selectedOwnerId?: string | null
  selectedPillarId?: string | null
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
  expandedObjectiveId: string | null
  onToggleObjective: (id: string) => void
  onCanCreateChange?: (canCreate: boolean) => void
  onCreateObjective?: () => void
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
  
  // Priority order: cycleId (from mapObjectiveData) > plannedCycleId > cycle?.id > cycle name > other labels
  // Explicitly check for cycleId first (this should be set by mapObjectiveData)
  if (rawObjective.cycleId && typeof rawObjective.cycleId === 'string' && rawObjective.cycleId.length > 0) {
    timeframeKey = rawObjective.cycleId
  } else if (rawObjective.plannedCycleId && typeof rawObjective.plannedCycleId === 'string' && rawObjective.plannedCycleId.length > 0) {
    timeframeKey = rawObjective.plannedCycleId
  } else if (rawObjective.cycle?.id && typeof rawObjective.cycle.id === 'string' && rawObjective.cycle.id.length > 0) {
    timeframeKey = rawObjective.cycle.id
  } else if (rawObjective.cycleName && typeof rawObjective.cycleName === 'string') {
    timeframeKey = normaliseLabelToKey(rawObjective.cycleName)
  // W4.M1: periodLabel removed - only cycleId/cycleName used
  } else if (rawObjective.timeframeLabel && typeof rawObjective.timeframeLabel === 'string') {
    timeframeKey = normaliseLabelToKey(rawObjective.timeframeLabel)
  } else if (rawObjective.cycle?.name && typeof rawObjective.cycle.name === 'string') {
    timeframeKey = normaliseLabelToKey(rawObjective.cycle.name)
  }
  
  // Ensure timeframeKey is always a string (never undefined)
  // Place timeframeKey AFTER spread to ensure it overwrites any existing undefined value
  return {
    ...rawObjective,
    timeframeKey: timeframeKey || 'unassigned',
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
    const krId = kr.keyResultId || kr.id
    const isOverdue = overdueCheckIns.some(item => item.krId === krId)
    
    // Extract KR data - handle both junction table format and direct format
    const krData = kr.keyResult || kr
    const weight = kr.weight ?? 1.0 // Extract weight from junction table, default to 1.0
    
    // Calculate last check-in date and next check-in due from check-ins if available
    let lastCheckInDate: string | null = null
    let nextCheckInDue: string | null = null
    
    const checkIns = krData.checkIns || kr.checkIns
    if (checkIns && Array.isArray(checkIns) && checkIns.length > 0) {
      // Get the most recent check-in
      const latestCheckIn = checkIns[0]
      lastCheckInDate = latestCheckIn.createdAt || null
      
      // Calculate next check-in due based on cadence
      const cadence = krData.checkInCadence || kr.cadence
      if (cadence && cadence !== 'NONE' && lastCheckInDate) {
        const lastCheckIn = new Date(lastCheckInDate)
        let daysBetween = 7
        switch (cadence) {
          case 'WEEKLY':
            daysBetween = 7
            break
          case 'BIWEEKLY':
            daysBetween = 14
            break
          case 'MONTHLY':
            daysBetween = 31
            break
        }
        const nextDue = new Date(lastCheckIn.getTime() + daysBetween * 24 * 60 * 60 * 1000)
        nextCheckInDue = nextDue.toISOString()
      }
    }
    
    return {
      id: krId,
      title: krData.title || kr.title,
      status: krData.status || kr.status,
      progress: krData.progress ?? kr.progress ?? 0,
      currentValue: krData.currentValue ?? kr.currentValue,
      targetValue: krData.targetValue ?? kr.targetValue,
      startValue: krData.startValue ?? kr.startValue,
      unit: krData.unit || kr.unit,
      checkInCadence: krData.checkInCadence || kr.cadence,
      isOverdue,
      ownerId: krData.ownerId || kr.ownerId,
      lastCheckInDate,
      nextCheckInDue,
      canCheckIn: kr.canCheckIn !== undefined ? kr.canCheckIn : false,
      weight, // Include weight from junction table
    }
  })
  
  const overdueCountForObjective = rawObj.overdueCheckInsCount !== undefined 
    ? rawObj.overdueCheckInsCount 
    : keyResults.filter((kr: any) => kr.isOverdue).length
  
  const lowestConfidence = rawObj.latestConfidencePct !== undefined 
    ? rawObj.latestConfidencePct 
    : null
  
  // Collect initiatives from both sources and deduplicate by ID
  // An initiative can be linked to both an Objective AND a Key Result, so it appears in both arrays
  const seenInitIds = new Set<string>()
  const allInitiatives: any[] = []
  
  // First, add initiatives from Key Results (they have KR context which is more useful)
  ;(rawObj.keyResults || []).forEach((kr: any) => {
    (kr.initiatives || []).forEach((init: any) => {
      if (!seenInitIds.has(init.id)) {
        seenInitIds.add(init.id)
        allInitiatives.push({
          ...init,
          keyResultId: kr.keyResultId || kr.id,
          keyResultTitle: kr.title,
        })
      }
    })
  })
  
  // Then, add objective-only initiatives (skip if already seen from KR)
  ;(rawObj.initiatives || []).forEach((init: any) => {
    if (!seenInitIds.has(init.id)) {
      seenInitIds.add(init.id)
      allInitiatives.push({
        ...init,
        keyResultId: init.keyResultId,
        keyResultTitle: init.keyResultTitle,
      })
    }
  })
  
  const initiatives = allInitiatives.map((init: any) => ({
    id: init.id,
    title: init.title,
    description: init.description || undefined,
    status: init.status,
    dueDate: init.dueDate,
    keyResultId: init.keyResultId,
    keyResultTitle: init.keyResultTitle,
    ownerId: init.ownerId || undefined,
    createdAt: init.createdAt || undefined,
    updatedAt: init.updatedAt || undefined,
  }))
  
    const owner = rawObj.owner || availableUsers.find(u => u.id === rawObj.ownerId)
  
    // W4.M1: Map publishState from backend response (new field)
    // Falls back to isPublished boolean for backward compatibility
    const publishState = rawObj.publishState || (rawObj.isPublished ? 'PUBLISHED' : 'DRAFT')
    
    return {
      id: rawObj.objectiveId || rawObj.id,
      title: rawObj.title,
      status: rawObj.status || 'ON_TRACK',
      publishState, // W4.M1: New field
      isPublished: rawObj.isPublished ?? false, // Kept for backward compatibility
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
    pillarId: rawObj.pillarId || null,
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
  filterOverdue = false,
  searchQuery,
  selectedTimeframeKey,
  selectedStatus,
  selectedCycleId,
  selectedScope,
  myOkrsOnly = false,
  selectedVisibility = 'ALL',
  selectedOwnerId: selectedOwnerIdProp = null,
  selectedPillarId: selectedPillarIdProp = null,
  onAction,
  expandedObjectiveId,
  onToggleObjective,
  onCanCreateChange,
  onCreateObjective,
}: OKRPageContainerProps) {
  const { currentOrganization } = useWorkspace()
  const { user, isSuperuser } = useAuth()
  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()
  
  const [objectivesPage, setObjectivesPage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [canCreateObjective, setCanCreateObjective] = useState<boolean>(false)
  const pageSize = 20
  
  const loadOKRs = useCallback(async () => {
    if (!currentOrganization?.id) {
      console.log('[OKR PAGE CONTAINER] Skipping loadOKRs - no organization ID')
      setPermissionError('No organization selected. Please select an organization to view OKRs.')
      setLoading(false)
      setObjectivesPage([])
      setTotalCount(0)
      return
    }
    console.log('[OKR PAGE CONTAINER] Loading OKRs for organization:', currentOrganization.id, 'scope:', selectedScope, 'user:', user?.email)
    try {
      setLoading(true)
      setPermissionError(null)
      
      const params = new URLSearchParams({
        tenantId: currentOrganization.id,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })
      
      if (selectedCycleId) {
        params.set('cycleId', selectedCycleId)
      }
      
      if (selectedStatus) {
        params.set('status', selectedStatus)
      }
      
      // Pass scope to backend
      if (selectedScope) {
        params.set('scope', selectedScope)
      }
      
      // Apply "My OKRs" filter: when enabled, filter by ownerId=me
      // Note: This overrides scope='my' if both are set, but that's acceptable
      // Future enhancement: include team-owned OKRs when myOkrsOnly=true
      if (myOkrsOnly && user?.id) {
        params.set('ownerId', user.id)
      } else if (selectedOwnerIdProp) {
        // Use explicit ownerId filter if provided
        params.set('ownerId', selectedOwnerIdProp)
      }
      
      // Apply visibility filter
      if (selectedVisibility && selectedVisibility !== 'ALL') {
        params.set('visibilityLevel', selectedVisibility)
      }

      // Apply pillar filter
      if (selectedPillarIdProp) {
        params.set('pillarId', selectedPillarIdProp)
      }
      
      console.log('[OKR PAGE CONTAINER] Fetching from:', `/okr/overview?${params.toString()}`)
      const response = await api.get(`/okr/overview?${params.toString()}`)
      
      // Backend now returns paginated envelope
      const envelope = response.data || {}
      const objectives = envelope.objectives || []
      
      console.log('[OKR PAGE CONTAINER] Received response:', {
        totalCount: envelope.totalCount,
        objectivesCount: objectives.length,
        canCreateObjective: envelope.canCreateObjective,
        organizationId: currentOrganization.id,
        userId: user?.id,
        userEmail: user?.email
      })
      
      // If no objectives found, show helpful message
      if (objectives.length === 0 && envelope.totalCount === 0) {
        console.warn('[OKR PAGE CONTAINER] No objectives found for organization:', currentOrganization.id)
        // Don't set an error - just show empty state
      }
      
      setTotalCount(envelope.totalCount || 0)
      
      // Extract canCreateObjective flag and notify parent
      if (onCanCreateChange) {
        if (envelope.canCreateObjective !== undefined) {
          const canCreate = envelope.canCreateObjective
          setCanCreateObjective(canCreate)
          onCanCreateChange(canCreate)
        } else {
          // Fallback: if backend doesn't return flag, default to false
          // This is conservative - button won't show until backend explicitly allows it
          setCanCreateObjective(false)
          onCanCreateChange(false)
        }
      } else {
        // If no callback, still track locally
        setCanCreateObjective(envelope.canCreateObjective || false)
      }
      
      const mapped = Array.isArray(objectives) ? objectives.map((obj: any) => {
        try {
          return mapObjectiveData(obj, availableUsers, activeCycles, overdueCheckIns)
        } catch (error) {
          console.error('[OKR PAGE CONTAINER] Error mapping objective:', obj.id, error)
          // Return a minimal valid objective structure to prevent crashes
          return {
            id: obj.objectiveId || obj.id,
            title: obj.title || 'Untitled Objective',
            status: obj.status || 'ON_TRACK',
            publishState: obj.publishState || (obj.isPublished ? 'PUBLISHED' : 'DRAFT'),
            isPublished: obj.isPublished ?? false,
            visibilityLevel: obj.visibilityLevel,
            cycleName: obj.cycle?.name || obj.cycleName,
            cycleLabel: obj.cycle?.name || obj.cycleName || 'Unassigned',
            cycleStatus: obj.cycleStatus || obj.cycle?.status || 'ACTIVE',
            owner: obj.owner || availableUsers.find(u => u.id === obj.ownerId) || { id: obj.ownerId || '', name: 'Unassigned', email: null },
            progress: obj.progress ?? 0,
            keyResults: [],
            initiatives: [],
            overdueCountForObjective: 0,
            lowestConfidence: null,
            ownerId: obj.ownerId,
            organizationId: obj.organizationId,
            workspaceId: obj.workspaceId,
            teamId: obj.teamId,
            cycleId: obj.cycle?.id || obj.cycleId,
            canEdit: obj.canEdit !== undefined ? obj.canEdit : false,
            canDelete: obj.canDelete !== undefined ? obj.canDelete : false,
          }
        }
      }) : []
      
      console.log('[OKR PAGE CONTAINER] Loaded objectives:', mapped.length, 'from', objectives.length, 'raw objectives')
      setObjectivesPage(mapped)
    } catch (error: any) {
      console.error('[OKR PAGE CONTAINER] Failed to load OKRs', error)
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error'
      
      if (error.response?.status === 400) {
        // Bad Request - likely tenant/organization issue
        if (errorMessage.includes('organization') || errorMessage.includes('tenant') || errorMessage.includes('No organization assigned')) {
          setPermissionError('You are not assigned to an organization. Please contact your administrator to assign you to an organization.')
        } else {
          setPermissionError(`Invalid request: ${errorMessage}`)
        }
      } else if (error.response?.status === 403) {
        setPermissionError('You do not have permission to view OKRs. Please contact your administrator.')
      } else if (error.response?.status === 404) {
        setPermissionError('OKR service not found. Please check that the API gateway is running.')
      } else {
        setPermissionError(`Failed to load OKRs: ${errorMessage}. Please try again later.`)
      }
      setObjectivesPage([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id, selectedCycleId, selectedStatus, currentPage, filterWorkspaceId, filterTeamId, filterOwnerId, searchQuery, selectedTimeframeKey, selectedScope, myOkrsOnly, selectedVisibility, selectedOwnerIdProp, selectedPillarIdProp, user?.id])
  
  useEffect(() => {
    console.log('[OKR PAGE CONTAINER] useEffect triggered:', {
      hasOrgId: !!currentOrganization?.id,
      orgId: currentOrganization?.id,
      loadOKRsReady: !!loadOKRs
    })
    if (currentOrganization?.id) {
      loadOKRs()
    } else {
      // Reset state when organization is not available
      setObjectivesPage([])
      setLoading(false)
      setTotalCount(0)
    }
  }, [currentOrganization?.id, loadOKRs])
  
  const objectivesViewModel = useMemo(() => {
    const safeObjectives = Array.isArray(objectivesPage) ? objectivesPage : []
    const mapped = safeObjectives.map(mapObjectiveToViewModel)
    
    return mapped
  }, [objectivesPage])
  
  // Apply client-side filters (workspace, team, owner, search, timeframe, overdue)
  // Note: Visibility filtering is now done server-side, but we still need to filter
  // by workspace/team/owner/search/timeframe/overdue on the client since backend doesn't support these yet
  const filteredOKRs = useMemo(() => {
    const filtered = objectivesViewModel.filter(okr => {
      // Overdue filter: only show objectives with overdue KRs
      if (filterOverdue) {
        const hasOverdueKr = overdueCheckIns.some(item => item.objectiveId === okr.id)
        if (!hasOverdueKr) {
          return false
        }
      }
      
      if (!selectedTimeframeKey || selectedTimeframeKey === 'all') {
        // No timeframe filter - show all
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
    
    // Debug: Log Test objectives after filtering
    const testObjectivesAfterFilter = filtered.filter((okr: any) => okr.title === 'Test')
    if (testObjectivesAfterFilter.length === 0 && objectivesViewModel.some((okr: any) => okr.title === 'Test')) {
      console.warn('[OKR PAGE CONTAINER] ⚠️ Test objective filtered out by client-side filters:', {
        selectedTimeframeKey,
        filterWorkspaceId,
        filterTeamId,
        filterOwnerId,
        filterOverdue,
        searchQuery,
        testObjectiveBeforeFilter: objectivesViewModel.find((okr: any) => okr.title === 'Test'),
      })
    }
    
    return filtered
  }, [objectivesViewModel, filterWorkspaceId, filterTeamId, filterOwnerId, filterOverdue, searchQuery, selectedTimeframeKey, overdueCheckIns])
  
  const totalPages = Math.ceil(totalCount / pageSize)
  
  const preparedObjectives = useMemo(() => {
    return filteredOKRs.map((okr: any) => {
      // Backend provides canEdit/canDelete flags, use them directly
      const canEdit = okr.canEdit !== undefined ? okr.canEdit : false
      const canDelete = okr.canDelete !== undefined ? okr.canDelete : false
      
      const normalised = mapObjectiveData(okr, availableUsers, activeCycles, overdueCheckIns)
      
      // Backend already filtered visible key results and provides canCheckIn flags
      const visibleKeyResults = normalised.keyResults
      
      // Build objectiveForHook once for use in permission checks and return value
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
        
        // For now, use frontend permission check for canEditKeyResult
        // Backend doesn't provide this flag yet
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
        objectiveForHook,
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
    // Determine empty state message and actions based on role
    let emptyMessage = 'No OKRs found'
    let showCreateButton = false
    
    if (isSuperuser) {
      // SUPERUSER: read-only, no button
      emptyMessage = 'No OKRs found'
      showCreateButton = false
    } else if (canCreateObjective) {
      // TENANT_ADMIN / TENANT_OWNER: show create button
      emptyMessage = 'No OKRs found. Create your first objective to get started.'
      showCreateButton = true
    } else {
      // CONTRIBUTOR or other roles without create permission: no button
      emptyMessage = 'No OKRs found'
      showCreateButton = false
    }
    
    // Override message for specific filter cases
    if (selectedTimeframeKey === 'unassigned') {
      emptyMessage = 'No objectives are currently unassigned to a planning cycle.'
    } else if (selectedTimeframeKey && selectedTimeframeKey !== 'all') {
      emptyMessage = 'No objectives found for the selected filters.'
    }
    
    return (
      <div className="text-center py-12">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-neutral-600 mb-4">{emptyMessage}</p>
          {showCreateButton && (
            <Button
              onClick={() => {
                if (onCreateObjective) {
                  onCreateObjective()
                }
              }}
              className="focus:ring-2 focus:ring-ring focus:outline-none"
            >
              New Objective
            </Button>
          )}
        </div>
      </div>
    )
  }
  
  return (
    <div aria-busy={loading}>
      {loading && (
        <div className="space-y-4 md:space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <OkrRowSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      )}
      
      {!loading && permissionError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {permissionError}
        </div>
      )}
      
      {!loading && !permissionError && (
        <>
          <OKRListVirtualised
            objectives={preparedObjectives}
            expandedObjectiveId={expandedObjectiveId}
            onToggleObjective={onToggleObjective}
            onAction={onAction}
            availableUsers={availableUsers}
          />
          
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4 text-sm text-neutral-700" aria-label="Pagination">
              <div className="text-neutral-600" role="status">
                Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} objectives
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
      )}
    </div>
  )
}
