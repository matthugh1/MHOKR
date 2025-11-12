'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Calendar, User, Building2, Users, Target, Search, ChevronDown, AlertCircle } from 'lucide-react'
import { Period } from '@okr-nexus/types'
import { LinkedKeyResults } from './LinkedKeyResults'
import { TagSelector } from '@/components/okr/TagSelector'
import { ContributorSelector } from '@/components/okr/ContributorSelector'
import { SponsorSelector } from '@/components/okr/SponsorSelector'

import { 
  formatDateForInput, 
  getQuarterDates, 
  getMonthDates, 
  getYearDates,
  getAvailableYears,
  formatPeriod,
} from '@/lib/date-utils'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useTenantAdmin } from '@/hooks/useTenantAdmin'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'

type UnknownObjective = Record<string, unknown> // TODO [phase7-hardening]: tighten typing

export interface EditFormState {
  okrId?: string
  ownerId?: string
  ownerName?: string
  tenantId?: string | null
  workspaceId?: string | null
  teamId?: string | null

  isPublished?: boolean
  cycle?: { id: string; status: string } | null
  cycleStatus?: string | null

  label?: string
  description?: string

  // Key Result fields
  current?: number
  target?: number
  unit?: string
  metricType?: 'INCREASE' | 'DECREASE' | 'REACH' | 'MAINTAIN'

  // Shared progress fields
  progress?: number

  // Time frame fields
  period?: Period
  quarter?: number
  month?: number
  year?: number
  startDate?: string
  endDate?: string

  // Initiative fields
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'

  // Review fields (Objective only)
  confidence?: number | null
  reviewFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | null
  lastReviewedAt?: string | null

  // Hierarchy / visibility
  parentId?: string
  parentObjective?: Record<string, unknown> | null
  visibilityLevel?: string
}

interface EditFormTabsProps {
  nodeId: string
  nodeType: 'obj' | 'kr' | 'init'
  data: Record<string, unknown>
  formData: EditFormState
  setFormData: (data: EditFormState) => void
  onSave: () => void
  alignmentError?: { code?: string; message?: string } | null
}

export function EditFormTabs({
  nodeId: _nodeId,
  nodeType,
  data: _data,
  formData,
  setFormData,
  onSave: _onSave,
  alignmentError,
}: EditFormTabsProps) {
  const { organizations, workspaces, teams, currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const tenantPermissions = useTenantPermissions()
  
  const period = formData.period
  
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [showContextDropdown, setShowContextDropdown] = useState(false)
  const [showParentDropdown, setShowParentDropdown] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [contextSearch, setContextSearch] = useState('')
  const [parentSearch, setParentSearch] = useState('')
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email?: string; avatar?: string | null }>>([])
  const [availableObjectives, setAvailableObjectives] = useState<Array<{ id: string; title: string }>>([])
  const [availablePillars, setAvailablePillars] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedTags, setSelectedTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedContributors, setSelectedContributors] = useState<Array<{ id: string; user: { id: string; name: string; email?: string; avatar?: string | null }; role: string }>>([])
  const [sponsorId, setSponsorId] = useState<string | null>(null)

  // Determine if editing is allowed based on node type
  const canEdit = nodeType === 'obj' 
    ? tenantPermissions.canEditObjective({
        id: formData.okrId as string || '',
        ownerId: formData.ownerId as string || '',
        tenantId: formData.tenantId as string | null || null,
        workspaceId: formData.workspaceId as string | null || null,
        teamId: formData.teamId as string | null || null,
        isPublished: formData.isPublished as boolean || false,
        cycle: formData.cycle as { id: string; status: string } | null || null,
        cycleStatus: formData.cycleStatus as string | null || null,
      })
    : nodeType === 'kr'
    ? tenantPermissions.canEditKeyResult({
        id: formData.okrId as string || '',
        ownerId: formData.ownerId as string || '',
        tenantId: formData.tenantId as string | null || null,
        workspaceId: formData.workspaceId as string | null || null,
        teamId: formData.teamId as string | null || null,
        parentObjective: formData.parentObjective && typeof formData.parentObjective === 'object' && 'id' in formData.parentObjective
          ? {
              id: (formData.parentObjective as any).id as string,
              tenantId: (formData.parentObjective as any).tenantId as string | null | undefined,
              isPublished: (formData.parentObjective as any).isPublished as boolean | undefined,
              cycle: (formData.parentObjective as any).cycle as { id: string; status: string } | null | undefined,
              cycleStatus: (formData.parentObjective as any).cycleStatus as string | null | undefined,
            }
          : null,
      })
    : true // Initiatives don't have lock logic yet

  const lockInfo = nodeType === 'obj'
    ? tenantPermissions.getLockInfoForObjective({
        id: formData.okrId as string || '',
        ownerId: formData.ownerId as string || '',
        tenantId: formData.tenantId as string | null || null,
        workspaceId: formData.workspaceId as string | null || null,
        teamId: formData.teamId as string | null || null,
        isPublished: formData.isPublished as boolean || false,
        cycle: formData.cycle as { id: string; status: string } | null || null,
        cycleStatus: formData.cycleStatus as string | null || null,
      })
    : nodeType === 'kr'
    ? tenantPermissions.getLockInfoForKeyResult({
        id: formData.okrId as string || '',
        ownerId: formData.ownerId as string || '',
        tenantId: formData.tenantId as string | null || null,
        workspaceId: formData.workspaceId as string | null || null,
        teamId: formData.teamId as string | null || null,
        parentObjective: formData.parentObjective && typeof formData.parentObjective === 'object' && 'id' in formData.parentObjective
          ? {
              id: (formData.parentObjective as any).id as string,
              tenantId: (formData.parentObjective as any).tenantId as string | null | undefined,
              isPublished: (formData.parentObjective as any).isPublished as boolean | undefined,
              cycle: (formData.parentObjective as any).cycle as { id: string; status: string } | null | undefined,
              cycleStatus: (formData.parentObjective as any).cycleStatus as string | null | undefined,
            }
          : null,
      })
    : { isLocked: false, reason: null, message: '' }

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get('/users')
        setAvailableUsers(response.data)
      } catch (error) {
        console.error('Failed to load users:', error)
      }
    }
    loadUsers()
  }, [])

  useEffect(() => {
    if (nodeType === 'obj') {
      const loadObjectives = async () => {
        try {
          const queryParams = currentOrganization?.id ? `?tenantId=${currentOrganization.id}` : ''
          const response = await api.get(`/objectives${queryParams}`)
          setAvailableObjectives(response.data)
        } catch (error) {
          console.error('Failed to load objectives:', error)
        }
      }
      loadObjectives()

      const loadPillars = async () => {
        try {
          const response = await api.get('/reports/pillars')
          setAvailablePillars(response.data || [])
        } catch (error) {
          console.error('Failed to load pillars:', error)
        }
      }
      loadPillars()
    }
  }, [nodeType, currentOrganization?.id])

  const getOwnerDisplay = () => {
    const ownerId = formData.ownerId as string | undefined
    if (ownerId === user?.id) {
      const userName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.email || 'You'
      return `👤 ${userName}`
    }
    const selectedUser = availableUsers.find(u => u.id === ownerId)
    return selectedUser ? `👤 ${selectedUser.name}` : 'Select owner...'
  }

  const getContextDisplay = () => {
    if (formData.tenantId && !formData.workspaceId && !formData.teamId) {
      const org = organizations.find(o => o.id === formData.tenantId)
      return `🏢 ${org?.name || 'Organization'}`
    }
    if (formData.workspaceId && !formData.teamId) {
      const ws = workspaces.find(w => w.id === formData.workspaceId)
      return `💼 ${ws?.name || 'Workspace'}`
    }
    if (formData.teamId) {
      const team = teams.find(t => t.id === formData.teamId)
      return `👥 ${team?.name || 'Team'}`
    }
    return '👤 Personal'
  }

  const getParentDisplay = () => {
    if (!formData.parentId) {
      return 'No parent (top-level objective)'
    }
    const parentObjective = availableObjectives.find(obj => obj.id === formData.parentId)
    return parentObjective ? `🎯 ${parentObjective.title}` : 'Select parent objective...'
  }

  return (
    <div className="space-y-4">
          {/* Lock messaging */}
          {lockInfo.isLocked && (
            <>
              <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-600 shadow-sm">
                {lockInfo.message || 'This item is locked.'}
              </div>
            </>
          )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Basic Tab - Most common fields */}
        <TabsContent value="basic" className="space-y-4 mt-4">
          <SectionHeader
            title={nodeType === 'obj' ? 'Draft Objective' : nodeType === 'kr' ? 'Draft Key Result' : 'Draft Initiative'}
            subtitle="Work in progress — not yet published"
          />
          <div>
            <Label htmlFor="label">
              {nodeType === 'obj' ? 'Objective' : nodeType === 'kr' ? 'Key Result' : 'Initiative'} Title *
            </Label>
            <Input
              id="label"
              value={formData.label || ''}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Enter title..."
              className="mt-1"
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>

        {nodeType === 'obj' && (
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What do you want to achieve?"
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
        )}

        {nodeType === 'kr' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="current">Current Value</Label>
                <Input
                  id="current"
                  type="number"
                  value={formData.current ?? 0}
                  onChange={(e) => setFormData({ ...formData, current: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                  readOnly={!canEdit}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="target">Target Value *</Label>
                <Input
                  id="target"
                  type="number"
                  value={formData.target ?? 100}
                  onChange={(e) => setFormData({ ...formData, target: parseFloat(e.target.value) || 100 })}
                  className="mt-1"
                  readOnly={!canEdit}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit || ''}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., users, %, items, $"
                className="mt-1"
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
            <div className="bg-slate-50 p-3 rounded-md">
              <div className="text-sm font-medium mb-1">Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((formData.current ?? 0) / (formData.target ?? 1)) * 100)}%` 
                    }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {Math.round(((formData.current ?? 0) / (formData.target ?? 1)) * 100)}%
                </span>
              </div>
            </div>
          </>
        )}

        {nodeType === 'init' && (
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
              value={formData.status || 'NOT_STARTED'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' })}
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        )}

        {(nodeType === 'obj' || nodeType === 'kr') && (
          <div>
            <Label htmlFor="progress">Progress (%)</Label>
            <Input
              id="progress"
              type="number"
              min="0"
              max="100"
              value={formData.progress ?? 0}
              onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="mt-1"
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
        )}
      </TabsContent>

      {/* Details Tab - Dates, Period, Timeframe */}
      <TabsContent value="details" className="space-y-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-slate-600" />
          <Label className="text-sm font-semibold">Time Frame</Label>
        </div>

        <div>
          <Label htmlFor="period">Period Type</Label>
          <select
            id="period"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
            value={period || Period.QUARTERLY}
            disabled={!canEdit}
            onChange={(e) => {
              const newPeriod = e.target.value as Period
              let dates = { startDate: formData.startDate, endDate: formData.endDate }

              if (newPeriod === Period.QUARTERLY) {
                const quarterDates = getQuarterDates(formData.quarter || 1, formData.year || new Date().getFullYear())
                dates = {
                  startDate: formatDateForInput(quarterDates.startDate),
                  endDate: formatDateForInput(quarterDates.endDate),
                }
              } else if (newPeriod === Period.MONTHLY) {
                const monthDates = getMonthDates(formData.month || 0, formData.year || new Date().getFullYear())
                dates = {
                  startDate: formatDateForInput(monthDates.startDate),
                  endDate: formatDateForInput(monthDates.endDate),
                }
              } else if (newPeriod === Period.ANNUAL) {
                const yearDates = getYearDates(formData.year || new Date().getFullYear())
                dates = {
                  startDate: formatDateForInput(yearDates.startDate),
                  endDate: formatDateForInput(yearDates.endDate),
                }
              }

              setFormData({
                ...formData,
                period: newPeriod,
                ...dates,
              })
            }}
          >
            <option value={Period.MONTHLY}>Monthly</option>
            <option value={Period.QUARTERLY}>Quarterly</option>
            <option value={Period.ANNUAL}>Annual</option>
            <option value={Period.CUSTOM}>Custom Date Range</option>
          </select>
        </div>

        {/* Period-specific selectors */}
        {period === Period.QUARTERLY && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quarter">Quarter</Label>
              <select
                id="quarter"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                value={formData.quarter ?? 1}
                onChange={(e) => {
                  const newQuarter = parseInt(e.target.value)
                  const dates = getQuarterDates(newQuarter, formData.year ?? new Date().getFullYear())
                  setFormData({
                    ...formData,
                    quarter: newQuarter,
                    startDate: formatDateForInput(dates.startDate),
                    endDate: formatDateForInput(dates.endDate)
                  })
                }}
              >
                <option value={1}>Q1 (Jan - Mar)</option>
                <option value={2}>Q2 (Apr - Jun)</option>
                <option value={3}>Q3 (Jul - Sep)</option>
                <option value={4}>Q4 (Oct - Dec)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <select
                id="year"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                value={formData.year ?? new Date().getFullYear()}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value)
                  const dates = getQuarterDates(formData.quarter ?? 1, newYear)
                  setFormData({
                    ...formData,
                    year: newYear,
                    startDate: formatDateForInput(dates.startDate),
                    endDate: formatDateForInput(dates.endDate)
                  })
                }}
              >
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {period === Period.CUSTOM && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1"
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1"
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
          </div>
        )}

        {formData.startDate && formData.endDate && (
          <div className="bg-slate-50 p-3 rounded-md">
            <div className="text-xs text-slate-600">
              <strong>Duration:</strong> {formatPeriod(period || Period.QUARTERLY, formData.startDate || '')}
              {' • '}
              {Math.ceil((new Date(formData.endDate || '').getTime() - new Date(formData.startDate || '').getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          </div>
        )}
      </TabsContent>

      {/* Advanced Tab - Owner, Context, Parent, Visibility */}
      <TabsContent value="advanced" className="space-y-4 mt-4">
        {nodeType === 'obj' && (
          <>
            {/* Linked Key Results with Weights */}
            {formData.okrId && (
              <div>
                <Label>Linked Key Results</Label>
                <LinkedKeyResults
                  objectiveId={formData.okrId as string}
                  onRefresh={async () => {
                    // Refresh objective data to get updated linked KRs
                    try {
                      const response = await api.get(`/objectives/${formData.okrId}`)
                      // Update formData with fresh keyResults if needed
                      // The component will re-fetch on its own via useEffect
                    } catch (error) {
                      console.error('Failed to refresh objective:', error)
                    }
                  }}
                  canEdit={canEdit}
                />
              </div>
            )}

            {/* Strategic Pillar Selection */}
            {nodeType === 'obj' && (
              <div>
                <Label htmlFor="pillarId">Strategic Pillar</Label>
                <select
                  id="pillarId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
                  value={formData.pillarId || ''}
                  disabled={!canEdit || lockInfo.isLocked}
                  onChange={async (e) => {
                    const pillarId = e.target.value || null
                    setFormData({ ...formData, pillarId })
                    // Persist via standard PATCH
                    if (formData.okrId && canEdit && !lockInfo.isLocked) {
                      try {
                        await api.patch(`/objectives/${formData.okrId}`, { pillarId })
                      } catch (error: any) {
                        console.error('Failed to update pillar:', error)
                        toast({
                          title: 'Error',
                          description: 'Failed to update pillar. Please try again.',
                          variant: 'destructive',
                        })
                      }
                    }
                  }}
                >
                  <option value="">No pillar</option>
                  {availablePillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.id}>
                      {pillar.name}
                    </option>
                  ))}
                </select>
                {formData.pillarId && availablePillars.find(p => p.id === formData.pillarId)?.color && (
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: availablePillars.find(p => p.id === formData.pillarId)?.color || undefined }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {availablePillars.find(p => p.id === formData.pillarId)?.name}
                    </span>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Link this objective to a strategic pillar for reporting and grouping.
                </p>
              </div>
            )}

            {/* Visibility Level Selection */}
            <div>
              <Label htmlFor="visibilityLevel">Visibility Level</Label>
              <select
                id="visibilityLevel"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
                value={formData.visibilityLevel || 'PUBLIC_TENANT'}
                disabled={!canEdit}
                onChange={(e) => setFormData({ ...formData, visibilityLevel: e.target.value })}
              >
                <option value="PUBLIC_TENANT">Public (Visible to everyone - default)</option>
                <option value="PRIVATE">🔒 Private (HR, Legal, M&A confidential only)</option>
                <option value="WORKSPACE_ONLY" disabled>Workspace Only (Deprecated)</option>
                <option value="TEAM_ONLY" disabled>Team Only (Deprecated)</option>
                <option value="MANAGER_CHAIN" disabled>Manager Chain (Deprecated)</option>
                <option value="EXEC_ONLY" disabled>Executive Only (Deprecated)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {formData.visibilityLevel === 'PRIVATE' 
                  ? 'Only the owner and whitelisted users (configured in tenant settings) can view this OKR.'
                  : 'All OKRs are globally visible by default. Filters control what is shown in the UI, not permissions.'}
              </p>
            </div>

            {/* Publish Status Toggle */}
            {nodeType === 'obj' && formData.okrId && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label>Publish Status</Label>
                    <p className="text-xs text-slate-500 mt-1">
                      {formData.isPublished 
                        ? 'This objective is published and locked. Only organization administrators can edit published objectives.'
                        : 'This objective is in draft mode and can be edited freely.'}
                    </p>
                  </div>
                  <div className="ml-4">
                    {(() => {
                      // Check if user can publish (tenant admin/owner or workspace lead for workspace-level OKRs)
                      const canPublish = isTenantAdmin || 
                        (formData.workspaceId && tenantPermissions.canEditObjective({
                          id: formData.okrId,
                          ownerId: formData.ownerId as string || '',
                          tenantId: formData.tenantId as string | null || null,
                          workspaceId: formData.workspaceId as string | null || null,
                          teamId: formData.teamId as string | null || null,
                          isPublished: false,
                          cycle: formData.cycle as { id: string; status: string } | null || null,
                          cycleStatus: formData.cycleStatus as string | null || null,
                        }))
                      
                      // Can unpublish if user can edit (tenant admin can always unpublish)
                      const canUnpublish = isTenantAdmin || canEdit
                      
                      const canToggle = formData.isPublished ? canUnpublish : canPublish
                      
                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!formData.okrId || !canToggle || lockInfo.isLocked) return
                            
                            if (!canPublish && formData.isPublished === false) {
                              toast({
                                title: 'Permission denied',
                                description: 'Only organization administrators or workspace leads can publish objectives.',
                                variant: 'destructive',
                              })
                              return
                            }

                            const newIsPublished = !formData.isPublished
                            
                            try {
                              await api.patch(`/objectives/${formData.okrId}`, { 
                                isPublished: newIsPublished 
                              })
                              
                              setFormData({ ...formData, isPublished: newIsPublished })
                              
                              toast({
                                title: newIsPublished ? 'Objective published' : 'Objective unpublished',
                                description: newIsPublished 
                                  ? 'This objective is now published and locked for editing.'
                                  : 'This objective is now in draft mode and can be edited.',
                              })
                            } catch (error: any) {
                              console.error('Failed to update publish status:', error)
                              const errorMessage = error.response?.data?.message || error.message || 'Failed to update publish status'
                              toast({
                                title: 'Error',
                                description: errorMessage,
                                variant: 'destructive',
                              })
                            }
                          }}
                          disabled={!canToggle || lockInfo.isLocked}
                          className={`
                            px-4 py-2 rounded-md text-sm font-medium transition-colors
                            ${formData.isPublished
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              : 'bg-violet-600 text-white hover:bg-violet-700'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                        >
                          {formData.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                      )
                    })()}
                  </div>
                </div>
                {!isTenantAdmin && formData.isPublished === false && formData.workspaceId && (
                  <p className="text-xs text-slate-500 mt-2">
                    Only organization administrators or workspace leads can publish objectives.
                  </p>
                )}
                {!isTenantAdmin && formData.isPublished === false && !formData.workspaceId && (
                  <p className="text-xs text-slate-500 mt-2">
                    Only organization administrators can publish organization-level objectives.
                  </p>
                )}
              </div>
            )}
            
            {/* Tags */}
            {formData.okrId && (
              <div>
                <Label>Tags</Label>
                <TagSelector
                  entityType="objective"
                  entityId={formData.okrId as string}
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  currentOrganizationId={currentOrganization?.id || null}
                  canEdit={canEdit}
                  disabled={lockInfo.isLocked}
                />
              </div>
            )}

            {/* Contributors */}
            {formData.okrId && (
              <div>
                <Label>Contributors</Label>
                <ContributorSelector
                  entityType="objective"
                  entityId={formData.okrId as string}
                  selectedContributors={selectedContributors}
                  onContributorsChange={setSelectedContributors}
                  availableUsers={availableUsers}
                  currentOrganizationId={currentOrganization?.id || null}
                  canEdit={canEdit}
                  disabled={lockInfo.isLocked}
                />
              </div>
            )}

            {/* Sponsor */}
            {formData.okrId && (
              <div>
                <Label>Sponsor</Label>
                <SponsorSelector
                  objectiveId={formData.okrId as string}
                  sponsorId={sponsorId}
                  onSponsorChange={setSponsorId}
                  availableUsers={availableUsers}
                  currentOrganizationId={currentOrganization?.id || null}
                  canEdit={canEdit}
                  disabled={lockInfo.isLocked}
                />
              </div>
            )}

            {/* Review Section */}
            {formData.okrId && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label>Review</Label>
                  <div className="space-y-3 mt-2">
                    {/* Confidence Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="confidence" className="text-sm font-normal">
                          Confidence: {formData.confidence ?? 0}%
                        </Label>
                        <Input
                          id="confidence-numeric"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.confidence ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            const clamped = Math.max(0, Math.min(100, val))
                            setFormData({ ...formData, confidence: clamped })
                            setReviewError(null)
                          }}
                          className="w-20 h-8 text-sm"
                          disabled={!canEdit || lockInfo.isLocked}
                        />
                      </div>
                      <input
                        id="confidence"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={formData.confidence ?? 0}
                        onChange={(e) => {
                          setFormData({ ...formData, confidence: parseInt(e.target.value) })
                          setReviewError(null)
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        disabled={!canEdit || lockInfo.isLocked}
                      />
                      {reviewError && (
                        <p className="text-xs text-red-600 mt-1">{reviewError}</p>
                      )}
                    </div>

                    {/* Review Frequency */}
                    <div>
                      <Label htmlFor="reviewFrequency">Review Frequency</Label>
                      <select
                        id="reviewFrequency"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
                        value={formData.reviewFrequency || ''}
                        onChange={async (e) => {
                          const frequency = e.target.value || null
                          setFormData({ ...formData, reviewFrequency: frequency as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | null })
                          // Persist frequency via standard PATCH
                          if (formData.okrId && canEdit && !lockInfo.isLocked) {
                            try {
                              await api.patch(`/objectives/${formData.okrId}`, { reviewFrequency: frequency })
                            } catch (error: any) {
                              console.error('Failed to update review frequency:', error)
                            }
                          }
                        }}
                        disabled={!canEdit || lockInfo.isLocked}
                      >
                        <option value="">Not set</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                      </select>
                    </div>

                    {/* Review Note */}
                    <div>
                      <Label htmlFor="reviewNote">Review Note (Optional)</Label>
                      <textarea
                        id="reviewNote"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Add notes about this review..."
                        disabled={!canEdit || lockInfo.isLocked || isReviewing}
                      />
                    </div>

                    {/* Last Reviewed At */}
                    {formData.lastReviewedAt && (
                      <div className="text-xs text-muted-foreground">
                        Last reviewed: {new Date(formData.lastReviewedAt).toLocaleString()}
                      </div>
                    )}

                    {/* Mark Reviewed Button */}
                    <Button
                      type="button"
                      onClick={async () => {
                        if (!formData.okrId || !canEdit || lockInfo.isLocked || isReviewing) return

                        // Validate confidence
                        const confidence = formData.confidence ?? undefined
                        if (confidence !== undefined && (confidence < 0 || confidence > 100)) {
                          setReviewError('Confidence must be between 0 and 100')
                          return
                        }

                        setIsReviewing(true)
                        setReviewError(null)

                        try {
                          await api.patch(`/objectives/${formData.okrId}/review`, {
                            confidence,
                            note: reviewNote.trim() || undefined,
                          })
                          
                          // Refresh objective data to get updated lastReviewedAt
                          const response = await api.get(`/objectives/${formData.okrId}`)
                          setFormData({
                            ...formData,
                            confidence: response.data.confidence ?? null,
                            lastReviewedAt: response.data.lastReviewedAt ?? null,
                          })
                          setReviewNote('')
                        } catch (error: any) {
                          if (error.response?.status === 400) {
                            setReviewError(error.response.data.message || 'Invalid confidence value')
                          } else {
                            setReviewError('Failed to save review. Please try again.')
                          }
                        } finally {
                          setIsReviewing(false)
                        }
                      }}
                      disabled={!canEdit || lockInfo.isLocked || isReviewing}
                      className="w-full"
                    >
                      {isReviewing ? 'Saving...' : 'Mark Reviewed'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Owner Selection */}
            <div>
              <Label>Owner</Label>
              <div className="relative dropdown-container mt-1">
                <button
                  type="button"
                  onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
                >
                  <span>{getOwnerDisplay()}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
                {showOwnerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                    <div className="p-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search users..."
                          value={ownerSearch}
                          onChange={(e) => setOwnerSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        onClick={() => {
                          const userName = user?.firstName && user?.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user?.email || ''
                          setFormData({ ...formData, ownerId: user?.id || '', ownerName: userName })
                          setShowOwnerDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        disabled={!canEdit}
                      >
                        <User className="h-4 w-4" />
                        {user?.firstName && user?.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user?.email || 'You'} (You)
                      </button>
                      {availableUsers
                        .filter(u => u.id !== user?.id && u.name.toLowerCase().includes(ownerSearch.toLowerCase()))
                        .map((user) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setFormData({ ...formData, ownerId: user.id, ownerName: user.name })
                              setShowOwnerDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          >
                            <User className="h-4 w-4" />
                            {user.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Context Selection */}
            <div>
              <Label>Assign To</Label>
              <div className="relative dropdown-container mt-1">
                <button
                  type="button"
                  onClick={() => setShowContextDropdown(!showContextDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
                >
                  <span>{getContextDisplay()}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
                {showContextDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                    <div className="p-2">
                      <Input
                        placeholder="Search context..."
                        value={contextSearch}
                        onChange={(e) => setContextSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        onClick={() => {
                          setFormData({ ...formData, tenantId: '', workspaceId: '', teamId: '' })
                          setShowContextDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <User className="h-4 w-4" />
                        Personal
                      </button>
                      {organizations
                        .filter(org => org.name.toLowerCase().includes(contextSearch.toLowerCase()))
                        .map((org) => (
                          <button
                            key={org.id}
                            onClick={() => {
                              setFormData({ ...formData, tenantId: org.id, workspaceId: '', teamId: '' })
                              setShowContextDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Building2 className="h-4 w-4" />
                            {org.name} (Organization)
                          </button>
                        ))}
                      {workspaces
                        .filter(ws => ws.name.toLowerCase().includes(contextSearch.toLowerCase()))
                        .map((ws) => (
                          <button
                            key={ws.id}
                            onClick={() => {
                              setFormData({ ...formData, tenantId: '', workspaceId: ws.id, teamId: '' })
                              setShowContextDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Building2 className="h-4 w-4" />
                            {ws.name} (Workspace)
                          </button>
                        ))}
                      {teams
                        .filter(team => team.name.toLowerCase().includes(contextSearch.toLowerCase()))
                        .map((team) => (
                          <button
                            key={team.id}
                            onClick={() => {
                              setFormData({ ...formData, tenantId: '', workspaceId: '', teamId: team.id })
                              setShowContextDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Users className="h-4 w-4" />
                            {team.name} (Team)
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Parent Objective Selection */}
            <div>
              <Label>Parent Objective (Optional)</Label>
              <div className="relative dropdown-container mt-1">
                <button
                  type="button"
                  onClick={() => setShowParentDropdown(!showParentDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
                >
                  <span>{getParentDisplay()}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
                {showParentDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                    <div className="p-2">
                      <Input
                        placeholder="Search objectives..."
                        value={parentSearch}
                        onChange={(e) => setParentSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        onClick={() => {
                          setFormData({ ...formData, parentId: '' })
                          setShowParentDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Target className="h-4 w-4" />
                        No parent (top-level objective)
                      </button>
                      {availableObjectives
                        .filter(obj => 
                          obj.id !== formData.okrId && 
                          obj.title.toLowerCase().includes(parentSearch.toLowerCase())
                        )
                        .map((objective) => (
                          <button
                            key={objective.id}
                            onClick={() => {
                              setFormData({ ...formData, parentId: objective.id })
                              setShowParentDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Target className="h-4 w-4" />
                            {objective.title}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              {alignmentError?.code === 'ALIGNMENT_DATE_OUT_OF_RANGE' && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{alignmentError.message || 'Dates must be within the parent objective\'s date range.'}</p>
                </div>
              )}
              {alignmentError?.code === 'ALIGNMENT_CYCLE_MISMATCH' && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{alignmentError.message || 'Cycle must match the parent objective cycle.'}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tags and Contributors for Key Results */}
        {nodeType === 'kr' && formData.okrId && (
          <>
            <div>
              <Label>Tags</Label>
              <TagSelector
                entityType="key-result"
                entityId={formData.okrId as string}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                currentOrganizationId={currentOrganization?.id || null}
                canEdit={canEdit}
                disabled={lockInfo.isLocked}
              />
            </div>
            <div>
              <Label>Contributors</Label>
              <ContributorSelector
                entityType="key-result"
                entityId={formData.okrId as string}
                selectedContributors={selectedContributors}
                onContributorsChange={setSelectedContributors}
                availableUsers={availableUsers}
                currentOrganizationId={currentOrganization?.id || null}
                canEdit={canEdit}
                disabled={lockInfo.isLocked}
              />
            </div>
          </>
        )}

        {/* Tags and Contributors for Initiatives */}
        {nodeType === 'init' && formData.okrId && (
          <>
            <div>
              <Label>Tags</Label>
              <TagSelector
                entityType="initiative"
                entityId={formData.okrId as string}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                currentOrganizationId={currentOrganization?.id || null}
                canEdit={canEdit}
                disabled={lockInfo.isLocked}
              />
            </div>
            <div>
              <Label>Contributors</Label>
              <ContributorSelector
                entityType="initiative"
                entityId={formData.okrId as string}
                selectedContributors={selectedContributors}
                onContributorsChange={setSelectedContributors}
                availableUsers={availableUsers}
                currentOrganizationId={currentOrganization?.id || null}
                canEdit={canEdit}
                disabled={lockInfo.isLocked}
              />
            </div>
          </>
        )}

        {nodeType === 'kr' && (
          <div>
            <Label htmlFor="metricType">Metric Type</Label>
            <select
              id="metricType"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
              value={formData.metricType || 'INCREASE'}
              onChange={(e) => setFormData({ ...formData, metricType: e.target.value as 'INCREASE' | 'DECREASE' | 'REACH' | 'MAINTAIN' })}
            >
              <option value="INCREASE">Increase</option>
              <option value="DECREASE">Decrease</option>
              <option value="REACH">Reach</option>
              <option value="MAINTAIN">Maintain</option>
            </select>
          </div>
        )}
      </TabsContent>
    </Tabs>
    </div>
  )
}


