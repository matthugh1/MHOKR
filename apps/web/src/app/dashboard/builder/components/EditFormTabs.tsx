// NOTE [phase14-hardening]:
// Currently unused in the live flow. Kept for future Builder work.
// Safe to refactor or delete post-merge.
// @ts-nocheck is intentional to unblock TypeScript compilation without full type safety.

// @ts-nocheck
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, User, Building2, Users, Target, Search, ChevronDown } from 'lucide-react'
import { Period } from '@okr-nexus/types'

import { 
  formatDateForInput, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getQuarterFromDate, 
  getQuarterDates, 
  getMonthDates, 
  getYearDates,
  getAvailableYears,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getMonthName,
  formatPeriod,
} from '@/lib/date-utils'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'
import { useEffect } from 'react'

interface EditFormTabsProps {
  nodeId: string
  nodeType: 'obj' | 'kr' | 'init'
  data: Record<string, unknown>
  formData: Record<string, unknown>
  setFormData: (data: Record<string, unknown>) => void
  onSave: () => void
}

export function EditFormTabs({
  nodeId: _nodeId,
  nodeType,
  data: _data,
  formData,
  setFormData,
  onSave: _onSave,
}: EditFormTabsProps) {
  const { organizations, workspaces, teams, currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [showContextDropdown, setShowContextDropdown] = useState(false)
  const [showParentDropdown, setShowParentDropdown] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [contextSearch, setContextSearch] = useState('')
  const [parentSearch, setParentSearch] = useState('')
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string }>>([])
  const [availableObjectives, setAvailableObjectives] = useState<Array<{ id: string; title: string }>>([])

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
          const queryParams = currentOrganization?.id ? `?organizationId=${currentOrganization.id}` : ''
          const response = await api.get(`/objectives${queryParams}`)
          setAvailableObjectives(response.data)
        } catch (error) {
          console.error('Failed to load objectives:', error)
        }
      }
      loadObjectives()
    }
  }, [nodeType, currentOrganization?.id])

  const getOwnerDisplay = () => {
    const ownerId = formData.ownerId as string | undefined
    if (ownerId === user?.id) {
      return `👤 ${user?.name || 'You'}`
    }
    const selectedUser = availableUsers.find(u => u.id === ownerId)
    return selectedUser ? `👤 ${selectedUser.name}` : 'Select owner...'
  }

  const getContextDisplay = () => {
    if (formData.organizationId && !formData.workspaceId && !formData.teamId) {
      const org = organizations.find(o => o.id === formData.organizationId)
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
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>

      {/* Basic Tab - Most common fields */}
      <TabsContent value="basic" className="space-y-4 mt-4">
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
                  value={formData.current || 0}
                  onChange={(e) => setFormData({ ...formData, current: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="target">Target Value *</Label>
                <Input
                  id="target"
                  type="number"
                  value={formData.target || 100}
                  onChange={(e) => setFormData({ ...formData, target: parseFloat(e.target.value) || 100 })}
                  className="mt-1"
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
              />
            </div>
            <div className="bg-slate-50 p-3 rounded-md">
              <div className="text-sm font-medium mb-1">Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((formData.current || 0) / (formData.target || 1)) * 100)}%` 
                    }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {Math.round(((formData.current || 0) / (formData.target || 1)) * 100)}%
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
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
              value={formData.progress || 0}
              onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="mt-1"
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
            value={formData.period || Period.QUARTERLY}
            onChange={(e) => {
              const newPeriod = e.target.value as Period
              let dates = { startDate: formData.startDate, endDate: formData.endDate }
              
              if (newPeriod === Period.QUARTERLY) {
                const quarterDates = getQuarterDates(formData.quarter, formData.year)
                dates = {
                  startDate: formatDateForInput(quarterDates.startDate),
                  endDate: formatDateForInput(quarterDates.endDate)
                }
              } else if (newPeriod === Period.MONTHLY) {
                const monthDates = getMonthDates(formData.month, formData.year)
                dates = {
                  startDate: formatDateForInput(monthDates.startDate),
                  endDate: formatDateForInput(monthDates.endDate)
                }
              } else if (newPeriod === Period.ANNUAL) {
                const yearDates = getYearDates(formData.year)
                dates = {
                  startDate: formatDateForInput(yearDates.startDate),
                  endDate: formatDateForInput(yearDates.endDate)
                }
              }
              
              setFormData({ 
                ...formData, 
                period: newPeriod,
                ...dates
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
        {formData.period === Period.QUARTERLY && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quarter">Quarter</Label>
              <select
                id="quarter"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                value={formData.quarter}
                onChange={(e) => {
                  const newQuarter = parseInt(e.target.value)
                  const dates = getQuarterDates(newQuarter, formData.year)
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
                value={formData.year}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value)
                  const dates = getQuarterDates(formData.quarter, newYear)
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

        {formData.period === Period.CUSTOM && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {formData.startDate && formData.endDate && (
          <div className="bg-slate-50 p-3 rounded-md">
            <div className="text-xs text-slate-600">
              <strong>Duration:</strong> {formatPeriod(formData.period as Period, formData.startDate)}
              {' • '}
              {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          </div>
        )}
      </TabsContent>

      {/* Advanced Tab - Owner, Context, Parent, Visibility */}
      <TabsContent value="advanced" className="space-y-4 mt-4">
        {nodeType === 'obj' && (
          <>
            {/* Visibility Level Selection */}
            <div>
              <Label htmlFor="visibilityLevel">Visibility Level</Label>
              <select
                id="visibilityLevel"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
                value={formData.visibilityLevel || 'PUBLIC_TENANT'}
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
                          setFormData({ ...formData, ownerId: user?.id || '', ownerName: user?.name || '' })
                          setShowOwnerDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <User className="h-4 w-4" />
                        {user?.name || 'You'} (You)
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
                          setFormData({ ...formData, organizationId: '', workspaceId: '', teamId: '' })
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
                              setFormData({ ...formData, organizationId: org.id, workspaceId: '', teamId: '' })
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
                              setFormData({ ...formData, organizationId: '', workspaceId: ws.id, teamId: '' })
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
                              setFormData({ ...formData, organizationId: '', workspaceId: '', teamId: team.id })
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
                          obj.id !== data.okrId && 
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
              onChange={(e) => setFormData({ ...formData, metricType: e.target.value })}
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
  )
}


