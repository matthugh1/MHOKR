'use client'

import React, { useState, useEffect } from 'react'
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
import { StandardCycleSelector } from '@/components/okr/StandardCycleSelector'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { HierarchyOKRNode } from './types'
import { AlertCircle, Loader2 } from 'lucide-react'

type InitiativeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
type VisibilityLevel = 'PUBLIC_TENANT' | 'PRIVATE'

interface SidePanelEditInitiativeProps {
  selectedNode: HierarchyOKRNode | null
  onSave: (data: {
    title: string
    description?: string
    ownerId: string
    status: InitiativeStatus
    progress?: number | null
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    teamId?: string | null
    cycleId?: string
    startDate?: string
    endDate?: string
    dueDate?: string
  }) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  availableCycles?: Array<{ id: string; name: string }>
  currentOrganization?: { id: string } | null
}

export function SidePanelEditInitiative({
  selectedNode,
  onSave,
  onCancel,
  availableUsers = [],
  availableTeams = [],
  availableCycles = [],
  currentOrganization,
}: SidePanelEditInitiativeProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [status, setStatus] = useState<InitiativeStatus>('NOT_STARTED')
  const [progress, setProgress] = useState<number | null>(null)
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [teamId, setTeamId] = useState<string | null>(null)
  const [cycleId, setCycleId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedContributors, setSelectedContributors] = useState<Array<{ id: string; user: { id: string; name: string; email?: string; avatar?: string | null }; role: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('basic')

  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()

  // Load initiative data when node changes
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'initiative') {
      loadInitiativeData()
    }
  }, [selectedNode?.id])

  const loadInitiativeData = async () => {
    if (!selectedNode?.id) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get(`/initiatives/${selectedNode.id}`)
      const initiative = response.data
      
      // Load tags and contributors
      const tagsResponse = await api.get(`/initiatives/${selectedNode.id}/tags`).catch(() => ({ data: [] }))
      const contributorsResponse = await api.get(`/initiatives/${selectedNode.id}/contributors`).catch(() => ({ data: [] }))
      
      const fullData = {
        ...initiative,
        tags: tagsResponse.data || [],
        contributors: contributorsResponse.data || [],
      }
      
      populateForm(fullData)
    } catch (err: any) {
      console.error('Failed to load initiative:', err)
      setError(err.response?.data?.message || 'Failed to load initiative')
      toast({
        title: 'Error',
        description: 'Failed to load initiative data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const populateForm = (data: any) => {
    setTitle(data.title || '')
    setDescription(data.description || '')
    setOwnerId(data.ownerId || '')
    setStatus(data.status || 'NOT_STARTED')
    setProgress(data.progress ?? null)
    setGoalType(data.goalType || 'ASPIRATIONAL')
    setTeamId(data.teamId || null)
    setCycleId(data.cycleId || '')
    setStartDate(data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '')
    setEndDate(data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '')
    setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '')
    setSelectedTags(data.tags || [])
    setSelectedContributors(data.contributors || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await onSave({
        title,
        description: description || undefined,
        ownerId,
        status,
        progress: progress !== null ? progress : undefined,
        goalType,
        teamId: teamId || undefined,
        cycleId: cycleId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        dueDate: dueDate || undefined,
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save initiative')
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to save initiative',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error && !selectedNode) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-400 mb-4">
          <AlertCircle size={16} />
          <span className="text-sm font-medium">Error</span>
        </div>
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6 mt-0">
            {/* Title */}
            <div>
              <Label htmlFor="title" className="text-sm font-semibold text-slate-300 mb-2 block">
                Title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter initiative title"
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-sm font-semibold text-slate-300 mb-2 block">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter initiative description"
                rows={4}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Owner */}
            <div>
              <Label className="text-sm font-semibold text-slate-300 mb-2 block">
                Owner <span className="text-red-400">*</span>
              </Label>
              <SearchableUserSelect
                users={availableUsers}
                selectedUserId={ownerId}
                onUserSelect={setOwnerId}
                placeholder="Select owner"
              />
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status" className="text-sm font-semibold text-slate-300 mb-2 block">
                Status <span className="text-red-400">*</span>
              </Label>
              <Select value={status} onValueChange={(value: string) => setStatus(value as InitiativeStatus)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Progress */}
            <div>
              <Label htmlFor="progress" className="text-sm font-semibold text-slate-300 mb-2 block">
                Progress (%)
              </Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                step="1"
                value={progress !== null ? progress : ''}
                onChange={(e) => setProgress(e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="0-100"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Enter a value between 0 and 100, or leave empty</p>
            </div>

            {/* Goal Type */}
            <div>
              <Label className="text-sm font-semibold text-slate-300 mb-2 block">
                Goal Type
              </Label>
              <GoalTypeSelector
                value={goalType}
                onChange={setGoalType}
              />
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6 mt-0">
            {/* Cycle */}
            {availableCycles.length > 0 && (
              <div>
                <Label className="text-sm font-semibold text-slate-300 mb-2 block">
                  Cycle
                </Label>
                <StandardCycleSelector
                  cycles={availableCycles.map(c => ({ id: c.id, name: c.name, status: 'ACTIVE' }))}
                  selectedCycleId={cycleId}
                  onCycleChange={setCycleId}
                  placeholder="Select cycle (optional)"
                />
              </div>
            )}

            {/* Team */}
            {availableTeams.length > 0 && (
              <div>
                <Label htmlFor="team" className="text-sm font-semibold text-slate-300 mb-2 block">
                  Team
                </Label>
                <Select
                  value={teamId || '__none__'}
                  onValueChange={(value) => setTeamId(value === '__none__' ? null : value)}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select team (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No team</SelectItem>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-sm font-semibold text-slate-300 mb-2 block">
                  Start Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-sm font-semibold text-slate-300 mb-2 block">
                  End Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <Label htmlFor="dueDate" className="text-sm font-semibold text-slate-300 mb-2 block">
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Tags */}
            {tenantPermissions.canEditOKRs && (
              <div>
                <Label className="text-sm font-semibold text-slate-300 mb-2 block">
                  Tags
                </Label>
                <TagSelector
                  resourceType="initiative"
                  resourceId={selectedNode?.id || ''}
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                />
              </div>
            )}

            {/* Contributors */}
            {tenantPermissions.canEditOKRs && (
              <div>
                <Label className="text-sm font-semibold text-slate-300 mb-2 block">
                  Contributors
                </Label>
                <ContributorSelector
                  resourceType="initiative"
                  resourceId={selectedNode?.id || ''}
                  selectedContributors={selectedContributors}
                  onContributorsChange={setSelectedContributors}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 p-6 bg-slate-900/50">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-500"
            disabled={isSubmitting || !title || !ownerId}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

