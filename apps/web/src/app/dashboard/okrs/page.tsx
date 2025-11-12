/**
 * Performance Budgets (W5.M3)
 * 
 * Page-level budgets:
 * - First list render: ≤ 150ms for 20 items (dev mode tolerance allowed)
 * - Scroll frame: no long tasks > 50ms during windowed list scroll
 * - Drawer open: content interactive ≤ 120ms
 * - Objective insight fetch: show skeleton within 50ms; render < 16ms when data arrives
 * 
 * Bundle/RT budgets (non-failing warnings):
 * - OKR page chunk ≤ 180 KB gz (if measurable with existing tooling)
 * 
 * Virtualisation tuning:
 * - IntersectionObserver thresholds: rootMargin '200px', row prefetch buffer = 2 screenfuls
 * - Avoid re-creating observers per row; centralise hook
 */

'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
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
import { Plus, X } from 'lucide-react'
// W4.M1: Period utilities removed - Cycle is canonical
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { OKRPageContainer } from './OKRPageContainer'
import { OKRTreeContainer } from './OKRTreeContainer'
import { ActivityDrawer, ActivityItem } from '@/components/ui/ActivityDrawer'
import { PublishLockWarningModal } from './components/PublishLockWarningModal'
import { NewObjectiveModal } from '@/components/okr/NewObjectiveModal'
import { EditObjectiveModal } from '@/components/okr/EditObjectiveModal'
import { EditKeyResultDrawer } from '@/components/okr/EditKeyResultDrawer'
import { NewKeyResultModal } from '@/components/okr/NewKeyResultModal'
import { NewCheckInModal } from '@/components/okr/NewCheckInModal'
import { NewInitiativeModal } from '@/components/okr/NewInitiativeModal'
import { OKRCreationDrawer } from './components/OKRCreationDrawer'
import { CycleHealthStrip } from '@/components/okr/CycleHealthStrip'
import { AttentionDrawer } from '@/components/okr/AttentionDrawer'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { OKRFilterBar } from './components/OKRFilterBar'
import { OKRToolbar } from './components/OKRToolbar'
import { GovernanceStatusBar } from './components/GovernanceStatusBar'
import { CycleManagementDrawer } from './components/CycleManagementDrawer'

// NOTE: This screen is now the system of record for CRUD on Objectives, Key Results, and Initiatives.
export default function OKRsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { okrTreeView } = useFeatureFlags()
  
  
  // View mode: 'list' or 'tree' (only if feature flag enabled)
  const viewMode = okrTreeView && searchParams.get('view') === 'tree' ? 'tree' : 'list'
  
  const setViewMode = (mode: 'list' | 'tree') => {
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'tree') {
      params.set('view', 'tree')
      track('okr.tree.toggle', {
        view: 'tree',
        timestamp: new Date().toISOString(),
      })
    } else {
      params.delete('view')
    }
    router.push(`/dashboard/okrs?${params.toString()}`)
  }
  
  // [phase6-polish] Reintroduce compact multi-column grid view for exec scanning.
  const [_viewMode, _setViewMode] = useState<'grid' | 'list'>('list')
  // W4.M1: Period removed - Cycle is canonical
  
  // Read filter=overdue from URL
  const filterOverdue = searchParams.get('filter') === 'overdue'
  
  // Filter states
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>('all')
  const [filterTeamId, setFilterTeamId] = useState<string>('all')
  const [filterOwnerId, setFilterOwnerId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // New filter states with URL persistence
  const myOkrsOnly = searchParams.get('myOkrs') === 'true'
  const selectedVisibility = (searchParams.get('visibility') as 'ALL' | 'PUBLIC_TENANT' | 'PRIVATE') || 'ALL'
  const selectedOwnerIdFromUrl = searchParams.get('ownerId')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(selectedOwnerIdFromUrl || null)
  const selectedPillarIdFromUrl = searchParams.get('pillarId')
  const [selectedPillarId, setSelectedPillarId] = useState<string | null>(selectedPillarIdFromUrl || null)
  const [availablePillars, setAvailablePillars] = useState<Array<{ id: string; name: string; color: string | null }>>([])
  
  // Sync ownerId from URL
  useEffect(() => {
    if (selectedOwnerIdFromUrl) {
      setSelectedOwnerId(selectedOwnerIdFromUrl)
    } else if (!selectedOwnerIdFromUrl && selectedOwnerId) {
      // URL cleared but state still has value - clear state
      setSelectedOwnerId(null)
    }
  }, [selectedOwnerIdFromUrl])

  // Sync pillarId from URL
  useEffect(() => {
    if (selectedPillarIdFromUrl) {
      setSelectedPillarId(selectedPillarIdFromUrl)
    } else if (!selectedPillarIdFromUrl && selectedPillarId) {
      // URL cleared but state still has value - clear state
      setSelectedPillarId(null)
    }
  }, [selectedPillarIdFromUrl])

  // Load available pillars for filter chips
  useEffect(() => {
    api.get('/pillars')
      .then((res) => {
        setAvailablePillars(res.data || [])
      })
      .catch((err) => {
        console.error('Failed to load pillars:', err)
      })
  }, [])
  
  const { workspaces, teams, currentOrganization, isSuperuser } = useWorkspace()
  const { user } = useAuth()
  const permissions = usePermissions()
  
  // Memoize the tenant admin check for the current organization to avoid repeated calls
  const isTenantAdminForCurrentOrg = useMemo(() => {
    if (!currentOrganization?.id) return false
    if (isSuperuser || permissions.isSuperuser) return true
    
    // Check if user has TENANT_OWNER or TENANT_ADMIN role for this organization
    const tenantRoles = permissions.rolesByScope?.tenant?.find(
      (t) => t.tenantId === currentOrganization.id
    )
    return tenantRoles !== undefined && (
      tenantRoles.roles.includes('TENANT_OWNER') || 
      tenantRoles.roles.includes('TENANT_ADMIN')
    )
  }, [permissions.rolesByScope, permissions.isSuperuser, currentOrganization?.id, isSuperuser])
  
  // Scope toggle: My | Team/Workspace | Tenant
  const availableScopes = useMemo(() => {
    const scopes: Array<'my' | 'team-workspace' | 'tenant'> = []
    
    // "My" is always available
    scopes.push('my')
    
    // "Team/Workspace" if user has WORKSPACE_* or TEAM_* roles
    const hasWorkspaceRole = permissions.rolesByScope?.workspace?.some(
      (w: any) => w.roles.some((r: string) => r.startsWith('WORKSPACE_'))
    )
    const hasTeamRole = permissions.rolesByScope?.team?.some(
      (t: any) => t.roles.some((r: string) => r.startsWith('TEAM_'))
    )
    if (hasWorkspaceRole || hasTeamRole) {
      scopes.push('team-workspace')
    }
    
    // "Tenant" if user has any tenant-level role (TENANT_VIEWER, TENANT_ADMIN, TENANT_OWNER) or SUPERUSER
    // TENANT_VIEWER should be able to see all tenant OKRs (read-only)
    if (currentOrganization?.id) {
      const tenantRoles = permissions.rolesByScope?.tenant?.find(
        (t) => t.tenantId === currentOrganization.id
      )
      const hasTenantRole = tenantRoles !== undefined && tenantRoles.roles.length > 0
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('[OKR Page] Tenant scope check:', {
          currentOrgId: currentOrganization.id,
          tenantRoles: tenantRoles,
          hasTenantRole,
          isSuperuser,
          permissionsIsSuperuser: permissions.isSuperuser,
          isTenantAdminForCurrentOrg,
          allTenantRoles: permissions.rolesByScope?.tenant,
        })
      }
      
      if (hasTenantRole || isSuperuser || permissions.isSuperuser || isTenantAdminForCurrentOrg) {
        scopes.push('tenant')
      }
    }
    
    return scopes
  }, [permissions.rolesByScope, isTenantAdminForCurrentOrg, currentOrganization?.id, isSuperuser, permissions.isSuperuser])
  
  // Read scope from URL or determine default
  const scopeFromUrl = searchParams.get('scope') as 'my' | 'team-workspace' | 'tenant' | null
  const defaultScope = useMemo(() => {
    // If URL has scope and it's valid, use it
    if (scopeFromUrl && availableScopes.includes(scopeFromUrl)) {
      return scopeFromUrl
    }
    // Otherwise, default based on available scopes
    if (availableScopes.includes('my')) {
      return 'my'
    } else if (availableScopes.includes('team-workspace')) {
      return 'team-workspace'
    } else if (availableScopes.includes('tenant')) {
      return 'tenant'
    }
    return 'my' // fallback
  }, [availableScopes, scopeFromUrl])
  
  const [selectedScope, setSelectedScope] = useState<'my' | 'team-workspace' | 'tenant'>(defaultScope)
  
  // Sync scope from URL on mount/change
  useEffect(() => {
    if (scopeFromUrl && availableScopes.includes(scopeFromUrl)) {
      setSelectedScope(scopeFromUrl)
    }
  }, [scopeFromUrl, availableScopes])
  
  const handleMyOkrsToggle = (enabled: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (enabled) {
      params.set('myOkrs', 'true')
      // Clear ownerId filter when My OKRs is enabled (My OKRs replaces owner filter)
      params.delete('ownerId')
      setSelectedOwnerId(null)
    } else {
      params.delete('myOkrs')
    }
    router.push(`/dashboard/okrs?${params.toString()}`)
  }

  const handleVisibilityChange = (visibility: 'ALL' | 'PUBLIC_TENANT' | 'PRIVATE') => {
    const params = new URLSearchParams(searchParams.toString())
    if (visibility === 'ALL') {
      params.delete('visibility')
    } else {
      params.set('visibility', visibility)
    }
    router.push(`/dashboard/okrs?${params.toString()}`)
  }

  const handleOwnerChange = (ownerId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    // If My OKRs is enabled, disable it when user selects a different owner
    if (myOkrsOnly) {
      params.delete('myOkrs')
    }
    if (ownerId === 'me' && user?.id) {
      params.set('ownerId', user.id)
      setSelectedOwnerId(user.id)
    } else if (ownerId) {
      params.set('ownerId', ownerId)
      setSelectedOwnerId(ownerId)
    } else {
      params.delete('ownerId')
      setSelectedOwnerId(null)
    }
    router.push(`/dashboard/okrs?${params.toString()}`)
  }

  const handlePillarChange = (pillarId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (pillarId) {
      params.set('pillarId', pillarId)
      setSelectedPillarId(pillarId)
    } else {
      params.delete('pillarId')
      setSelectedPillarId(null)
    }
    router.push(`/dashboard/okrs?${params.toString()}`)
  }
  
  const handleScopeChange = (newScope: 'my' | 'team-workspace' | 'tenant') => {
    const previousScope = selectedScope
    setSelectedScope(newScope)
    const params = new URLSearchParams(searchParams.toString())
    params.set('scope', newScope)
    router.push(`/dashboard/okrs?${params.toString()}`)
    
    // Telemetry: scope toggle
    track('scope_toggle', {
      scope: newScope,
      prev_scope: previousScope,
      cycle_id: selectedCycleId,
      ts: new Date().toISOString(),
    })
  }
  const { canSeeObjective, ...tenantPermissions } = useTenantPermissions()
  const { toast } = useToast()
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [overdueCheckIns, setOverdueCheckIns] = useState<Array<{ krId: string; objectiveId: string }>>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [activityEntityName, setActivityEntityName] = useState('')
  const [publishLockDialogOpen, setPublishLockDialogOpen] = useState(false)
  const [selectedObjectiveForLock, setSelectedObjectiveForLock] = useState<any | null>(null)
  const [pendingDeleteOkr, setPendingDeleteOkr] = useState<{ id: string; title: string } | null>(null)
  const [expandedObjectiveId, setExpandedObjectiveId] = useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const [attentionDrawerOpen, setAttentionDrawerOpen] = useState(false)
  const [attentionCount, setAttentionCount] = useState<number>(0)
  const attentionTelemetryFiredRef = useRef<Set<string>>(new Set())
  const [liveRegionMessage, setLiveRegionMessage] = useState<string | null>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const [cycleManagementDrawerOpen, setCycleManagementDrawerOpen] = useState(false)
  // Tree view state
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null)
  const [selectedTreeNodeType, setSelectedTreeNodeType] = useState<'objective' | 'keyResult' | 'initiative' | null>(null)
  const [activeCycles, setActiveCycles] = useState<Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    tenantId: string
  }>>([])
  
  // Objective creation
  const [showNewObjective, setShowNewObjective] = useState(false)
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [canCreateObjective, setCanCreateObjective] = useState<boolean>(false)
  const [creationDrawerMode, setCreationDrawerMode] = useState<'objective' | 'kr' | 'initiative'>('objective')
  // Story 5: Parent context for contextual creation
  const [creationDrawerParentContext, setCreationDrawerParentContext] = useState<{
    type: 'objective' | 'kr'
    id: string
    title: string
  } | undefined>()
  
  // Objective editing
  const [showEditObjective, setShowEditObjective] = useState(false)
  const [editObjectiveId, setEditObjectiveId] = useState<string | null>(null)
  const [editObjectiveData, setEditObjectiveData] = useState<any | null>(null)
  const [showEditKeyResult, setShowEditKeyResult] = useState(false)
  const [editKeyResultId, setEditKeyResultId] = useState<string | null>(null)
  const [editKeyResultData, setEditKeyResultData] = useState<any | null>(null)
  
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
  // W4.M1: Period removed - only use cycleId/cycleName
  const mapObjectiveToViewModel = (rawObjective: any): any => {
    let timeframeKey: string = 'unassigned'
    
    // Priority 1: cycleId (canonical)
    if (rawObjective.cycleId) {
      timeframeKey = rawObjective.cycleId
    }
    // Priority 2: cycleName (fallback)
    else if (rawObjective.cycleName) {
      timeframeKey = normaliseLabelToKey(rawObjective.cycleName)
    }
    // Priority 3: cycle object (from API response)
    else if (rawObjective.cycle?.id) {
      timeframeKey = rawObjective.cycle.id
    }
    // Priority 4: fallback to 'unassigned'
    
    return {
      ...rawObjective,
      timeframeKey,
    }
  }
  
  // Track if we've initialized the cycle selection (only set default once per org)
  const cycleInitializedRef = useRef(false)
  const lastOrgIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Reset cycle initialization when organization changes
    if (currentOrganization?.id !== lastOrgIdRef.current) {
      cycleInitializedRef.current = false
      lastOrgIdRef.current = currentOrganization?.id || null
      // Reset cycle selection when org changes
      setSelectedCycleId(null)
      setSelectedTimeframeKey('all')
      setSelectedTimeframeLabel('All cycles')
    }
    // Initialization - only run when org/user changes, not when cycle/scope changes
    loadUsers()
    loadActiveCycles()
  }, [currentOrganization?.id, user])

  useEffect(() => {
    // Load data that depends on cycle/scope selection
    loadOverdueCheckIns()
    loadAttentionCount()
  }, [currentOrganization?.id, user, selectedCycleId, selectedScope])
  
  
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
      // First try to load all cycles (includes ACTIVE, DRAFT, ARCHIVED)
      const response = await api.get('/reports/cycles')
      const cycles = response.data || []
      setActiveCycles(cycles)
      // NOTE: Only set default cycle selection on initial load (when no cycle is selected yet)
      // This prevents resetting the user's selection when they choose "All Cycles"
      if (!cycleInitializedRef.current && (selectedCycleId === null || selectedTimeframeKey === 'all')) {
        const activeCycle = cycles.find((c: any) => c.status === 'ACTIVE') || cycles[0]
        if (activeCycle) {
          setSelectedTimeframeKey(activeCycle.id)
          setSelectedTimeframeLabel(activeCycle.name)
          setSelectedCycleId(activeCycle.id) // Sync for CycleHealthStrip and AttentionDrawer
          cycleInitializedRef.current = true
        }
      }
    } catch (error: any) {
      // If /reports/cycles fails, fallback to /reports/cycles/active for backward compatibility
      try {
        const response = await api.get('/reports/cycles/active')
        const cycles = response.data || []
        setActiveCycles(cycles)
        if (cycles.length > 0 && !cycleInitializedRef.current && (selectedCycleId === null || selectedTimeframeKey === 'all')) {
          setSelectedTimeframeKey(cycles[0].id)
          setSelectedTimeframeLabel(cycles[0].name)
          setSelectedCycleId(cycles[0].id)
          cycleInitializedRef.current = true
        }
      } catch (fallbackError: any) {
        // Cycles endpoint is optional - gracefully degrade if no permission
        if (fallbackError.response?.status !== 403) {
          console.error('Failed to load cycles:', fallbackError)
        }
        setActiveCycles([])
      }
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

  const loadAttentionCount = async () => {
    if (!selectedCycleId) {
      setAttentionCount(0)
      return
    }
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '1', // We only need the totalCount
      })
      params.append('cycleId', selectedCycleId)
      // Note: Backend filters by scope automatically via user context
      // Including scope param for clarity and future-proofing
      if (selectedScope) {
        params.append('scope', selectedScope)
      }
      
      const response = await api.get(`/okr/insights/attention?${params.toString()}`)
      const count = response.data?.totalCount || 0
      setAttentionCount(count)
      
      // Telemetry: fire once per unique scope+cycle combination (per mount)
      const telemetryKey = `${selectedScope}-${selectedCycleId}`
      if (!attentionTelemetryFiredRef.current.has(telemetryKey)) {
        track('attention_badge_loaded', {
          scope: selectedScope,
          cycle_id: selectedCycleId,
          count,
          ts: new Date().toISOString(),
        })
        attentionTelemetryFiredRef.current.add(telemetryKey)
      }
    } catch (error: any) {
      // Attention endpoint is optional - gracefully degrade
      if (error.response?.status !== 403) {
        console.error('Failed to load attention count:', error)
      }
      setAttentionCount(0)
    }
  }

  // W4.M1: Transform cycles for CycleSelector (map startDate/endDate to startsAt/endsAt)
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

  // W4.M1: Legacy periods removed - only cycles are canonical
  const legacyPeriods: Array<{ id: string; label: string }> = []

  // State for timeframe selection (key and label)
  // W4.M1: Only cycles, no periods
  const [selectedTimeframeKey, setSelectedTimeframeKey] = useState<string | null>(() => {
    if (normalizedCycles.length > 0) return normalizedCycles[0].id
    return 'all' // Default to 'all' if no cycles available
  })
  const [selectedTimeframeLabel, setSelectedTimeframeLabel] = useState<string>(() => {
    if (normalizedCycles.length > 0) return normalizedCycles[0].name
    return 'All cycles'
  })
  
  // Legacy selectedId for backwards compatibility during transition
  const _selectedId = selectedTimeframeKey
  
  
  const clearFilters = () => {
    setFilterWorkspaceId('all')
    setFilterTeamId('all')
    setFilterOwnerId('all')
    setSearchQuery('')
    // Clear URL-based filters
    const params = new URLSearchParams(searchParams.toString())
    params.delete('myOkrs')
    params.delete('visibility')
    params.delete('ownerId')
    router.push(`/dashboard/okrs?${params.toString()}`)
  }
  
  const hasActiveFilters = filterWorkspaceId !== 'all' || filterTeamId !== 'all' || filterOwnerId !== 'all' || searchQuery.length > 0 || myOkrsOnly || selectedVisibility !== 'ALL' || selectedOwnerId !== null || selectedPillarId !== null;

  const handleEditKeyResult = (krId: string) => {
    // Find the KR in the objectives data
    const findKR = (objectives: any[]): any => {
      for (const obj of objectives) {
        if (obj.keyResults) {
          for (const krJunction of obj.keyResults) {
            const kr = krJunction.keyResult || krJunction
            if (kr.id === krId) {
              return {
                ...kr,
                tenantId: obj.tenantId,
                objectiveIds: [obj.id],
              }
            }
          }
        }
      }
      return null
    }

    // Try to find KR in current data (if available)
    // For now, we'll load it from the API when drawer opens
    setEditKeyResultId(krId)
    setEditKeyResultData(null) // Will be loaded by drawer
    setShowEditKeyResult(true)
  }

  const handleEditOKR = (okr: any) => {
    const objectiveForHook = okr.objectiveForHook || {
      id: okr.id,
      ownerId: okr.ownerId,
      tenantId: okr.tenantId,
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
    
    const canEdit = tenantPermissions.canEditObjective(objectiveForHook)
    
    if (!canEdit) {
      const lockInfo = tenantPermissions.getLockInfoForObjective(objectiveForHook)
      // Only show lock modal if actually locked - tenant admins should not see this
      if (lockInfo.isLocked) {
        setSelectedObjectiveForLock(okr)
        setPublishLockDialogOpen(true)
        return
      }
      // If not locked but can't edit, it's an RBAC or visibility issue - skip modal
      console.warn('[handleEditOKR] Cannot edit but not locked:', {
        objectiveId: okr.id,
        isPublished: okr.isPublished,
        visibilityLevel: okr.visibilityLevel,
        tenantId: okr.tenantId,
        lockInfo
      })
      return
    }
    
    setEditObjectiveId(okr.id)
    setEditObjectiveData({
      title: okr.title,
      ownerId: okr.ownerId,
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      tenantId: okr.organizationId,
      cycleId: okr.cycleId,
      status: okr.status,
      visibilityLevel: okr.visibilityLevel,
      isPublished: okr.isPublished,
      pillarId: okr.pillarId,
    })
    setShowEditObjective(true)
  }
  
  // Handler for tree node clicks - opens edit modal for objectives
  const handleTreeNodeClick = (nodeId: string, nodeType: 'objective' | 'keyResult' | 'initiative') => {
    setSelectedTreeNodeId(nodeId)
    setSelectedTreeNodeType(nodeType)
    
    // For objectives, open edit modal
    if (nodeType === 'objective') {
      // Find the objective in the prepared objectives
      // This is a simplified handler - in production, we'd fetch the objective or use a lookup
      handleEditOKR({ id: nodeId } as any)
    }
    // For KRs and Initiatives, we could expand their parent objective
    // For now, we'll just set the selection state
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
  
  const handleAddInitiativeToKrClick = (krId: string, krTitle: string, objectiveId: string) => {
    setInitiativeParentObjectiveId(objectiveId)
    setInitiativeParentKeyResultId(krId)
    setInitiativeParentName(krTitle)
    setShowNewInitiative(true)
  }

  // Story 5: Contextual Add menu handlers
  const handleOpenContextualAddMenu = (_objectiveId: string) => {
    // Telemetry handler for contextual add menu
  }

  const handleContextualAddKeyResult = (objectiveId: string, objectiveTitle: string) => {
    setCreationDrawerMode('kr')
    setCreationDrawerParentContext({
      type: 'objective',
      id: objectiveId,
      title: objectiveTitle,
    })
    setIsCreateDrawerOpen(true)
  }

  const handleContextualAddInitiative = (objectiveId: string, objectiveTitle: string) => {
    setCreationDrawerMode('initiative')
    setCreationDrawerParentContext({
      type: 'objective',
      id: objectiveId,
      title: objectiveTitle,
    })
    setIsCreateDrawerOpen(true)
  }
  
  const handleToggleObjective = (id: string) => {
    setExpandedObjectiveId(prev => (prev === id ? null : id))
  }

  
  const handleAddCheckIn = (krId: string) => {
    // [phase5-core:done] implemented NewCheckInModal and wired POST /api/check-ins
    setActiveCheckInKrId(krId)
    setShowNewCheckIn(true)
  }

  const handleDeleteOKR = async (okr: any) => {
    const objectiveForHook = okr.objectiveForHook || {
      id: okr.id,
      ownerId: okr.ownerId,
      tenantId: okr.tenantId,
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
    
    const canDelete = tenantPermissions.canDeleteObjective(objectiveForHook)
    
    if (!canDelete) {
      tenantPermissions.getLockInfoForObjective(objectiveForHook)
      setSelectedObjectiveForLock(okr)
      setPublishLockDialogOpen(true)
      return
    }
    
    setPendingDeleteOkr({ id: okr.id, title: okr.title })
  }

  const confirmDeleteOKR = async () => {
    if (!pendingDeleteOkr) return
    
    try {
      await api.delete(`/objectives/${pendingDeleteOkr.id}`)
      const title = pendingDeleteOkr.title
      setPendingDeleteOkr(null)
      toast({
        title: 'OKR deleted',
        description: `"${title}" has been deleted.`,
      })
      handleReloadOKRs()
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
  
  const handleReloadOKRs = () => {
    // Increment reload trigger to force OKRPageContainer to reload
    setReloadTrigger(prev => prev + 1)
    
    // Announce to screen readers
    setLiveRegionMessage('OKR list updated')
    setTimeout(() => setLiveRegionMessage(null), 1000)
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
    // Handle both direct KR objects and junction table format (keyResults array with weight)
    const keyResults = (rawObj.keyResults || []).map((kr: any): any => {
      // Check if this KR is overdue
      const krId = kr.keyResultId || kr.id
      const isOverdue = overdueCheckIns.some(item => item.krId === krId)
      
      // Extract KR data - handle both junction table format and direct format
      const krData = kr.keyResult || kr
      const weight = kr.weight ?? 1.0 // Extract weight from junction table, default to 1.0
      
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
        weight, // Include weight from junction table
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
    // If an initiative has both objectiveId and keyResultId, prioritize the KR-linked version
      console.error(`🔍🔍🔍 [OKR MAPPING] STARTING MAPPING 🔍🔍🔍`);
      console.error(`🔍 [OKR MAPPING] Raw objective data:`, {
      objectiveId: rawObj.objectiveId || rawObj.id,
      objectiveTitle: rawObj.title,
      directInitiatives: rawObj.initiatives?.length || 0,
      directInitiativesData: rawObj.initiatives,
      keyResultsCount: rawObj.keyResults?.length || 0,
      keyResultsWithInitiatives: rawObj.keyResults?.map((kr: any) => ({
        id: kr.keyResultId || kr.id,
        title: kr.title,
        initiativesCount: kr.initiatives?.length || 0,
        initiatives: kr.initiatives,
      })),
    });
    
    // Collect KR-linked initiatives first (they have more context)
    const seenInitIds = new Set<string>()
    const allInitiatives: any[] = []
    
    // First, add initiatives from Key Results (they have KR context)
    rawObj.keyResults?.forEach((kr: any) => {
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
    rawObj.initiatives?.forEach((init: any) => {
      if (!seenInitIds.has(init.id)) {
        seenInitIds.add(init.id)
        allInitiatives.push({
          ...init,
          keyResultId: init.keyResultId,
          keyResultTitle: init.keyResultTitle,
        })
      }
    })
    
      console.error(`🔍 [OKR MAPPING] All initiatives mapped:`, allInitiatives.length, allInitiatives);
    
    // Map initiatives to final format
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
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer variant="content">
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
                    ...(activeCycles.some((c) => c.status === 'LOCKED')
                      ? [{ label: 'Locked', tone: 'warning' as const }]
                      : []),
                  ]}
                />
              </div>
              
              {/* View Toggle (List | Tree) - only show if feature flag enabled */}
              {okrTreeView && (
                <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 p-1" role="group" aria-label="View mode">
                  <button
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                      viewMode === 'list'
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900"
                    )}
                    onClick={() => setViewMode('list')}
                    aria-pressed={viewMode === 'list'}
                  >
                    List
                  </button>
                  <button
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                      viewMode === 'tree'
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900"
                    )}
                    onClick={() => setViewMode('tree')}
                    aria-pressed={viewMode === 'tree'}
                  >
                    Tree
                  </button>
                </div>
              )}
            </div>
            {/* Cycle Health Strip */}
            {selectedCycleId && (
              <div className="mt-4">
                <CycleHealthStrip cycleId={selectedCycleId} />
              </div>
            )}
          </div>

          {/* Governance Status Bar */}
          {selectedCycleId && (
            <GovernanceStatusBar cycleId={selectedCycleId} scope={selectedScope} />
          )}

          {/* Filters and Search Toolbar */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-3">
              {/* Left: Filters - Two-row layout */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <OKRFilterBar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      selectedStatus={selectedStatus}
                      onStatusChange={setSelectedStatus}
                      selectedScope={selectedScope}
                      onScopeChange={handleScopeChange}
                      availableScopes={availableScopes}
                      selectedCycleId={selectedCycleId}
                      normalizedCycles={normalizedCycles}
                      legacyPeriods={legacyPeriods}
                      selectedTimeframeKey={selectedTimeframeKey}
                      onCycleSelect={(opt: { key: string; label: string }) => {
                        const previousCycleId = selectedCycleId
                        setSelectedTimeframeKey(opt.key)
                        setSelectedTimeframeLabel(opt.label)
                        if (opt.key && opt.key !== 'all' && opt.key !== 'unassigned' && normalizedCycles.some(c => c.id === opt.key)) {
                          setSelectedCycleId(opt.key)
                          // Telemetry: cycle changed
                          track('cycle_changed', {
                            scope: selectedScope,
                            cycle_id_prev: previousCycleId,
                            cycle_id: opt.key,
                            ts: new Date().toISOString(),
                          })
                        } else {
                          // User selected "All Cycles" or "Unassigned" - clear cycle filter
                          setSelectedCycleId(null)
                          // Mark as initialized so loadActiveCycles doesn't reset it
                          cycleInitializedRef.current = true
                          // Telemetry: cycle changed (cleared)
                          track('cycle_changed', {
                            scope: selectedScope,
                            cycle_id_prev: previousCycleId,
                            cycle_id: null,
                            ts: new Date().toISOString(),
                          })
                        }
                      }}
                      onManageCycles={isTenantAdminForCurrentOrg ? () => setCycleManagementDrawerOpen(true) : undefined}
                      hasActiveFilters={hasActiveFilters}
                      onClearFilters={clearFilters}
                      myOkrsOnly={myOkrsOnly}
                      onMyOkrsToggle={handleMyOkrsToggle}
                      selectedVisibility={selectedVisibility}
                      onVisibilityChange={handleVisibilityChange}
                      selectedOwnerId={selectedOwnerId}
                      onOwnerChange={handleOwnerChange}
                      selectedPillarId={selectedPillarId}
                      onPillarChange={handlePillarChange}
                      availableUsers={availableUsers}
                      currentUserId={user?.id}
                    />
                  </div>

                  {/* Right: Actions */}
                  <OKRToolbar
                    attentionCount={attentionCount}
                    onOpenAttentionDrawer={() => setAttentionDrawerOpen(true)}
                    canCreateObjective={canCreateObjective}
                    canEditOKR={permissions.canEditOKR({ ownerId: user?.id || '', organizationId: currentOrganization?.id || null })}
                    isSuperuser={isSuperuser}
                    onCreateObjective={() => {
                      setCreationDrawerMode('objective')
                      setIsCreateDrawerOpen(true)
                    }}
                    onCreateKeyResult={() => {
                      setCreationDrawerMode('kr')
                      setIsCreateDrawerOpen(true)
                    }}
                    onCreateInitiative={() => {
                      setCreationDrawerMode('initiative')
                      setIsCreateDrawerOpen(true)
                    }}
                    onOpenCycleManagement={() => setCycleManagementDrawerOpen(true)}
                    canManageCycles={isTenantAdminForCurrentOrg}
                  />
                </div>
              </div>
            </div>
            
            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <span className="text-sm text-slate-600">Active filters:</span>
                
                {/* Scope filter chip */}
                {selectedScope && (
                  <Badge variant="secondary" className="text-xs">
                    Scope: {selectedScope === 'my' ? 'My OKRs' : selectedScope === 'team-workspace' ? 'Team/Workspace OKRs' : 'Company OKRs'}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('scope')
                        router.push(`/dashboard/okrs?${params.toString()}`)
                      }}
                      className="ml-1.5 hover:text-destructive"
                      aria-label="Remove scope filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                
                {/* Status filter chip */}
                {selectedStatus && (
                  <Badge variant="secondary" className="text-xs">
                    Status: {selectedStatus.replace('_', ' ')}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('status')
                        router.push(`/dashboard/okrs?${params.toString()}`)
                      }}
                      className="ml-1.5 hover:text-destructive"
                      aria-label="Remove status filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                
                {/* Visibility filter chip */}
                {selectedVisibility && selectedVisibility !== 'ALL' && (
                  <Badge variant="secondary" className="text-xs">
                    Visibility: {selectedVisibility === 'PUBLIC_TENANT' ? 'Public' : 'Private'}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('visibility')
                        router.push(`/dashboard/okrs?${params.toString()}`)
                      }}
                      className="ml-1.5 hover:text-destructive"
                      aria-label="Remove visibility filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                
                {/* Cycle filter chip */}
                {selectedCycleId && (
                  <Badge variant="secondary" className="text-xs">
                    Cycle: {normalizedCycles.find(c => c.id === selectedCycleId)?.name || selectedTimeframeLabel || 'Selected'}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('cycleId')
                        router.push(`/dashboard/okrs?${params.toString()}`)
                      }}
                      className="ml-1.5 hover:text-destructive"
                      aria-label="Remove cycle filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                
                {filterWorkspaceId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Workspace: {workspaces.find(w => w.id === filterWorkspaceId)?.name}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('workspaceId')
                        router.push(`/dashboard/okrs?${params.toString()}`)
                      }}
                      className="ml-1.5 hover:text-destructive"
                      aria-label="Remove workspace filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filterTeamId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Team: {teams.find(t => t.id === filterTeamId)?.name}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('teamId')
                        router.push(`/dashboard/okrs?${params.toString()}`)
                      }}
                      className="ml-1.5 hover:text-destructive"
                      aria-label="Remove team filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filterOwnerId !== 'all' && selectedScope !== 'my' && (
                  <Badge variant="secondary" className="text-xs">
                    Owner: {availableUsers.find(u => u.id === filterOwnerId)?.name}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('ownerId')
                        router.push(`/dashboard/okrs?${params.toString()}`)
                      }}
                      className="ml-1.5 hover:text-destructive"
                      aria-label="Remove owner filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {selectedPillarId && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    style={{
                      backgroundColor: availablePillars.find(p => p.id === selectedPillarId)?.color || undefined,
                    }}
                  >
                    Pillar: {availablePillars.find(p => p.id === selectedPillarId)?.name || 'Unknown'}
                    <button
                      onClick={() => handlePillarChange(null)}
                      className="ml-1.5 hover:text-destructive"
                      aria-label={`Remove pillar filter ${availablePillars.find(p => p.id === selectedPillarId)?.name || ''}`}
                    >
                      ×
                    </button>
                  </Badge>
                )}
                
                {/* Clear All Filters Button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="h-6 px-2 text-xs text-slate-600 hover:text-slate-900"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Live Region for Async Announcements */}
          <div
            ref={liveRegionRef}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {liveRegionMessage}
          </div>

          {/* OKRs List or Tree View */}
          <main role="main" aria-busy={false} aria-label={viewMode === 'tree' ? 'OKRs tree' : 'OKRs list'}>
            {viewMode === 'tree' ? (
              <OKRTreeContainer
                key={reloadTrigger}
                availableUsers={availableUsers}
                activeCycles={activeCycles}
                overdueCheckIns={overdueCheckIns}
                filterWorkspaceId={filterWorkspaceId}
                filterTeamId={filterTeamId}
                filterOwnerId={filterOwnerId}
                filterOverdue={filterOverdue}
                searchQuery={searchQuery}
                selectedTimeframeKey={selectedTimeframeKey}
                selectedStatus={selectedStatus}
                selectedCycleId={selectedCycleId}
                selectedScope={selectedScope}
                onAction={{
                  onEdit: handleEditOKR,
                  onDelete: handleDeleteOKR,
                  onAddKeyResult: handleAddKrClick,
                  onAddInitiativeToObjective: handleAddInitiativeToObjectiveClick,
                  onAddInitiativeToKr: handleAddInitiativeToKrClick,
                  onAddCheckIn: handleAddCheckIn,
                  onOpenHistory: handleOpenActivityDrawer,
                  onEditKeyResult: handleEditKeyResult,
                  onOpenContextualAddMenu: handleOpenContextualAddMenu,
                  onContextualAddKeyResult: handleContextualAddKeyResult,
                  onContextualAddInitiative: handleContextualAddInitiative,
                }}
                selectedNodeId={selectedTreeNodeId}
                selectedNodeType={selectedTreeNodeType}
                onNodeClick={handleTreeNodeClick}
              />
            ) : (
              <OKRPageContainer
                key={reloadTrigger}
                availableUsers={availableUsers}
                activeCycles={activeCycles}
                overdueCheckIns={overdueCheckIns}
                filterWorkspaceId={filterWorkspaceId}
                filterTeamId={filterTeamId}
                filterOwnerId={filterOwnerId}
                filterOverdue={filterOverdue}
                searchQuery={searchQuery}
                selectedTimeframeKey={selectedTimeframeKey}
                selectedStatus={selectedStatus}
                selectedCycleId={selectedCycleId}
                selectedScope={selectedScope}
                myOkrsOnly={myOkrsOnly}
                selectedVisibility={selectedVisibility}
                selectedOwnerId={selectedOwnerId}
                onAction={{
                  onEdit: handleEditOKR,
                  onDelete: handleDeleteOKR,
                  onAddKeyResult: handleAddKrClick,
                  onAddInitiativeToObjective: handleAddInitiativeToObjectiveClick,
                  onAddInitiativeToKr: handleAddInitiativeToKrClick,
                  onAddCheckIn: handleAddCheckIn,
                  onOpenHistory: handleOpenActivityDrawer,
                  onEditKeyResult: handleEditKeyResult,
                  // Story 5: Contextual Add menu handlers
                  onOpenContextualAddMenu: handleOpenContextualAddMenu,
                  onContextualAddKeyResult: handleContextualAddKeyResult,
                  onContextualAddInitiative: handleContextualAddInitiative,
                }}
                expandedObjectiveId={expandedObjectiveId}
                onToggleObjective={handleToggleObjective}
                onCanCreateChange={setCanCreateObjective}
                onCreateObjective={() => {
                  setCreationDrawerMode('objective')
                  setIsCreateDrawerOpen(true)
                }}
              />
            )}
          </main>

          {/* Activity Timeline Drawer */}
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
              visibilityLevel: selectedObjectiveForLock.visibilityLevel,
              cycle: selectedObjectiveForLock.cycleId && activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)
                ? { id: selectedObjectiveForLock.cycleId, status: activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)!.status }
                : null,
              cycleStatus: selectedObjectiveForLock.cycleId && activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)
                ? activeCycles.find(c => c.id === selectedObjectiveForLock.cycleId)!.status
                : null,
            }
            const lockInfo = tenantPermissions.getLockInfoForObjective(objectiveForHook)
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
                
                toast({
                  title: 'Objective created',
                  description: `"${created.title}" has been created.`,
                })
                setShowNewObjective(false)
                handleReloadOKRs()
              } catch (err) {
                console.error('Failed to create objective', err)
              }
            }}
            availableUsers={availableUsers}
            availableWorkspaces={workspaces}
            availableCycles={normalizedCycles}
            availablePillars={[]}
          />

          {/* Edit Key Result Drawer */}
          <EditKeyResultDrawer
            isOpen={showEditKeyResult}
            keyResultId={editKeyResultId}
            keyResultData={editKeyResultData}
            availableUsers={availableUsers}
            activeCycles={activeCycles}
            currentOrganization={currentOrganization}
            onClose={() => {
              setShowEditKeyResult(false)
              setEditKeyResultId(null)
              setEditKeyResultData(null)
            }}
            onSuccess={() => {
              handleReloadOKRs()
            }}
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
                
                toast({
                  title: 'Objective updated',
                  description: `"${updated.title}" has been updated.`,
                })
                setShowEditObjective(false)
                setEditObjectiveId(null)
                setEditObjectiveData(null)
                handleReloadOKRs()
              } catch (err: any) {
                console.error('Failed to update objective', err)
                const errorMessage = err.response?.data?.message || err.message || 'Failed to update objective'
                
                // Check if it's a permission error
                if (err.response?.status === 403) {
                  toast({
                    variant: 'destructive',
                    title: 'Permission denied',
                    description: errorMessage || 'You do not have permission to edit this objective. Published objectives can only be edited by organization administrators.',
                  })
                } else {
                  toast({
                    variant: 'destructive',
                    title: 'Failed to update objective',
                    description: errorMessage,
                  })
                }
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
                
                toast({
                  title: 'Check-in recorded',
                  description: 'Check-in has been recorded successfully.',
                })
                setShowNewCheckIn(false)
                setActiveCheckInKrId(null)
                handleReloadOKRs()
              } catch (err) {
                console.error('Failed to create check-in', err)
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
                
                toast({
                  title: 'Key Result added',
                  description: `"${createdKr.title}" has been added.`,
                })
                setShowNewKeyResult(false)
                setKrParentObjectiveId(null)
                setKrParentObjectiveName(null)
                handleReloadOKRs()
              } catch (err) {
                console.error('Failed to create key result', err)
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
                  // Only send objectiveId if we DON'T have a keyResultId
                  // If keyResultId is provided, the backend will auto-set objectiveId from the KR's objective
                  objectiveId: initiativeParentKeyResultId ? undefined : (initiativeParentObjectiveId ?? undefined),
                  keyResultId: initiativeParentKeyResultId ?? undefined,
                  // Include tenantId so RBAC guard can extract tenantId
                  tenantId: currentOrganization?.id,
                }
                
                // Convert dueDate from YYYY-MM-DD to ISO-8601 DateTime format if provided
                if (payload.dueDate && typeof payload.dueDate === 'string') {
                  // If it's already a full ISO string, use it; otherwise convert date-only to ISO DateTime
                  if (payload.dueDate.includes('T')) {
                    // Already ISO format
                    payload.dueDate = payload.dueDate
                  } else {
                    // Convert YYYY-MM-DD to ISO-8601 DateTime (start of day in UTC)
                    payload.dueDate = new Date(payload.dueDate + 'T00:00:00.000Z').toISOString()
                  }
                }
                
                const res = await api.post('/initiatives', payload)
                const createdInit = res.data
                
                toast({
                  title: 'Initiative added',
                  description: `"${createdInit.title}" has been added.`,
                })
                setShowNewInitiative(false)
                setInitiativeParentObjectiveId(null)
                setInitiativeParentKeyResultId(null)
                setInitiativeParentName(null)
                handleReloadOKRs()
              } catch (err: any) {
                console.error('Failed to create initiative', err)
                toast({
                  title: 'Failed to create initiative',
                  description: err.response?.data?.message || err.message || 'An error occurred while creating the initiative.',
                  variant: 'destructive',
                })
              }
            }}
            availableUsers={availableUsers}
          />

          {/* OKR Creation Drawer */}
          <OKRCreationDrawer
            isOpen={isCreateDrawerOpen}
            mode={creationDrawerMode}
            onClose={() => {
              setIsCreateDrawerOpen(false)
              setCreationDrawerMode('objective')
              setCreationDrawerParentContext(undefined)
            }}
            availableUsers={availableUsers}
            activeCycles={activeCycles}
            currentOrganization={currentOrganization}
            parentContext={creationDrawerParentContext}
            onSuccess={() => {
              setIsCreateDrawerOpen(false)
              setCreationDrawerMode('objective')
              setCreationDrawerParentContext(undefined)
              handleReloadOKRs()
            }}
          />

          {/* Cycle Management Drawer */}
          <CycleManagementDrawer
            isOpen={cycleManagementDrawerOpen}
            onClose={() => setCycleManagementDrawerOpen(false)}
            currentOrganizationId={currentOrganization?.id || null}
            onCyclesUpdated={() => {
              loadActiveCycles()
              setCycleManagementDrawerOpen(false)
            }}
          />

          {/* Attention Drawer */}
          <AttentionDrawer
            isOpen={attentionDrawerOpen}
            onClose={() => {
              setAttentionDrawerOpen(false)
              // Refresh attention count when drawer closes
              loadAttentionCount()
            }}
            cycleId={selectedCycleId}
            scope={selectedScope}
            onNavigateToObjective={(objectiveId) => {
              // Scroll to objective or expand it
              setExpandedObjectiveId(objectiveId)
              setAttentionDrawerOpen(false)
            }}
            onNavigateToKeyResult={(krId) => {
              // Find and expand the objective containing this KR
            }}
            canRequestCheckIn={isTenantAdminForCurrentOrg}
            onRequestCheckIn={(krId) => {
              handleAddCheckIn(krId)
              setAttentionDrawerOpen(false)
            }}
          />
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

