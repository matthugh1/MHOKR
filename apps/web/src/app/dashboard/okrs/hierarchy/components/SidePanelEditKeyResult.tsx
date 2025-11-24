'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchableUserSelect } from '@/components/okr/SearchableUserSelect'
import { GoalTypeSelector } from '@/components/okr/GoalTypeSelector'
import { TagSelector } from '@/components/okr/TagSelector'
import { ContributorSelector } from '@/components/okr/ContributorSelector'
import { OwnerList } from '@/components/okr/OwnerList'
import { PhasedTargetTimeline } from '@/components/okr/PhasedTargetTimeline'
import { PhasedTargetEditor } from '@/components/okr/PhasedTargetEditor'
import { StandardCycleSelector } from '@/components/okr/StandardCycleSelector'
import { MetricTypeSelector } from '@/components/okr/MetricTypeSelector'
import { UnitInput } from '@/components/okr/UnitInput'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import {
  getKeyResultOwners,
  addKeyResultOwner,
  removeKeyResultOwner,
  type Owner,
} from '@/lib/okr-owners-api'
import { HierarchyOKRNode } from './types'
import { AlertCircle, Loader2 } from 'lucide-react'
import { MetricType } from '@okr-nexus/types'

type OKRStatus = 'NOT_STARTED' | 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'
type CheckInCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'NONE'
type VisibilityLevel = 'PUBLIC_TENANT' | 'PRIVATE'

interface SidePanelEditKeyResultProps {
  selectedNode: HierarchyOKRNode | null
  onSave: (data: {
    title: string
    description?: string
    ownerId: string
    metricType: MetricType
    startValue: number
    targetValue: number
    currentValue: number
    unit?: string
    status: OKRStatus
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    teamId?: string | null
    checkInCadence?: CheckInCadence
    cycleId?: string
    startDate?: string
    endDate?: string
    visibilityLevel: VisibilityLevel
  }) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  activeCycles?: Array<{ id: string; name: string; status: string }>
  currentOrganization?: { id: string } | null
}

export function SidePanelEditKeyResult({
  selectedNode,
  onSave,
  onCancel,
  availableUsers = [],
  availableTeams = [],
  activeCycles = [],
  currentOrganization,
}: SidePanelEditKeyResultProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [metricType, setMetricType] = useState<MetricType>(MetricType.INCREASE)
  const [startValue, setStartValue] = useState<number>(0)
  const [targetValue, setTargetValue] = useState<number>(100)
  const [currentValue, setCurrentValue] = useState<number>(0)
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState<OKRStatus>('ON_TRACK')
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [teamId, setTeamId] = useState<string | null>(null)
  const [checkInCadence, setCheckInCadence] = useState<CheckInCadence>('NONE')
  const [cycleId, setCycleId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>('PUBLIC_TENANT')
  const [selectedTags, setSelectedTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedContributors, setSelectedContributors] = useState<Array<{ id: string; user: { id: string; name: string; email?: string; avatar?: string | null }; role: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [owners, setOwners] = useState<Owner[]>([])
  const [isLoadingOwners, setIsLoadingOwners] = useState(false)
  const [showPhasedTargetEditor, setShowPhasedTargetEditor] = useState(false)
  const [editingPhasedTarget, setEditingPhasedTarget] = useState<any>(null)
  const [loadedKrData, setLoadedKrData] = useState<any>(null)

  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()

  // Load KR data when node changes
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'keyResult') {
      loadKeyResultData()
    }
  }, [selectedNode?.id])

  const loadKeyResultData = async () => {
    if (!selectedNode?.id) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get(`/key-results/${selectedNode.id}`)
      const kr = response.data
      
      // Load tags and contributors
      const tagsResponse = await api.get(`/key-results/${selectedNode.id}/tags`).catch(() => ({ data: [] }))
      const contributorsResponse = await api.get(`/key-results/${selectedNode.id}/contributors`).catch(() => ({ data: [] }))
      
      const fullData = {
        ...kr,
        tags: tagsResponse.data || [],
        contributors: contributorsResponse.data || [],
      }
      
      setLoadedKrData(fullData)
      populateForm(fullData)
    } catch (err: any) {
      console.error('Failed to load key result:', err)
      setError(err.response?.data?.message || 'Failed to load key result')
      toast({
        title: 'Error',
        description: 'Failed to load key result data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const populateForm = (data: any) => {
    if (!data) return

    setTitle(data.title || '')
    setDescription(data.description || '')
    setOwnerId(data.ownerId || '')
    const validMetricType = (data.metricType && Object.values(MetricType).includes(data.metricType as MetricType))
      ? (data.metricType as MetricType)
      : MetricType.INCREASE
    setMetricType(validMetricType)
    setStartValue(data.startValue ?? 0)
    setTargetValue(data.targetValue ?? 100)
    setCurrentValue(data.currentValue ?? 0)
    setUnit(data.unit || '')
    setStatus(data.status || 'ON_TRACK')
    setGoalType(data.goalType || 'ASPIRATIONAL')
    setTeamId(data.teamId || null)
    setCheckInCadence(data.checkInCadence || 'NONE')
    setCycleId(data.cycleId || '')
    setStartDate(data.startDate ? data.startDate.split('T')[0] : '')
    setEndDate(data.endDate ? data.endDate.split('T')[0] : '')
    setVisibilityLevel(data.visibilityLevel || 'PUBLIC_TENANT')
    setSelectedTags(data.tags || [])
    setSelectedContributors(data.contributors || [])
  }

  // Load owners
  useEffect(() => {
    const loadOwners = async () => {
      if (selectedNode?.id) {
        setIsLoadingOwners(true)
        try {
          const ownersData = await getKeyResultOwners(selectedNode.id)
          setOwners(ownersData)
        } catch (error) {
          console.error('Failed to load owners:', error)
          setOwners([])
        } finally {
          setIsLoadingOwners(false)
        }
      } else {
        setOwners([])
      }
    }
    loadOwners()
  }, [selectedNode?.id])

  const handleAddOwner = async (userId: string) => {
    if (!selectedNode?.id) return
    await addKeyResultOwner(selectedNode.id, userId)
    const ownersData = await getKeyResultOwners(selectedNode.id)
    setOwners(ownersData)
  }

  const handleRemoveOwner = async (userId: string) => {
    if (!selectedNode?.id) return
    await removeKeyResultOwner(selectedNode.id, userId)
    const ownersData = await getKeyResultOwners(selectedNode.id)
    setOwners(ownersData)
  }

  const canEdit = useMemo(() => {
    if (!loadedKrData || !selectedNode?.id) return false
    
    const firstObjective = (loadedKrData as any)?.objectives?.[0]?.objective || 
                          (loadedKrData as any)?.objectives?.[0] ||
                          null
    
    return tenantPermissions.canEditKeyResult({
      id: selectedNode.id,
      ownerId: loadedKrData.ownerId,
      tenantId: loadedKrData.tenantId,
      organizationId: loadedKrData.tenantId,
      workspaceId: firstObjective?.workspaceId || loadedKrData.workspaceId || null,
      teamId: firstObjective?.teamId || loadedKrData.teamId || null,
      parentObjective: firstObjective ? {
        id: firstObjective.id,
        ownerId: firstObjective.ownerId,
        organizationId: firstObjective.tenantId,
        workspaceId: firstObjective.workspaceId,
        teamId: firstObjective.teamId,
        isPublished: firstObjective.isPublished,
        visibilityLevel: firstObjective.visibilityLevel,
        cycle: firstObjective.cycleId ? { id: firstObjective.cycleId, status: firstObjective.cycle?.status } : null,
        cycleStatus: firstObjective.cycle?.status,
      } : null,
    })
  }, [selectedNode?.id, loadedKrData, tenantPermissions])

  const lockInfo = useMemo(() => {
    if (!loadedKrData) return { isLocked: false, message: '' }
    return tenantPermissions.getLockInfoForKeyResult?.(loadedKrData) || { isLocked: false, message: '' }
  }, [loadedKrData, tenantPermissions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedNode?.id) return

    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title is required',
        variant: 'destructive',
      })
      return
    }

    if (lockInfo.isLocked) {
      toast({
        title: 'Cannot Edit',
        description: lockInfo.message || 'This key result is locked and cannot be edited',
        variant: 'destructive',
      })
      return
    }
    
    if (!canEdit) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to edit this key result',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        ownerId,
        metricType,
        startValue,
        targetValue,
        currentValue,
        unit: unit.trim() || undefined,
        status,
        goalType,
        teamId: teamId || null,
        checkInCadence: checkInCadence === 'NONE' ? undefined : checkInCadence,
        cycleId: cycleId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        visibilityLevel,
      })
    } catch (err: any) {
      console.error('Failed to update key result:', err)
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update key result'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!selectedNode || selectedNode.type !== 'keyResult') {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-start justify-start p-6">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col w-full bg-slate-900 m-0 p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border-b border-slate-800 p-0 h-9">
            <TabsTrigger 
              value="basic" 
              className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
            >
              Basic
            </TabsTrigger>
            <TabsTrigger 
              value="metrics" 
              className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
            >
              Metrics
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger 
              value="metadata" 
              className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
            >
              Metadata
            </TabsTrigger>
          </TabsList>

          {lockInfo.isLocked && (
            <div className="p-4 mx-6 mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs">{lockInfo.message || 'This key result is locked and cannot be edited.'}</p>
            </div>
          )}

          {error && (
            <div className="p-4 mx-6 mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          {/* Basic Tab */}
          <TabsContent value="basic" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label htmlFor="kr-title" className="text-sm font-medium text-slate-200">
                Title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="kr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter key result title"
                required
                disabled={lockInfo.isLocked || !canEdit}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kr-description" className="text-sm font-medium text-slate-200">Description</Label>
              <Textarea
                id="kr-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter key result description (optional)"
                rows={2}
                disabled={lockInfo.isLocked || !canEdit}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 resize-none focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kr-owner" className="text-sm font-medium text-slate-200">
                Primary Owner <span className="text-red-400">*</span>
              </Label>
              <SearchableUserSelect
                value={ownerId}
                onValueChange={setOwnerId}
                availableUsers={availableUsers}
                placeholder="Select owner"
                id="kr-owner"
                required
                disabled={lockInfo.isLocked || !canEdit}
              />
            </div>

            {selectedNode.id && (
              <div className="space-y-2 border-t border-slate-800 pt-4">
                {isLoadingOwners ? (
                  <div className="text-sm text-slate-500">Loading owners...</div>
                ) : (
                  <OwnerList
                    owners={owners}
                    availableUsers={availableUsers}
                    onAddOwner={handleAddOwner}
                    onRemoveOwner={handleRemoveOwner}
                    canEdit={canEdit && !lockInfo.isLocked}
                    resourceType="keyResult"
                    resourceId={selectedNode.id}
                    size="md"
                  />
                )}
              </div>
            )}

            {selectedNode.id && loadedKrData && (
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <PhasedTargetTimeline
                  keyResultId={selectedNode.id}
                  canEdit={canEdit && !lockInfo.isLocked}
                  onAdd={() => {
                    setEditingPhasedTarget(null)
                    setShowPhasedTargetEditor(true)
                  }}
                  onEdit={(target) => {
                    setEditingPhasedTarget(target)
                    setShowPhasedTargetEditor(true)
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="kr-status" className="text-sm font-medium text-slate-200">
                Status <span className="text-red-400">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as OKRStatus)}
                disabled={lockInfo.isLocked || !canEdit}
                required
              >
                <SelectTrigger id="kr-status" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700 disabled:opacity-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="NOT_STARTED" className="text-white focus:bg-slate-700">Not Started</SelectItem>
                  <SelectItem value="ON_TRACK" className="text-white focus:bg-slate-700">On Track</SelectItem>
                  <SelectItem value="AT_RISK" className="text-white focus:bg-slate-700">At Risk</SelectItem>
                  <SelectItem value="OFF_TRACK" className="text-white focus:bg-slate-700">Off Track</SelectItem>
                  <SelectItem value="COMPLETED" className="text-white focus:bg-slate-700">Completed</SelectItem>
                  <SelectItem value="CANCELLED" className="text-white focus:bg-slate-700">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <GoalTypeSelector
              value={goalType}
              onValueChange={setGoalType}
              label="Goal Type"
              id="kr-goal-type"
              disabled={lockInfo.isLocked || !canEdit}
            />

            {availableTeams.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="kr-team" className="text-sm font-medium text-slate-200">Team</Label>
                <Select
                  value={teamId || 'none'}
                  onValueChange={(value) => setTeamId(value === 'none' ? null : value)}
                  disabled={lockInfo.isLocked || !canEdit}
                >
                  <SelectTrigger id="kr-team" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700 disabled:opacity-50">
                    <SelectValue placeholder="Select team (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="none" className="text-white focus:bg-slate-700">None</SelectItem>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id} className="text-white focus:bg-slate-700">
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="p-4 space-y-4 mt-0">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="kr-start" className="text-sm font-medium text-slate-200">Start Value</Label>
                <Input
                  id="kr-start"
                  type="number"
                  step="any"
                  value={startValue}
                  onChange={(e) => setStartValue(parseFloat(e.target.value) || 0)}
                  disabled={lockInfo.isLocked || !canEdit}
                  className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kr-current" className="text-sm font-medium text-slate-200">Current Value</Label>
                <Input
                  id="kr-current"
                  type="number"
                  step="any"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
                  disabled={lockInfo.isLocked || !canEdit}
                  className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kr-target" className="text-sm font-medium text-slate-200">
                  Target Value <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="kr-target"
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                  required
                  disabled={lockInfo.isLocked || !canEdit}
                  className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricTypeSelector
                value={metricType}
                onValueChange={setMetricType}
                disabled={lockInfo.isLocked || !canEdit}
                id="kr-metric"
              />
              <UnitInput
                value={unit}
                onValueChange={setUnit}
                disabled={lockInfo.isLocked || !canEdit}
                id="kr-unit"
              />
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label htmlFor="kr-cadence" className="text-sm font-medium text-slate-200">Check-in Cadence</Label>
              <Select
                value={checkInCadence}
                onValueChange={(value) => setCheckInCadence(value as CheckInCadence)}
                disabled={lockInfo.isLocked || !canEdit}
              >
                <SelectTrigger id="kr-cadence" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700 disabled:opacity-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="NONE" className="text-white focus:bg-slate-700">None</SelectItem>
                  <SelectItem value="WEEKLY" className="text-white focus:bg-slate-700">Weekly</SelectItem>
                  <SelectItem value="BIWEEKLY" className="text-white focus:bg-slate-700">Bi-weekly</SelectItem>
                  <SelectItem value="MONTHLY" className="text-white focus:bg-slate-700">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeCycles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="kr-cycle" className="text-sm font-medium text-slate-200">Cycle</Label>
                <StandardCycleSelector
                  value={cycleId}
                  onValueChange={setCycleId}
                  availableCycles={activeCycles}
                  disabled={lockInfo.isLocked || !canEdit}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="kr-start-date" className="text-sm font-medium text-slate-200">Start Date</Label>
                <Input
                  id="kr-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={lockInfo.isLocked || !canEdit}
                  className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kr-end-date" className="text-sm font-medium text-slate-200">End Date</Label>
                <Input
                  id="kr-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={lockInfo.isLocked || !canEdit}
                  className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kr-visibility" className="text-sm font-medium text-slate-200">
                Visibility <span className="text-red-400">*</span>
              </Label>
              <Select
                value={visibilityLevel}
                onValueChange={(value) => setVisibilityLevel(value as VisibilityLevel)}
                disabled={lockInfo.isLocked || !canEdit}
                required
              >
                <SelectTrigger id="kr-visibility" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700 disabled:opacity-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="PUBLIC_TENANT" className="text-white focus:bg-slate-700">Public (Tenant)</SelectItem>
                  <SelectItem value="PRIVATE" className="text-white focus:bg-slate-700">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="p-4 space-y-4 mt-0">
            {selectedNode.id ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-200">Tags</Label>
                  <TagSelector
                    entityType="key-result"
                    entityId={selectedNode.id}
                    selectedTags={selectedTags}
                    onTagsChange={setSelectedTags}
                    currentOrganizationId={currentOrganization?.id || null}
                    canEdit={canEdit && !lockInfo.isLocked}
                    disabled={lockInfo.isLocked || !canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-200">Contributors</Label>
                  <ContributorSelector
                    entityType="key-result"
                    entityId={selectedNode.id}
                    selectedContributors={selectedContributors}
                    onContributorsChange={setSelectedContributors}
                    availableUsers={availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email, avatar: null }))}
                    currentOrganizationId={currentOrganization?.id || null}
                    canEdit={canEdit && !lockInfo.isLocked}
                    disabled={lockInfo.isLocked || !canEdit}
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 py-4">
                Save the Key Result first to add tags and contributors.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-10">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId || lockInfo.isLocked || !canEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium">
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* Phased Target Editor Modal */}
      {selectedNode.id && loadedKrData && (
        <PhasedTargetEditor
          isOpen={showPhasedTargetEditor}
          onClose={() => {
            setShowPhasedTargetEditor(false)
            setEditingPhasedTarget(null)
          }}
          onSuccess={() => {
            // Timeline will reload automatically
          }}
          keyResultId={selectedNode.id}
          startDate={loadedKrData.startDate ? new Date(loadedKrData.startDate) : undefined}
          endDate={loadedKrData.endDate ? new Date(loadedKrData.endDate) : undefined}
          startValue={loadedKrData.startValue}
          targetValue={loadedKrData.targetValue}
          existingTarget={editingPhasedTarget}
        />
      )}
    </>
  )
}

