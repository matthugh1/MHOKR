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
import { Plus, Search, X } from 'lucide-react'
// W4.M1: Period utilities removed - Cycle is canonical
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { OKRPageContainer } from './OKRPageContainer'
import Link from 'next/link'
import { ActivityDrawer, ActivityItem } from '@/components/ui/ActivityDrawer'
import { PublishLockWarningModal } from './components/PublishLockWarningModal'
import { CycleSelector } from '@/components/ui/CycleSelector'
import { NewObjectiveModal } from '@/components/okr/NewObjectiveModal'
import { EditObjectiveModal } from '@/components/okr/EditObjectiveModal'
import { NewKeyResultModal } from '@/components/okr/NewKeyResultModal'
import { NewCheckInModal } from '@/components/okr/NewCheckInModal'
import { NewInitiativeModal } from '@/components/okr/NewInitiativeModal'
import { OKRCreationDrawer } from './components/OKRCreationDrawer'
import { CycleHealthStrip } from '@/components/okr/CycleHealthStrip'
import { AttentionDrawer } from '@/components/okr/AttentionDrawer'
import api from '@/lib/api'
import { logTokenInfo } from '@/lib/jwt-debug'
import { cn } from '@/lib/utils'

// NOTE: This screen is now the system of record for CRUD on Objectives, Key Results, and Initiatives.
// Visual Builder becomes an optional planning surface, not the source of truth.
export default function OKRsPage() {
  const router = useRouter()
  // [phase6-polish] Reintroduce compact multi-column grid view for exec scanning.
  const [_viewMode, _setViewMode] = useState<'grid' | 'list'>('list')
  // W4.M1: Period removed - Cycle is canonical
  
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
  const [liveRegionMessage, setLiveRegionMessage] = useState<string | null>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)
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
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [canCreateObjective, setCanCreateObjective] = useState<boolean>(false)
  
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
        setSelectedCycleId(cycles[0].id) // Sync for CycleHealthStrip and AttentionDrawer
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
  }
  
  const hasActiveFilters = filterWorkspaceId !== 'all' || filterTeamId !== 'all' || filterOwnerId !== 'all' || searchQuery.length > 0;

  const handleEditOKR = (okr: any) => {
    const objectiveForHook = okr.objectiveForHook || {
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
    
    const canEdit = tenantPermissions.canEditObjective(objectiveForHook)
    
    if (!canEdit) {
      tenantPermissions.getLockInfoForObjective(objectiveForHook)
      setSelectedObjectiveForLock(okr)
      setPublishLockDialogOpen(true)
      return
    }
    
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

  
  const handleAddCheckIn = (krId: string) => {
    // [phase5-core:done] implemented NewCheckInModal and wired POST /api/check-ins
    setActiveCheckInKrId(krId)
    setShowNewCheckIn(true)
  }

  const handleDeleteOKR = async (okr: any) => {
    const objectiveForHook = okr.objectiveForHook || {
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
          <header role="banner" className="mb-8">
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
              <div className="flex items-center gap-4">
                {/* W4.M1: Permission-gated New Objective button */}
                {canCreateObjective && (
                  <Button 
                    onClick={() => setIsCreateDrawerOpen(true)}
                    data-focus-restorer
                    aria-label="Create new objective"
                    className="focus:ring-2 focus:ring-ring focus:outline-none"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Objective
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setAttentionDrawerOpen(true)}
                  data-focus-restorer
                  aria-label="Open needs attention drawer"
                  className="focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  Needs attention
                </Button>
                <button
                  className="text-[12px] font-medium text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                  onClick={() => router.push('/dashboard/builder')}
                >
                  Visual Builder
                </button>
              </div>
            </div>
            {/* Cycle Health Strip */}
            {selectedCycleId && (
              <div className="mt-4">
                <CycleHealthStrip
                  cycleId={selectedCycleId}
                  onFilterClick={(filterType, value) => {
                    // Handle filter clicks (simplified for now)
                    console.log('[Cycle Health] Filter clicked:', filterType, value)
                  }}
                />
              </div>
            )}
            <p className="text-[13px] text-neutral-500 leading-relaxed mt-2">
              This view shows execution state. For planning or alignment storytelling, open the{' '}
              <Link
                href="/dashboard/builder"
                className="text-violet-700 hover:text-violet-900 font-medium underline underline-offset-2 focus:ring-2 focus:ring-ring focus:outline-none"
              >
                Visual Builder
              </Link>
              .
            </p>
          </header>

          {/* Sticky Filter and Pagination Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 mb-4 pb-4 -mx-8 px-8 pt-4">
            {/* Quick Status Chips */}
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Status filters">
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                  selectedStatus === null
                    ? "bg-violet-100 text-violet-700 border border-violet-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus(null)
                }}
                aria-label="Show all statuses"
                aria-pressed={selectedStatus === null}
              >
                All statuses
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                  selectedStatus === 'ON_TRACK'
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('ON_TRACK')
                }}
                aria-label="Filter by status: On track"
                aria-pressed={selectedStatus === 'ON_TRACK'}
              >
                On track
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                  selectedStatus === 'AT_RISK'
                    ? "bg-amber-100 text-amber-700 border border-amber-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('AT_RISK')
                }}
                aria-label="Filter by status: At risk"
                aria-pressed={selectedStatus === 'AT_RISK'}
              >
                At risk
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                  selectedStatus === 'BLOCKED'
                    ? "bg-rose-100 text-rose-700 border border-rose-300"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('BLOCKED')
                }}
                aria-label="Filter by status: Blocked"
                aria-pressed={selectedStatus === 'BLOCKED'}
              >
                Blocked
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                  selectedStatus === 'COMPLETED'
                    ? "bg-neutral-200 text-neutral-800 border border-neutral-400"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('COMPLETED')
                }}
                aria-label="Filter by status: Completed"
                aria-pressed={selectedStatus === 'COMPLETED'}
              >
                Completed
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                  selectedStatus === 'CANCELLED'
                    ? "bg-neutral-200 text-neutral-800 border border-neutral-400"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
                )}
                onClick={() => {
                  setSelectedStatus('CANCELLED')
                }}
                aria-label="Filter by status: Cancelled"
                aria-pressed={selectedStatus === 'CANCELLED'}
              >
                Cancelled
              </button>
            </div>

            {/* Cycle Filter and Top Pagination */}
            {/* Removed duplicate cycle select - using CycleSelector in filters section below */}
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
              
              {/* W4.M1: Cycle selector only (periods removed) */}
              <CycleSelector
                cycles={normalizedCycles}
                legacyPeriods={legacyPeriods}
                selectedId={selectedTimeframeKey}
                onSelect={(opt: { key: string; label: string }) => {
                  setSelectedTimeframeKey(opt.key)
                  setSelectedTimeframeLabel(opt.label)
                  // Sync selectedCycleId when a cycle is selected (for CycleHealthStrip and AttentionDrawer)
                  // Only set if it's a valid cycle ID (not 'all' or 'unassigned')
                  if (opt.key && opt.key !== 'all' && opt.key !== 'unassigned' && normalizedCycles.some(c => c.id === opt.key)) {
                    setSelectedCycleId(opt.key)
                  } else {
                    setSelectedCycleId(null)
                  }
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

          {/* OKRs List with Pagination */}
          <main role="main" aria-busy={false} aria-label="OKRs list">
            <OKRPageContainer
              key={reloadTrigger}
              availableUsers={availableUsers}
              activeCycles={activeCycles}
              overdueCheckIns={overdueCheckIns}
              filterWorkspaceId={filterWorkspaceId}
              filterTeamId={filterTeamId}
              filterOwnerId={filterOwnerId}
              searchQuery={searchQuery}
              selectedTimeframeKey={selectedTimeframeKey}
              selectedStatus={selectedStatus}
              selectedCycleId={selectedCycleId}
              onAction={{
                onEdit: handleEditOKR,
                onDelete: handleDeleteOKR,
                onAddKeyResult: handleAddKrClick,
                onAddInitiativeToObjective: handleAddInitiativeToObjectiveClick,
                onAddInitiativeToKr: handleAddInitiativeToKrClick,
                onAddCheckIn: handleAddCheckIn,
                onOpenHistory: handleOpenActivityDrawer,
              }}
              expandedObjectiveId={expandedObjectiveId}
              onToggleObjective={handleToggleObjective}
              onCanCreateChange={setCanCreateObjective}
            />
          </main>

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
              visibilityLevel: selectedObjectiveForLock.visibilityLevel,
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
                
                toast({
                  title: 'Objective created',
                  description: `"${created.title}" has been created.`,
                })
                setShowNewObjective(false)
                handleReloadOKRs()
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
                
                toast({
                  title: 'Objective updated',
                  description: `"${updated.title}" has been updated.`,
                })
                setShowEditObjective(false)
                setEditObjectiveId(null)
                setEditObjectiveData(null)
                handleReloadOKRs()
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
                
                toast({
                  title: 'Check-in recorded',
                  description: 'Check-in has been recorded successfully.',
                })
                setShowNewCheckIn(false)
                setActiveCheckInKrId(null)
                handleReloadOKRs()
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
                
                toast({
                  title: 'Key Result added',
                  description: `"${createdKr.title}" has been added.`,
                })
                setShowNewKeyResult(false)
                setKrParentObjectiveId(null)
                setKrParentObjectiveName(null)
                handleReloadOKRs()
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
                
                toast({
                  title: 'Initiative added',
                  description: `"${createdInit.title}" has been added.`,
                })
                setShowNewInitiative(false)
                setInitiativeParentObjectiveId(null)
                setInitiativeParentKeyResultId(null)
                setInitiativeParentName(null)
                handleReloadOKRs()
              } catch (err) {
                // TODO [phase7-hardening]: map backend validation errors to field-level messages.
                console.error('Failed to create initiative', err)
                // TODO [phase6-polish]: surface inline form error state
              }
            }}
            availableUsers={availableUsers}
          />

          {/* OKR Creation Drawer */}
          <OKRCreationDrawer
            isOpen={isCreateDrawerOpen}
            onClose={() => setIsCreateDrawerOpen(false)}
            availableUsers={availableUsers}
            activeCycles={activeCycles}
            currentOrganization={currentOrganization}
            onSuccess={() => {
              setIsCreateDrawerOpen(false)
              handleReloadOKRs()
            }}
          />

          {/* Attention Drawer */}
          <AttentionDrawer
            isOpen={attentionDrawerOpen}
            onClose={() => setAttentionDrawerOpen(false)}
            cycleId={selectedCycleId}
            onNavigateToObjective={(objectiveId) => {
              // Scroll to objective or expand it
              setExpandedObjectiveId(objectiveId)
              setAttentionDrawerOpen(false)
            }}
            onNavigateToKeyResult={(krId) => {
              // Find and expand the objective containing this KR
              console.log('[Attention Drawer] Navigate to KR:', krId)
            }}
            canRequestCheckIn={permissions.isTenantAdminOrOwner(currentOrganization?.id)}
            onRequestCheckIn={(krId) => {
              handleAddCheckIn(krId)
              setAttentionDrawerOpen(false)
            }}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

