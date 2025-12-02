'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { Info } from 'lucide-react'

type InitiativeStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"

interface SidePanelCreateInitiativeProps {
  onSave: (data: {
    title: string
    ownerId: string
    status: InitiativeStatus
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    teamId?: string | null
    progress?: number | null
    dueDate?: string
    objectiveId?: string
    keyResultId?: string
  }) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  parentObjectiveId?: string
  parentObjectiveTitle?: string
  parentKeyResultId?: string
  parentKeyResultTitle?: string
  currentOrganization?: { id: string } | null
}

export function SidePanelCreateInitiative({
  onSave,
  onCancel,
  availableUsers = [],
  availableTeams = [],
  parentObjectiveId,
  parentObjectiveTitle,
  parentKeyResultId,
  parentKeyResultTitle,
  currentOrganization,
}: SidePanelCreateInitiativeProps) {
  const [title, setTitle] = useState('')
  const { toast } = useToast()
  const { user } = useAuth()
  const [ownerId, setOwnerId] = useState(user?.id || '')
  const [status, setStatus] = useState<InitiativeStatus>("NOT_STARTED")
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [teamId, setTeamId] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  // Set default owner to current user when user is available
  useEffect(() => {
    if (user?.id && !ownerId) {
      setOwnerId(user.id)
    }
  }, [user?.id, ownerId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !ownerId) {
      toast({
        title: 'Validation Error',
        description: 'Title and owner are required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        title: title.trim(),
        ownerId,
        status,
        goalType,
        teamId: teamId || null,
        progress: progress !== null ? progress : undefined,
        dueDate: dueDate || undefined,
        objectiveId: parentObjectiveId,
        keyResultId: parentKeyResultId,
      })
      // Reset form
      setTitle('')
      setOwnerId(user?.id || '')
      setStatus("NOT_STARTED")
      setGoalType('ASPIRATIONAL')
      setTeamId(null)
      setProgress(null)
      setDueDate('')
    } catch (error) {
      console.error("Failed to create initiative:", error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  const parentContext = parentKeyResultId && parentKeyResultTitle
    ? `Key Result: ${parentKeyResultTitle}`
    : parentObjectiveId && parentObjectiveTitle
    ? `Objective: ${parentObjectiveTitle}`
    : null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start justify-start h-full bg-slate-900 m-0 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col items-start justify-start flex-1 min-h-0 m-0 w-full">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0 bg-slate-800/50 border-b border-slate-800 p-0 h-9 m-0 self-start">
          <TabsTrigger
            value="basic"
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Basic
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-6 mt-0">
            <div className="space-y-6">
              {parentContext && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-200">Parent</Label>
                  <Input
                    value={parentContext}
                    disabled
                    readOnly
                    className="bg-slate-800/50 border-slate-700 text-slate-400 cursor-not-allowed h-9"
                  />
                  <p className="text-xs text-slate-500">Initiative will be linked to the selected parent.</p>
                </div>
              )}

              {!parentContext && (
                <div className="rounded-md bg-indigo-500/10 border border-indigo-500/20 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-indigo-300">Assignment Flexibility</p>
                      <p className="text-xs text-slate-400">
                        Initiatives can be assigned to either an <strong className="text-slate-300">Objective</strong> or a <strong className="text-slate-300">Key Result</strong>. 
                        Select a parent from the hierarchy tree to automatically link this initiative.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="init-title" className="text-sm font-medium text-slate-200">
                  Initiative Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="init-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter initiative title"
                  required
                  autoFocus
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="init-owner" className="text-sm font-medium text-slate-200">
                  Owner <span className="text-red-500">*</span>
                </Label>
                <SearchableUserSelect
                  value={ownerId}
                  onValueChange={setOwnerId}
                  availableUsers={availableUsers}
                  placeholder="Select owner"
                  id="init-owner"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="init-status" className="text-sm font-medium text-slate-200">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select value={status} onValueChange={(value: string) => setStatus(value as InitiativeStatus)} required>
                  <SelectTrigger id="init-status" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="NOT_STARTED" className="text-white focus:bg-slate-700">Not Started</SelectItem>
                    <SelectItem value="IN_PROGRESS" className="text-white focus:bg-slate-700">In Progress</SelectItem>
                    <SelectItem value="COMPLETED" className="text-white focus:bg-slate-700">Completed</SelectItem>
                    <SelectItem value="BLOCKED" className="text-white focus:bg-slate-700">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <GoalTypeSelector
                value={goalType}
                onValueChange={setGoalType}
                label="Goal Type"
                id="init-goal-type"
              />
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-0">
            <div className="space-y-4">
              {availableTeams.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="init-team" className="text-sm font-medium text-slate-200">Team</Label>
                  <Select
                    value={teamId || 'none'}
                    onValueChange={(value: string) => setTeamId(value === 'none' ? null : value)}
                  >
                    <SelectTrigger id="init-team" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
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

              <div className="space-y-2">
                <Label htmlFor="init-progress" className="text-sm font-medium text-slate-200">Progress (0-100)</Label>
                <Input
                  id="init-progress"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={progress ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value)
                    setProgress(value !== null && !isNaN(value) ? value : null)
                  }}
                  placeholder="Enter progress percentage (optional)"
                  className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500">Progress percentage from 0 to 100</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="init-due-date" className="text-sm font-medium text-slate-200">Due Date (Optional)</Label>
                <Input
                  id="init-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </TabsContent>
        </div>

        <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-10">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium">
            {isSubmitting ? "Creating..." : "Create Initiative"}
          </Button>
        </div>
      </Tabs>
    </form>
  )
}

