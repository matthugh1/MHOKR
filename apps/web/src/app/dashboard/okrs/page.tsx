'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Search, X, Lock, LockKeyhole } from 'lucide-react'
import { 
  getAvailablePeriodFilters, 
  getCurrentPeriodFilter,
} from '@/lib/date-utils'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { ObjectiveRow } from '@/components/okr/ObjectiveRow'
import Link from 'next/link'
import { ActivityDrawer, ActivityItem } from '@/components/ui/ActivityDrawer'
import { PublishLockWarningModal } from './components/PublishLockWarningModal'
import { CycleSelector } from '@/components/ui/CycleSelector'
import { NewObjectiveModal } from '@/components/okr/NewObjectiveModal'
import { EditObjectiveModal } from '@/components/okr/EditObjectiveModal'
import { NewKeyResultModal } from '@/components/okr/NewKeyResultModal'
import { NewCheckInModal } from '@/components/okr/NewCheckInModal'
import { NewInitiativeModal } from '@/components/okr/NewInitiativeModal'
import api from '@/lib/api'
import { logTokenInfo } from '@/lib/jwt-debug'
import { cn } from '@/lib/utils'

// NOTE: This screen is now the system of record for CRUD on Objectives, Key Results, and Initiatives.
// Visual Builder becomes an optional planning surface, not the source of truth.
export default function OKRsPage() {
  const router = useRouter()
  // [phase6-polish] Reintroduce compact multi-column grid view for exec scanning.
  const [_viewMode, _setViewMode] = useState<'grid' | 'list'>('list')
  const [selectedPeriod, _setSelectedPeriod] = useState<string>(getCurrentPeriodFilter())
  const _availablePeriods = getAvailablePeriodFilters()
  
  // Filter states
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>('all')
  const [filterTeamId, setFilterTeamId] = useState<string>('all')
  const [filterOwnerId, setFilterOwnerId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const { workspaces, teams, currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const permissions = usePermissions()
  const { canSeeObjective, ...tenantPermissions } = useTenantPermissions()
  const { toast } = useToast()
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [okrs, setOkrs] = useState<any[]>([])
  const [overdueCheckIns, setOverdueCheckIns] = useState<Array<{ krId: string; objectiveId: string }>>([])
  // TODO [phase7-hardening]: move to SWR/react-query once we introduce caching & invalidation.
  const [loading, setLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  
  // Pagination and filter state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [activityEntityName, setActivityEntityName] = useState('')
  const [publishLockDialogOpen, setPublishLockDialogOpen] = useState(false)
  const [selectedObjectiveForLock, setSelectedObjectiveForLock] = useState<any | null>(null)
  const [pendingDeleteOkr, setPendingDeleteOkr] = useState<{ id: string; title: string } | null>(null)
  const [expandedObjectiveId, setExpandedObjectiveId] = useState<string | null>(null)
  const [activeCycles, setActiveCycles] = useState<Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    organizationId: string
  }>>([])
  
  // Objective creation
  const [showNewObjective, setShowNewObjective] = useState(false)
  
  // Objective editing
  const [showEditObjective, setShowEditObjective] = useState(false)
  const [editObjectiveId, setEditObjectiveId] = useState<string | null>(null)
  const [editObjectiveData, setEditObjectiveData] = useState<any | null>(null)
  
  // Key Result creation
  const [showNewKeyResult, setShowNewKeyResult] = useState(false)
  const [krParentObjectiveId, setKrParentObjectiveId] = useState<string | null>(null)
  const [krParentObjectiveName, setKrParentObjectiveName] = useState<string | null>(null)
  
  // Check-in creation
  const [showNewCheckIn, setShowNewCheckIn] = useState(false)
  const [activeCheckInKrId, setActiveCheckInKrId] = useState<string | null>(null)
  
  // Initiative creation
  const [showNewInitiative, setShowNewInitiative] = useState(false)
  const [initiativeParentObjectiveId, setInitiativeParentObjectiveId] = useState<string | null>(null)
  const [initiativeParentKeyResultId, setInitiativeParentKeyResultId] = useState<string | null>(null)
  const [initiativeParentName, setInitiativeParentName] = useState<string | null>(null)
  
  // TODO [phase6-polish]: consolidate these into a reducer.
  
  // Helper to normalize a label string to a timeframeKey
  const normaliseLabelToKey = (label: string): string => {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }
  
  // Helper to map raw objective from API to view model with timeframeKey
  const mapObjectiveToViewModel = (rawObjective: any): any => {
    let timeframeKey: string = 'unassigned'
    
    // Priority 1: cycleId
    if (rawObjective.cycleId) {
      timeframeKey = rawObjective.cycleId
    }
    // Priority 2: plannedCycleId (if exists)
    else if (rawObjective.plannedCycleId) {
      timeframeKey = rawObjective.plannedCycleId
    }
    // Priority 3: cycle-like label fields (cycleName, periodLabel, timeframeLabel, etc.)
    else if (rawObjective.cycleName) {
      timeframeKey = normaliseLabelToKey(rawObjective.cycleName)
    } else if (rawObjective.periodLabel) {
      timeframeKey = normaliseLabelToKey(rawObjective.periodLabel)
    } else if (rawObjective.timeframeLabel) {
      timeframeKey = normaliseLabelToKey(rawObjective.timeframeLabel)
    }
    // Priority 4: fallback to 'unassigned'
    
    return {
      ...rawObjective,
      timeframeKey,
    }
  }
  
  useEffect(() => {
    // Debug: Log JWT token info and user context (remove in production)
    if (process.env.NODE_ENV === 'development') {
      logTokenInfo()
      console.log('👤 Current User from Auth Context:', user)
      console.log('🏢 Current Organization:', currentOrganization)
      
      // Check what /users/me actually returns (backend req.user)
      api.get('/users/me')
        .then((res) => {
          console.log('🔍 Backend /users/me response:', res.data)
          console.log('   organizationId:', res.data.organizationId || '❌ NOT SET')
        })
        .catch((err) => {
          console.error('Failed to fetch /users/me:', err)
        })
    }
    
    loadUsers()
    loadActiveCycles()
    loadOverdueCheckIns()
  }, [currentOrganization?.id, user])
  
  // Reload OKRs when pagination or filters change
  useEffect(() => {
    if (currentOrganization?.id) {
      loadOKRs()
    }
  }, [page, limit, selectedCycleId, selectedStatus, currentOrganization?.id])
  
  const loadOKRs = async () => {
    if (!currentOrganization?.id) return
    try {
      setLoading(true)
      setPermissionError(null)
      
      // Build query parameters
      const params = new URLSearchParams({
        organizationId: currentOrganization.id,
        page: String(page),
        limit: String(limit),
      })
      
      if (selectedCycleId) {
        params.set('cycleId', selectedCycleId)
      }
      
      if (selectedStatus) {
        params.set('status', selectedStatus)
      }
      
      // Use api client to ensure requests go to API gateway (port 3000), not Next.js dev server
      const response = await api.get(`/okr/overview?${params.toString()}`)
      
      // Parse pagination headers from response
      const totalHeader = response.headers['x-total-count']
      const pageHeader = response.headers['x-page']
      const limitHeader = response.headers['x-limit']
      
      if (totalHeader) setTotalCount(Number(totalHeader))
      // Only update page/limit from headers if they differ (prevents unnecessary re-renders)
      if (pageHeader) {
        const serverPage = Number(pageHeader)
        if (serverPage !== page) setPage(serverPage)
      }
      if (limitHeader) {
        const serverLimit = Number(limitHeader)
        if (serverLimit !== limit) setLimit(serverLimit)
      }
      
      const data = response.data || []
      
      // Map data using existing mapObjectiveData function
      const mapped = Array.isArray(data) ? data.map((obj: any) => 
        mapObjectiveData(obj, availableUsers, activeCycles, overdueCheckIns)
      ) : []
      
      setOkrs(mapped)
    } catch (error: any) {
      console.error('[OKR PAGE] Failed to load OKRs', error)
      if (error.response?.status === 403) {
        setPermissionError('You do not have permission to view OKRs. Please contact your administrator.')
      } else if (error.response?.status === 404) {
        setPermissionError('OKR service not found. Please check that the API gateway is running.')
      } else {
        setPermissionError('Failed to load OKRs. Please try again later.')
      }
      setOkrs([])
    } finally {
      setLoading(false)
    }
  }
  
  const loadUsers = async () => {
    try {
      const response = await api.get('/users')
      setAvailableUsers(response.data || [])
    } catch (error: any) {
      // Users endpoint is optional - only used for filtering
      // If user doesn't have manage_users permission, just skip it
      if (error.response?.status !== 403) {
        console.error('Failed to load users:', error)
      }
      setAvailableUsers([])
    }
  }

  const loadActiveCycles = async () => {
    try {
      const response = await api.get('/reports/cycles/active')
      const cycles = response.data || []
      setActiveCycles(cycles)
      // TODO [phase7-hardening]: Replace with /objectives/cycles/all endpoint when available to show all cycles, not just active
      // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
      // Set default selected cycle to first active cycle if available
      if (cycles.length > 0) {
        setSelectedTimeframeKey(cycles[0].id)
        setSelectedTimeframeLabel(cycles[0].name)
      }
    } catch (error: any) {
      // Cycles endpoint is optional - gracefully degrade if no permission
      if (error.response?.status !== 403) {
        console.error('Failed to load active cycles:', error)
      }
      setActiveCycles([])
    }
  }

  const loadOverdueCheckIns = async () => {
    if (!currentOrganization?.id) return
    try {
      const response = await api.get('/reports/check-ins/overdue')
      const overdue = response.data || []
      // Extract just krId and objectiveId for quick lookup
      setOverdueCheckIns(overdue.map((item: any) => ({
        krId: item.krId,
        objectiveId: item.objectiveId,
      })))
    } catch (error: any) {
      // Overdue endpoint is optional - gracefully degrade if no permission
      if (error.response?.status !== 403) {
        console.error('Failed to load overdue check-ins:', error)
      }
      setOverdueCheckIns([])
    }
  }

  const formatCycleDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  }

  const getCycleStatusBadge = (status: string) => {
    switch (status) {
      case 'LOCKED':
        return (
          <Badge variant="secondary" className="bg-slate-600 text-white">
            <LockKeyhole className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        )
      case 'ACTIVE':
        return (
          <Badge variant="default" className="bg-green-600 text-white">
            Active
          </Badge>
        )
      case 'DRAFT':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700">
            Draft (planning)
          </Badge>
        )
      case 'ARCHIVED':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-500">
            Archived
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        )
    }
  }

  const _selectedPeriodOption = _availablePeriods.find(p => p.value === selectedPeriod);
  
  // Transform cycles for CycleSelector (map startDate/endDate to startsAt/endsAt)
  const cyclesFromApi = activeCycles.map(cycle => ({
    id: cycle.id,
    name: cycle.name,
    status: cycle.status,
    startsAt: cycle.startDate,
    endsAt: cycle.endDate,
  }))

  // Normalize cycles with synthetic fallback
  const normalizedCycles = useMemo(() => {
    if (cyclesFromApi && cyclesFromApi.length > 0) {
      return cyclesFromApi.map(c => ({
        id: c.id,
        name: c.name ?? 'Unnamed Cycle',
        status: c.status ?? 'ACTIVE',
        startsAt: c.startsAt,
        endsAt: c.endsAt,
      }))
    }
    return [
      {
        id: 'synthetic-active-cycle',
        name: 'Q4 2025 (Active)',
        status: 'ACTIVE',
        startsAt: undefined,
        endsAt: undefined,
      },
    ]
  }, [cyclesFromApi])

  // Build legacy periods list
  const legacyPeriods = useMemo(() => [
    { id: '2025-Q4', label: 'Q4 2025 (current)' },
    { id: '2026-Q1-planning', label: 'Q1 2026 (planning)', isFuture: true },
    { id: '2026-Q2-draft', label: 'Q2 2026 (draft)', isFuture: true },
    // [phase6-polish]: hydrate from backend once periods endpoint exists
  ], [])

  // State for timeframe selection (key and label)
  const [selectedTimeframeKey, setSelectedTimeframeKey] = useState<string | null>(() => {
    if (normalizedCycles.length > 0) return normalizedCycles[0].id
    if (legacyPeriods.length > 0) return legacyPeriods[0].id
    return 'all' // Default to 'all' if no cycles available
  })
  const [selectedTimeframeLabel, setSelectedTimeframeLabel] = useState<string>(() => {
    if (normalizedCycles.length > 0) return normalizedCycles[0].name
    if (legacyPeriods.length > 0) return legacyPeriods[0].label
    return 'All periods'
  })
  
  // Legacy selectedId for backwards compatibility during transition
  const _selectedId = selectedTimeframeKey
  
  // Map all objectives to view models with timeframeKey
  const objectivesViewModel = useMemo(() => {
    const safeObjectives = Array.isArray(okrs) ? okrs : []
    return safeObjectives.map(mapObjectiveToViewModel)
  }, [okrs])
  
  // Apply filters and visibility checks with safe defaults
  const filteredOKRs = objectivesViewModel.filter(okr => {
    // Apply visibility check
    if (!canSeeObjective(okr)) {
      return false
    }
    
    // Strict filtering by timeframeKey
    if (!selectedTimeframeKey || selectedTimeframeKey === 'all') {
      // Show all when 'all' is selected or no selection
    } else {
      // Strict match: only include if timeframeKey matches
      if (okr.timeframeKey !== selectedTimeframeKey) {
        return false
      }
    }
    
    // Workspace filter
    if (filterWorkspaceId !== 'all' && okr.workspaceId !== filterWorkspaceId) {
      return false
    }
    
    // Team filter
    if (filterTeamId !== 'all' && okr.teamId !== filterTeamId) {
      return false
    }
    
    // Owner filter
    if (filterOwnerId !== 'all' && okr.ownerId !== filterOwnerId) {
      return false
    }
    
    // Search filter
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
  
  const clearFilters = () => {
    setFilterWorkspaceId('all')
    setFilterTeamId('all')
    setFilterOwnerId('all')
    setSearchQuery('')
  }
  
  const hasActiveFilters = filterWorkspaceId !== 'all' || filterTeamId !== 'all' || filterOwnerId !== 'all' || searchQuery.length > 0;

  const handleEditOKR = (okr: any) => {
    // Map okr to Objective interface expected by hook
    // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
    // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
    const objectiveForHook = {
      id: okr.id,
      ownerId: okr.ownerId,
      organizationId: okr.organizationId,
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      isPublished: okr.isPublished,
      cycle: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
        ? { id: okr.cycleId, status: activeCycles.find(c => c.id === okr.cycleId)!.status }
        : null,
      cycleStatus: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
        ? activeCycles.find(c => c.id === okr.cycleId)!.status
        : null,
    }
    
    const canEdit = tenantPermissions.canEditObjective(objectiveForHook)
    
    if (!canEdit) {
      tenantPermissions.getLockInfoForObjective(objectiveForHook)
      setSelectedObjectiveForLock(okr)
      setPublishLockDialogOpen(true)
      return
    }
    
    // [phase5-core:done] replaced Visual Builder redirect with inline EditObjectiveModal for objective CRUD.
    setEditObjectiveId(okr.id)
    setEditObjectiveData({
      title: okr.title,
      ownerId: okr.ownerId,
      workspaceId: okr.workspaceId,
      cycleId: okr.cycleId,
      status: okr.status,
      visibilityLevel: okr.visibilityLevel,
      pillarId: okr.pillarId,
    })
    setShowEditObjective(true)
  }
  
  const handleAddKrClick = (objectiveId: string, objectiveName: string) => {
    setKrParentObjectiveId(objectiveId)
    setKrParentObjectiveName(objectiveName)
    setShowNewKeyResult(true)
  }
  
  const handleAddInitiativeToObjectiveClick = (objectiveId: string, objectiveName: string) => {
    setInitiativeParentObjectiveId(objectiveId)
    setInitiativeParentKeyResultId(null)
    setInitiativeParentName(objectiveName)
    setShowNewInitiative(true)
  }
  
  const handleAddInitiativeToKrClick = (krId: string, krTitle: string) => {
    setInitiativeParentObjectiveId(null)
    setInitiativeParentKeyResultId(krId)
    setInitiativeParentName(krTitle)
    setShowNewInitiative(true)
  }
  
  const handleToggleObjective = (id: string) => {
    setExpandedObjectiveId(prev => (prev === id ? null : id))
  }

  // Section Header Component for health bands
  const SectionHeader = ({ tone, label }: { tone: 'bad' | 'good' | 'neutral'; label: string }) => (
    <div className="text-[13px] font-semibold text-neutral-700 flex items-center gap-2 uppercase tracking-wide border-t border-neutral-200 pt-4 mt-8">
      <span
        className={`h-2 w-2 rounded-full ${
          tone === 'bad'
            ? 'bg-rose-500'
            : tone === 'good'
            ? 'bg-emerald-500'
            : 'bg-neutral-400'
        }`}
      />
      <span>{label}</span>
    </div>
  )

  // Helper function to render objective row
  const renderObjectiveRow = (okr: any) => {
    // Map okr to Objective interface expected by hook for permissions
    // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
    // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
    const objectiveForHook = {
      id: okr.id,
      ownerId: okr.ownerId,
      organizationId: okr.organizationId,
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      isPublished: okr.isPublished,
      cycle: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
        ? { id: okr.cycleId, status: activeCycles.find(c => c.id === okr.cycleId)!.status }
        : null,
      cycleStatus: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
        ? activeCycles.find(c => c.id === okr.cycleId)!.status
        : null,
    }
    
    const canEdit = tenantPermissions.canEditObjective(objectiveForHook)
    const canDelete = tenantPermissions.canDeleteObjective(objectiveForHook)
    
    // Normalise objective data for ObjectiveRow
    const normalised = mapObjectiveData(okr, availableUsers, activeCycles, overdueCheckIns)
    
    return (
      <ObjectiveRow
        key={normalised.id}
        objective={{
          id: normalised.id,
          title: normalised.title,
          status: normalised.status as 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED',
          progress: Math.round(normalised.progress),
          isPublished: normalised.isPublished,
          cycleName: normalised.cycleName,
          cycleLabel: normalised.cycleLabel,
          cycleStatus: normalised.cycleStatus,
          visibilityLevel: normalised.visibilityLevel,
          owner: normalised.owner,
          overdueCountForObjective: normalised.overdueCountForObjective,
          lowestConfidence: normalised.lowestConfidence,
          keyResults: normalised.keyResults,
          initiatives: normalised.initiatives,
        }}
        isExpanded={expandedObjectiveId === normalised.id}
        onToggle={handleToggleObjective}
        onAddKeyResult={handleAddKrClick}
        onAddInitiative={handleAddInitiativeToObjectiveClick}
        onEdit={(_objectiveId) => handleEditOKR(okr)}
        onDelete={(_objectiveId) => handleDeleteOKR(okr)}
        onOpenHistory={() => handleOpenActivityDrawer('OBJECTIVE', normalised.id, normalised.title)}
        onAddInitiativeToKr={(krId) => {
          const kr = normalised.keyResults.find((k: any) => k.id === krId)
          if (kr) handleAddInitiativeToKrClick(krId, kr.title)
        }}
        onAddCheckIn={handleAddCheckIn}
        canEdit={canEdit}
        canDelete={canDelete}
        availableUsers={availableUsers}
      />
    )
  }

  // Group objectives by health status
  // TODO [phase7-hardening]: Virtualise ObjectiveRows when >50 items using react-window or similar.
  const groupedObjectives = useMemo(() => {
    const needsAttentionObjectives: typeof filteredOKRs = []
    const activeObjectives: typeof filteredOKRs = []
    const completedObjectives: typeof filteredOKRs = []

    filteredOKRs.forEach((okr) => {
      const normalised = mapObjectiveData(okr, availableUsers, activeCycles, overdueCheckIns)
      const status = normalised.status || 'ON_TRACK'
      const cycleStatus = normalised.cycleStatus || 'ACTIVE'
      const overdueCheckInsCount = normalised.overdueCountForObjective || 0

      // Needs attention: AT_RISK or BLOCKED OR overdueCheckInsCount > 0
      if (status === 'AT_RISK' || status === 'BLOCKED' || overdueCheckInsCount > 0) {
        needsAttentionObjectives.push(okr)
      }
      // Active: ON_TRACK AND cycleStatus is ACTIVE
      else if (status === 'ON_TRACK' && cycleStatus === 'ACTIVE') {
        activeObjectives.push(okr)
      }
      // Completed: COMPLETED or CANCELLED OR cycleStatus is ARCHIVED
      else if (status === 'COMPLETED' || status === 'CANCELLED' || cycleStatus === 'ARCHIVED') {
        completedObjectives.push(okr)
      }
      // Fallback: anything else goes to active
      else {
        activeObjectives.push(okr)
      }
    })

    return { needsAttentionObjectives, activeObjectives, completedObjectives }
  }, [filteredOKRs, availableUsers, activeCycles, overdueCheckIns])

  // Auto-expand first objective in "needs attention" if expandedObjectiveId is null
  useEffect(() => {
    if (expandedObjectiveId === null && groupedObjectives.needsAttentionObjectives.length > 0) {
      const firstNeedsAttention = groupedObjectives.needsAttentionObjectives[0]
      const normalised = mapObjectiveData(firstNeedsAttention, availableUsers, activeCycles, overdueCheckIns)
      setExpandedObjectiveId(normalised.id)
    }
    // Only run when we have needs attention objectives and no expanded objective yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedObjectives.needsAttentionObjectives.length, expandedObjectiveId])
  
  const handleAddCheckIn = (krId: string) => {
    // [phase5-core:done] implemented NewCheckInModal and wired POST /api/check-ins
    setActiveCheckInKrId(krId)
    setShowNewCheckIn(true)
  }

  const handleDeleteOKR = async (okr: any) => {
    // Map okr to Objective interface expected by hook
    // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
    // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
    const objectiveForHook = {
      id: okr.id,
      ownerId: okr.ownerId,
      organizationId: okr.organizationId,
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      isPublished: okr.isPublished,
      cycle: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
        ? { id: okr.cycleId, status: activeCycles.find(c => c.id === okr.cycleId)!.status }
        : null,
      cycleStatus: okr.cycleId && activeCycles.find(c => c.id === okr.cycleId)
        ? activeCycles.find(c => c.id === okr.cycleId)!.status
        : null,
    }
    
    const canDelete = tenantPermissions.canDeleteObjective(objectiveForHook)
    
    if (!canDelete) {
      tenantPermissions.getLockInfoForObjective(objectiveForHook)
      setSelectedObjectiveForLock(okr)
      setPublishLockDialogOpen(true)
      return
    }
    
    // Store pending delete info for confirmation dialog
    setPendingDeleteOkr({ id: okr.id, title: okr.title })
  }

  const confirmDeleteOKR = async () => {
    if (!pendingDeleteOkr) return
    
    try {
      await api.delete(`/objectives/${pendingDeleteOkr.id}`)
      await loadOKRs() // Reload the list
      setPendingDeleteOkr(null)
      toast({
        title: 'OKR deleted',
        description: `"${pendingDeleteOkr.title}" has been deleted.`,
      })
    } catch (error: any) {
      console.error('Failed to delete OKR:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete OKR'
      toast({
        title: 'Failed to delete OKR',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleOpenActivityDrawer = async (entityType: 'OBJECTIVE' | 'KEY_RESULT', entityId: string, entityTitle?: string) => {
    try {
      const endpoint = entityType === 'OBJECTIVE' 
        ? `/activity/objectives/${entityId}`
        : `/activity/key-results/${entityId}`
      
      const response = await api.get(endpoint)
      const activities = response.data || []
      
      // Transform activity data to ActivityItem format
      const transformedItems: ActivityItem[] = activities.map((activity: any) => {
        const actor = availableUsers.find((u) => u.id === activity.userId)
        const actorName = actor?.name || actor?.email || 'Unknown User'
        
        // Format summary based on action type
        let summary = ''
        if (activity.action === 'CHECK_IN' && activity.metadata?.checkIn) {
          summary = `Check-in: value ${activity.metadata.checkIn.value}, confidence ${activity.metadata.checkIn.confidence}/5`
        } else if (activity.action === 'UPDATED' && activity.metadata?.before && activity.metadata?.after) {
          const changes: string[] = []
          if (activity.metadata.before.progress !== activity.metadata.after.progress) {
            changes.push(`Progress ${activity.metadata.before.progress?.toFixed(0) || 0}% → ${activity.metadata.after.progress?.toFixed(0) || 0}%`)
          }
          if (activity.metadata.before.status !== activity.metadata.after.status) {
            changes.push(`Status ${activity.metadata.before.status} → ${activity.metadata.after.status}`)
          }
          if (activity.metadata.before.currentValue !== undefined && activity.metadata.after.currentValue !== undefined) {
            if (activity.metadata.before.currentValue !== activity.metadata.after.currentValue) {
              changes.push(`Value ${activity.metadata.before.currentValue} → ${activity.metadata.after.currentValue}`)
            }
          }
          if (activity.metadata.before.targetValue !== undefined && activity.metadata.after.targetValue !== undefined) {
            if (activity.metadata.before.targetValue !== activity.metadata.after.targetValue) {
              changes.push(`Target ${activity.metadata.before.targetValue} → ${activity.metadata.after.targetValue}`)
            }
          }
          summary = changes.length > 0 ? changes.join(', ') : 'Updated'
        } else {
          summary = activity.action
        }
        
        return {
          id: activity.id,
          timestamp: activity.createdAt,
          actorName,
          action: activity.action,
          summary,
        }
      })
      
      setActivityItems(transformedItems)
      setActivityEntityName(entityTitle || `${entityType} Activity`)
      setActivityDrawerOpen(true)
    } catch (error) {
      console.error('Failed to load activity:', error)
      toast({
        title: 'Failed to load activity',
        description: 'Could not load activity history',
        variant: 'destructive',
      })
    }
  }

  const handleCloseActivityDrawer = () => {
    setActivityDrawerOpen(false)
    setActivityItems([])
    setActivityEntityName('')
  }

  // Helper to normalise objective data for ObjectiveRow component
  // Maps unified overview endpoint response to ObjectiveRow props format
  function mapObjectiveData(rawObj: any, availableUsers: any[], activeCycles: any[], overdueCheckIns: Array<{ krId: string; objectiveId: string }>) {
    // Extract cycle info from unified response
    const cycle = rawObj.cycle || (rawObj.cycleId ? activeCycles.find(c => c.id === rawObj.cycleId) : null)
    const cycleName = cycle?.name ?? rawObj.cycleName ?? undefined
    const cycleStatus = cycle?.status ?? rawObj.cycleStatus ?? 'ACTIVE'
    
    // Build cycle label (e.g., "Q4 2025" or "Q1 2026 (draft)")
    let cycleLabel = cycleName || 'Unassigned'
    if (cycleStatus === 'DRAFT' && cycleName) {
      cycleLabel = `${cycleName} (draft)`
    }
    
    // Map key results from unified response (already includes nested initiatives)
    const keyResults = (rawObj.keyResults || []).map((kr: any): any => {
      // Check if this KR is overdue
      const isOverdue = overdueCheckIns.some(item => item.krId === kr.id)
      
      return {
        id: kr.id,
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
      }
    })
    
    // Use server-provided overdue count if available, otherwise compute from local state
    const overdueCountForObjective = rawObj.overdueCheckInsCount !== undefined 
      ? rawObj.overdueCheckInsCount 
      : keyResults.filter((kr: any) => kr.isOverdue).length
    
    // Use server-provided confidence if available
    const lowestConfidence = rawObj.latestConfidencePct !== undefined 
      ? rawObj.latestConfidencePct 
      : null
    
    // Map initiatives from unified response
    // Initiatives can be directly under objective or nested under key results
    const allInitiatives = [
      ...(rawObj.initiatives || []), // Direct objective initiatives
      ...(rawObj.keyResults || []).flatMap((kr: any) => 
        (kr.initiatives || []).map((init: any) => ({
          ...init,
          keyResultId: kr.id, // Ensure keyResultId is set
          keyResultTitle: kr.title, // Add KR title for display
        }))
      )
    ]
    
    // Deduplicate and map initiatives
    const initiatives = allInitiatives.map((init: any) => ({
      id: init.id,
      title: init.title,
      status: init.status,
      dueDate: init.dueDate,
      keyResultId: init.keyResultId,
      keyResultTitle: init.keyResultTitle,
    }))
    
    // Get owner from unified response or fallback to availableUsers
    const owner = rawObj.owner || availableUsers.find(u => u.id === rawObj.ownerId)
    
    return {
      id: rawObj.id,
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
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <PageHeader
                  title="Objectives & Key Results"
                  subtitle="Aligned execution. Live progress. Governance state at a glance."
                  badges={[
                    ...(selectedTimeframeLabel ? [
                      {
                        label: `Viewing: ${selectedTimeframeLabel}`,
                        tone: 'neutral' as const,
                      },
                    ] : []),
                    ...(activeCycles.length > 0
                      ? [
                          {
                            label: `Active Cycle: ${activeCycles[0].name}`,
                            tone: 'neutral' as const,
                          },
                        ]
                      : []),
                    ...(activeCycles.some((c) => c.status === 'LOCKED')
                      ? [{ label: 'Locked', tone: 'warning' as const }]
                      : []),
                    ...(okrs.filter((o) => o.status === 'AT_RISK').length > 0
                      ? [
                          {
                            label: `${okrs.filter((o) => o.status === 'AT_RISK').length} At Risk`,
                            tone: 'warning' as const,
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={() => setShowNewObjective(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Objective
                </Button>
                <button
                  className="text-[12px] font-medium text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                  onClick={() => router.push('/dashboard/builder')}
                  // TODO [phase7-hardening]: restrict Visual Builder to admin / strategy roles only
                >
                  Visual Builder
                </button>
              </div>
            </div>
            <p className="text-[13px] text-neutral-500 leading-relaxed mt-2">
              This view shows execution state. For planning or alignment storytelling, open the{' '}
              <Link
                href="/dashboard/builder"
                className="text-violet-700 hover:text-violet-900 font-medium underline underline-offset-2"
              >
                Visual Builder
              </Link>
              .
            </p>
          </div>

          {/* Active Cycle Banner */}
          {activeCycles.length > 0 && (
            <div className="mb-6">
              {activeCycles.map((cycle) => (
                <div key={cycle.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{cycle.name}</h3>
                          {getCycleStatusBadge(cycle.status)}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {formatCycleDate(cycle.startDate)} → {formatCycleDate(cycle.endDate)}
                        </p>
                        {cycle.status === 'LOCKED' && !permissions.isTenantAdminOrOwner(currentOrganization?.id) && (
                          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            This cycle is locked. You can't change targets in this period.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
                </div>
              ))}
            </div>
          )}

          {/* Sticky Filter and Pagination Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 mb-4 pb-4 -mx-8 px-8 pt-4">
            {/* Quick Status Chips */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  selectedStatus === null
                    ? "bg-violet-100 text-violet-700 border border-violet-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus(null)
                  setPage(1)
                }}
              >
                All statuses
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  selectedStatus === 'ON_TRACK'
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('ON_TRACK')
                  setPage(1)
                }}
              >
                On track
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  selectedStatus === 'AT_RISK'
                    ? "bg-amber-100 text-amber-700 border border-amber-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('AT_RISK')
                  setPage(1)
                }}
              >
                At risk
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  selectedStatus === 'BLOCKED'
                    ? "bg-rose-100 text-rose-700 border border-rose-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('BLOCKED')
                  setPage(1)
                }}
              >
                Blocked
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  selectedStatus === 'COMPLETED'
                    ? "bg-neutral-200 text-neutral-800 border border-neutral-400"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('COMPLETED')
                  setPage(1)
                }}
              >
                Completed
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  selectedStatus === 'CANCELLED'
                    ? "bg-neutral-200 text-neutral-800 border border-neutral-400"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('CANCELLED')
                  setPage(1)
                }}
              >
                Cancelled
              </button>
            </div>

            {/* Cycle Filter and Top Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3 text-sm text-neutral-700">
                <select
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={selectedCycleId ?? ''}
                  onChange={(e) => {
                    setSelectedCycleId(e.target.value || null)
                    setPage(1)
                  }}
                >
                  <option value="">All cycles</option>
                  {activeCycles.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Top Pagination Controls */}
              {totalCount > 0 && (
                <div className="flex items-center gap-4 text-sm text-neutral-700">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-600">Rows per page:</span>
                    <select
                      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={limit}
                      onChange={(e) => {
                        const newLimit = Number(e.target.value)
                        setLimit(newLimit)
                        setPage(1)
                      }}
                    >
                      {[5, 10, 25, 50].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      disabled={page <= 1}
                      onClick={() => {
                        setPage(p => Math.max(1, p - 1))
                      }}
                    >
                      ‹ Prev
                    </button>
                    <div className="tabular-nums text-neutral-600">
                      Page {page} of {Math.ceil(totalCount / limit) || 1}
                    </div>
                    <button
                      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      disabled={page >= Math.ceil(totalCount / limit)}
                      onClick={() => {
                        const totalPages = Math.ceil(totalCount / limit)
                        setPage(p => (p < totalPages ? p + 1 : p))
                      }}
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filters and Search */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search OKRs..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Select value={filterWorkspaceId} onValueChange={setFilterWorkspaceId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {workspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterTeamId} onValueChange={setFilterTeamId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterOwnerId} onValueChange={setFilterOwnerId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <CycleSelector
                cycles={normalizedCycles}
                legacyPeriods={legacyPeriods}
                selectedId={selectedTimeframeKey}
                onSelect={(opt: { key: string; label: string }) => {
                  setSelectedTimeframeKey(opt.key)
                  setSelectedTimeframeLabel(opt.label)
                }}
              />
              
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
            
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">Active filters:</span>
                {filterWorkspaceId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Workspace: {workspaces.find(w => w.id === filterWorkspaceId)?.name}
                  </Badge>
                )}
                {filterTeamId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Team: {teams.find(t => t.id === filterTeamId)?.name}
                  </Badge>
                )}
                {filterOwnerId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Owner: {availableUsers.find(u => u.id === filterOwnerId)?.name}
                  </Badge>
                )}
              </div>
            )}
            {/* [phase6-polish] Reintroduce compact multi-column grid view for exec scanning. */}
          </div>

          {/* OKRs Grid/List */}
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading OKRs...</div>
          ) : permissionError ? (
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
          ) : filteredOKRs.length === 0 ? (
            <div className="text-center py-12">
              {objectivesViewModel.filter(canSeeObjective).length === 0 ? (
                <div className="border border-dashed border-neutral-300 rounded-xl bg-white/50 text-center p-8">
                  <p className="font-medium text-neutral-700 mb-1">No Objectives yet</p>
                  <p className="text-sm text-neutral-500 mb-3">Start by defining your first Objective.</p>
                  <button
                    className="text-violet-700 hover:text-violet-900 underline underline-offset-2 font-medium text-sm"
                    onClick={() => setShowNewObjective(true)}
                  >
                    + New Objective
                  </button>
                  {/* TODO [phase6-polish]: Fade-in animation when first Objective appears. */}
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm text-neutral-600">
                  {selectedTimeframeKey === 'unassigned' ? (
                    <p>No objectives are currently unassigned to a planning cycle.</p>
                  ) : selectedTimeframeKey && selectedTimeframeKey !== 'all' ? (
                    <p>No objectives defined for {selectedTimeframeLabel} yet.</p>
                  ) : (
                    <>
                      <p className="mb-4">No OKRs found</p>
                      {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                          Clear filters to see all OKRs
                        </Button>
                      )}
                    </>
                  )}
                  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {/* Needs attention group */}
              {groupedObjectives.needsAttentionObjectives.length > 0 && (
                <div>
                  <SectionHeader tone="bad" label="Needs attention" />
                  <div className="space-y-4 md:space-y-6">
                    {groupedObjectives.needsAttentionObjectives.map((okr) => {
                      return renderObjectiveRow(okr)
                    })}
                  </div>
                </div>
              )}

              {/* Active Objectives group */}
              {groupedObjectives.activeObjectives.length > 0 && (
                <div>
                  <SectionHeader tone="good" label="Active objectives" />
                  <div className="space-y-4 md:space-y-6">
                    {groupedObjectives.activeObjectives.map((okr) => {
                      return renderObjectiveRow(okr)
                    })}
                  </div>
                </div>
              )}

              {/* Completed / Archived group */}
              {groupedObjectives.completedObjectives.length > 0 && (
                <div>
                  <SectionHeader tone="neutral" label="Completed / archived" />
                  <div className="space-y-4 md:space-y-6">
                    {groupedObjectives.completedObjectives.map((okr) => {
                      return renderObjectiveRow(okr)
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-neutral-200 pt-4 text-sm text-neutral-700 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Rows per page:</span>
                <select
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={limit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value)
                    setLimit(newLimit)
                    setPage(1)
                  }}
                >
                  {[5, 10, 25, 50].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <button
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage(p => Math.max(1, p - 1))
                  }}
                >
                  ‹ Prev
                </button>
                <div className="tabular-nums text-neutral-600">
                  Page {page} of {Math.ceil(totalCount / limit) || 1}
                </div>
                <button
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  disabled={page >= Math.ceil(totalCount / limit)}
                  onClick={() => {
                    const totalPages = Math.ceil(totalCount / limit)
                    setPage(p => (p < totalPages ? p + 1 : p))
                  }}
                >
                  Next ›
                </button>
              </div>
            </div>
          )}

          {/* Activity Timeline Drawer */}
          {/* TODO [phase7-performance]: pass pagination cursor + load handler once backend supports it. */}
          <ActivityDrawer
            isOpen={activityDrawerOpen}
            onClose={handleCloseActivityDrawer}
            items={Array.isArray(activityItems) ? activityItems : []}
            entityName={activityEntityName || 'Activity'}
            hasMore={false}
          />

          {/* Publish Lock Warning Dialog */}
          {selectedObjectiveForLock && (() => {
            const objectiveForHook = {
              id: selectedObjectiveForLock.id,
              ownerId: selectedObjectiveForLock.ownerId,
              organizationId: selectedObjectiveForLock.organizationId,
              workspaceId: selectedObjectiveForLock.workspaceId,
              teamId: selectedObjectiveForLock.teamId,
              isPublished: selectedObjectiveForLock.isPublished,
              cycle: selectedObjectiveForLock.cycleId && activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)
                ? { id: selectedObjectiveForLock.cycleId, status: activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)!.status }
                : null,
              cycleStatus: selectedObjectiveForLock.cycleId && activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)
                ? activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)!.status
                : null,
            }
            const lockInfo = tenantPermissions.getLockInfoForObjective(objectiveForHook)
            // TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
            const lockMessage = lockInfo.message || 'This item is locked and cannot be changed in the current cycle.'
            
            return (
              <PublishLockWarningModal
                open={publishLockDialogOpen}
                onClose={() => {
                  setPublishLockDialogOpen(false)
                  setSelectedObjectiveForLock(null)
                }}
                lockReason={lockInfo.reason}
                lockMessage={lockMessage}
                entityName={selectedObjectiveForLock.title}
              />
            )
          })()}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!pendingDeleteOkr} onOpenChange={(open) => !open && setPendingDeleteOkr(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete OKR</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{pendingDeleteOkr?.title}"? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingDeleteOkr(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteOKR} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* New Objective Modal */}
          <NewObjectiveModal
            isOpen={showNewObjective}
            onClose={() => setShowNewObjective(false)}
            onSubmit={async (formData) => {
              try {
                // API: create objective
                const res = await api.post('/objectives', formData)
                const created = res.data
                
                // Map to view model and optimistic merge (prepend newest)
                const createdViewModel = mapObjectiveToViewModel(created)
                setOkrs((prev) => [createdViewModel, ...prev])
                
                // TODO [phase6-polish]: toast "Objective created"
                setShowNewObjective(false)
              } catch (err) {
                // TODO [phase7-hardening]: map backend validation errors to field-level messages.
                console.error('Failed to create objective', err)
                // TODO [phase6-polish]: surface inline form error state
              }
            }}
            availableUsers={availableUsers}
            availableWorkspaces={workspaces}
            availableCycles={normalizedCycles}
            availablePillars={[]}
          />

          {/* Edit Objective Modal */}
          <EditObjectiveModal
            isOpen={showEditObjective}
            objectiveId={editObjectiveId}
            objectiveData={editObjectiveData}
            onClose={() => {
              setShowEditObjective(false)
              setEditObjectiveId(null)
              setEditObjectiveData(null)
            }}
            onSubmit={async (formData) => {
              if (!editObjectiveId) return
              try {
                // API: update objective
                const res = await api.patch(`/objectives/${editObjectiveId}`, formData)
                const updated = res.data
                
                // Optimistically update objective in local state
                setOkrs((prev) =>
                  prev.map((obj) => {
                    if (obj.id !== editObjectiveId) return obj
                    return {
                      ...obj,
                      title: updated.title || obj.title,
                      ownerId: updated.ownerId || obj.ownerId,
                      workspaceId: updated.workspaceId || obj.workspaceId,
                      cycleId: updated.cycleId || obj.cycleId,
                      status: updated.status || obj.status,
                      visibilityLevel: updated.visibilityLevel || obj.visibilityLevel,
                      pillarId: updated.pillarId || obj.pillarId,
                    }
                  })
                )
                
                setShowEditObjective(false)
                setEditObjectiveId(null)
                setEditObjectiveData(null)
              } catch (err) {
                // TODO [phase7-hardening]: map backend validation errors to field-level messages.
                console.error('Failed to update objective', err)
                // TODO [phase6-polish]: surface inline form error state
              }
            }}
            availableUsers={availableUsers}
            availableWorkspaces={workspaces}
            availableCycles={normalizedCycles}
            availablePillars={[]}
          />

          {/* New Check-in Modal */}
          <NewCheckInModal
            isOpen={showNewCheckIn}
            keyResultId={activeCheckInKrId ?? ''}
            onClose={() => {
              setShowNewCheckIn(false)
              setActiveCheckInKrId(null)
            }}
            onSubmit={async (formData) => {
              if (!activeCheckInKrId) return
              try {
                // API: create check-in
                const res = await api.post(`/key-results/${activeCheckInKrId}/check-in`, formData)
                const _createdCheckIn = res.data
                
                // Optimistically update KR in local state
                setOkrs((prev) =>
                  prev.map((obj) => {
                    const updatedKeyResults = (obj.keyResults || []).map((kr: any) => {
                      const krId = kr.keyResult?.id || kr.id
                      if (krId !== activeCheckInKrId) return kr
                      
                      // Update currentValue and progress
                      const updatedKr = kr.keyResult
                        ? {
                            ...kr,
                            keyResult: {
                              ...kr.keyResult,
                              currentValue: formData.value,
                              progress: kr.keyResult.targetValue > 0
                                ? Math.min(100, Math.round((formData.value / kr.keyResult.targetValue) * 100))
                                : kr.keyResult.progress,
                            },
                          }
                        : {
                            ...kr,
                            currentValue: formData.value,
                            progress: kr.targetValue > 0
                              ? Math.min(100, Math.round((formData.value / kr.targetValue) * 100))
                              : kr.progress,
                          }
                      
                      return updatedKr
                    })
                    
                    return {
                      ...obj,
                      keyResults: updatedKeyResults,
                    }
                  })
                )
                
                setShowNewCheckIn(false)
                setActiveCheckInKrId(null)
              } catch (err) {
                // TODO [phase7-hardening]: map backend validation errors to field-level messages.
                console.error('Failed to create check-in', err)
                // TODO [phase6-polish]: surface inline form error state
              }
            }}
          />

          {/* New Key Result Modal */}
          <NewKeyResultModal
            isOpen={showNewKeyResult}
            objectiveId={krParentObjectiveId ?? ''}
            objectiveName={krParentObjectiveName ?? ''}
            onClose={() => {
              setShowNewKeyResult(false)
              setKrParentObjectiveId(null)
              setKrParentObjectiveName(null)
            }}
            onSubmit={async (formData) => {
              try {
                const payload = { ...formData }
                const res = await api.post('/key-results', payload)
                const createdKr = res.data
                
                // Merge KR into that objective in local state (optimistic update)
                setOkrs((prev) =>
                  prev.map((obj) => {
                    if (obj.id !== formData.objectiveId) return obj
                    
                    // Handle nested keyResults structure (keyResults is array of { keyResult: {...} })
                    const existingKeyResults = obj.keyResults || []
                    const newKeyResultEntry = Array.isArray(existingKeyResults) && existingKeyResults.length > 0 && existingKeyResults[0]?.keyResult
                      ? { keyResult: createdKr }
                      : createdKr
                    
                    return {
                      ...obj,
                      keyResults: [...existingKeyResults, newKeyResultEntry],
                    }
                  })
                )
                
                setShowNewKeyResult(false)
                setKrParentObjectiveId(null)
                setKrParentObjectiveName(null)
                // TODO [phase6-polish]: toast "Key Result added"
              } catch (err) {
                // TODO [phase7-hardening]: map backend validation errors to field-level messages.
                console.error('Failed to create key result', err)
                // TODO [phase6-polish]: surface inline form error state
              }
            }}
            availableUsers={availableUsers}
          />

          {/* New Initiative Modal */}
          <NewInitiativeModal
            isOpen={showNewInitiative}
            objectiveId={initiativeParentObjectiveId ?? undefined}
            keyResultId={initiativeParentKeyResultId ?? undefined}
            parentName={initiativeParentName ?? undefined}
            onClose={() => {
              setShowNewInitiative(false)
              setInitiativeParentObjectiveId(null)
              setInitiativeParentKeyResultId(null)
              setInitiativeParentName(null)
            }}
            onSubmit={async (formData) => {
              try {
                const payload = {
                  ...formData,
                  objectiveId: initiativeParentObjectiveId ?? undefined,
                  keyResultId: initiativeParentKeyResultId ?? undefined,
                }
                const res = await api.post('/initiatives', payload)
                const createdInit = res.data
                
                // Optimistic merge:
                // If this initiative is under a KR, put it under that KR.
                // Else attach it at objective level.
                setOkrs((prev) =>
                  prev.map((obj) => {
                    // If it's under objective:
                    if (initiativeParentObjectiveId && obj.id === initiativeParentObjectiveId) {
                      return {
                        ...obj,
                        initiatives: [...(obj.initiatives || []), createdInit],
                      }
                    }
                    
                    // If it's under a KR inside the objective:
                    if (initiativeParentKeyResultId) {
                      return {
                        ...obj,
                        keyResults: (obj.keyResults || []).map((kr: any) => {
                          // Handle nested structure: kr.keyResult.id or kr.id
                          const krId = kr.keyResult?.id || kr.id
                          if (krId !== initiativeParentKeyResultId) return kr
                          
                          const updatedKr = kr.keyResult 
                            ? { ...kr, keyResult: { ...kr.keyResult, initiatives: [...(kr.keyResult.initiatives || []), createdInit] } }
                            : { ...kr, initiatives: [...(kr.initiatives || []), createdInit] }
                          
                          return updatedKr
                        }),
                      }
                    }
                    
                    return obj
                  })
                )
                
                setShowNewInitiative(false)
                setInitiativeParentObjectiveId(null)
                setInitiativeParentKeyResultId(null)
                setInitiativeParentName(null)
                // TODO [phase6-polish]: toast "Initiative added"
              } catch (err) {
                // TODO [phase7-hardening]: map backend validation errors to field-level messages.
                console.error('Failed to create initiative', err)
                // TODO [phase6-polish]: surface inline form error state
              }
            }}
            availableUsers={availableUsers}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

