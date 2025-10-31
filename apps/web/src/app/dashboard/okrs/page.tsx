'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { Plus, Search, Filter, Grid3x3, List, Calendar, X, Edit2, Trash2, Lock, History, LockKeyhole } from 'lucide-react'
import { Period } from '@okr-nexus/types'
import { 
  formatPeriod, 
  getPeriodLabel, 
  getAvailablePeriodFilters, 
  getCurrentPeriodFilter,
  doesOKRMatchPeriod,
  type PeriodFilterOption
} from '@/lib/date-utils'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { ObjectiveCard } from '@/components/ui/ObjectiveCard'
import { ActivityDrawer, ActivityItem } from '@/components/ui/ActivityDrawer'
import { PublishLockWarningModal } from './components/PublishLockWarningModal'
import { CycleSelector } from '@/components/ui/CycleSelector'
import api from '@/lib/api'
import { logTokenInfo } from '@/lib/jwt-debug'

export default function OKRsPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentPeriodFilter())
  const availablePeriods = getAvailablePeriodFilters()
  
  // Filter states
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>('all')
  const [filterTeamId, setFilterTeamId] = useState<string>('all')
  const [filterOwnerId, setFilterOwnerId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const { workspaces, teams, currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const permissions = usePermissions()
  const { canSeeObjective, canSeeKeyResult, ...tenantPermissions } = useTenantPermissions()
  const { toast } = useToast()
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [okrs, setOkrs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [activityEntityName, setActivityEntityName] = useState('')
  const [publishLockDialogOpen, setPublishLockDialogOpen] = useState(false)
  const [selectedObjectiveForLock, setSelectedObjectiveForLock] = useState<any | null>(null)
  const [pendingDeleteOkr, setPendingDeleteOkr] = useState<{ id: string; title: string } | null>(null)
  const [activeCycles, setActiveCycles] = useState<Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    organizationId: string
  }>>([])
  
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
    
    loadOKRs()
    loadUsers()
    loadActiveCycles()
  }, [currentOrganization?.id, user])
  
  const loadOKRs = async () => {
    if (!currentOrganization?.id) return
    try {
      setLoading(true)
      setPermissionError(null)
      const response = await api.get(`/objectives`)
      setOkrs(response.data || [])
    } catch (error: any) {
      console.error('Failed to load OKRs:', error)
      if (error.response?.status === 403) {
        setPermissionError('You do not have permission to view OKRs. Please contact your administrator.')
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
      const response = await api.get('/objectives/cycles/active')
      const cycles = response.data || []
      setActiveCycles(cycles)
      // TODO [phase7-hardening]: Replace with /objectives/cycles/all endpoint when available to show all cycles, not just active
      // Set default selected cycle to first active cycle if available
      if (cycles.length > 0) {
        setSelectedId(cycles[0].id)
      }
    } catch (error: any) {
      // Cycles endpoint is optional - gracefully degrade if no permission
      if (error.response?.status !== 403) {
        console.error('Failed to load active cycles:', error)
      }
      setActiveCycles([])
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

  const selectedPeriodOption = availablePeriods.find(p => p.value === selectedPeriod);
  
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

  // Unified selectedId state
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (normalizedCycles.length > 0) return normalizedCycles[0].id
    if (legacyPeriods.length > 0) return legacyPeriods[0].id
    return 'synthetic-active-cycle'
  })
  
  // Apply filters and visibility checks with safe defaults
  const safeObjectives = Array.isArray(okrs) ? okrs : []
  const filteredOKRs = safeObjectives.filter(okr => {
    // Apply visibility check
    if (!canSeeObjective(okr)) {
      return false
    }
    // Unified filter using selectedId (can be cycle or period)
    // [phase7-hardening]: once backend distinguishes 'cycle' vs 'period', align this
    if (selectedId && selectedId !== 'synthetic-active-cycle') {
      // Check if it matches cycleId
      if (okr.cycleId === selectedId) {
        // Matches cycle - include this OKR
      } else if (selectedId.startsWith('2025-') || selectedId.startsWith('2026-')) {
        // Legacy period filter - for now show all if period selected
        // [phase7-hardening]: implement period matching logic when backend supports it
        // For now, include all OKRs when a period is selected
      } else {
        // No match - exclude this OKR
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
      const lockInfo = tenantPermissions.getLockInfoForObjective(objectiveForHook)
      setSelectedObjectiveForLock(okr)
      setPublishLockDialogOpen(true)
      return
    }
    
    router.push(`/dashboard/builder?okrId=${okr.id}`)
  }

  const handleDeleteOKR = async (okr: any) => {
    // Map okr to Objective interface expected by hook
    // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
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
      const lockInfo = tenantPermissions.getLockInfoForObjective(objectiveForHook)
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

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <PageHeader
                  title="Objectives & Key Results"
                  subtitle="Aligned execution, live progress"
                  badges={[
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
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New OKR
                </Button>
              </div>
            </div>
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
                  {/* TODO [phase6-polish]: Later we'll surface a CTA for admins to open next cycle / lock current cycle. */}
                </div>
              ))}
            </div>
          )}

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
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id)
                  // [phase7-hardening]: trigger refetch / filter view model for this period
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
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
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
              {safeObjectives.filter(canSeeObjective).length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
                  No objectives are visible in this workspace.
                  {/* TODO [phase6-polish]: add illustration + CTA when we allow creation */}
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
                  <p className="mb-4">No OKRs found</p>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters to see all OKRs
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOKRs.map((okr) => {
                const owner = availableUsers.find(u => u.id === okr.ownerId)
                
                // Map okr to Objective interface expected by hook
                // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
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
                const isPublished = okr.isPublished === true
                
                // Find next check-in due date from key results
                const nextCheckInDue = okr.keyResults?.find((kr: any) => kr.keyResult?.checkInCadence)?.keyResult?.lastCheckInAt
                
                return (
                  <ObjectiveCard
                    key={okr.id}
                    title={okr.title}
                    ownerName={owner?.name || owner?.email || 'Unknown'}
                    ownerAvatarUrl={undefined}
                    status={okr.status || 'ON_TRACK'}
                    progressPct={Math.round(okr.progress || 0)}
                    isPublished={isPublished}
                    nextCheckInDue={nextCheckInDue}
                    onOpenHistory={() => handleOpenActivityDrawer('OBJECTIVE', okr.id, okr.title)}
                    onEdit={() => handleEditOKR(okr)}
                    onDelete={() => handleDeleteOKR(okr)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOKRs.map((okr) => {
                const owner = availableUsers.find(u => u.id === okr.ownerId)
                
                // Map okr to Objective interface expected by hook
                // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
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
                const isPublished = okr.isPublished === true
                
                // Find next check-in due date from key results
                const nextCheckInDue = okr.keyResults?.find((kr: any) => kr.keyResult?.checkInCadence)?.keyResult?.lastCheckInAt
                
                return (
                  <ObjectiveCard
                    key={okr.id}
                    title={okr.title}
                    ownerName={owner?.name || owner?.email || 'Unknown'}
                    ownerAvatarUrl={undefined}
                    status={okr.status || 'ON_TRACK'}
                    progressPct={Math.round(okr.progress || 0)}
                    isPublished={isPublished}
                    nextCheckInDue={nextCheckInDue}
                    onOpenHistory={() => handleOpenActivityDrawer('OBJECTIVE', okr.id, okr.title)}
                    onEdit={() => handleEditOKR(okr)}
                    onDelete={() => handleDeleteOKR(okr)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                )
              })}
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
            // TODO [phase6-polish]: improve copy for lock reasons
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
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

