'use client'

import React, { useState } from 'react'
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
import { useToast } from '@/hooks/use-toast'

type OKRStatus = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "CANCELLED"
type VisibilityLevel = "PUBLIC_TENANT" | "PRIVATE"

interface SidePanelCreateObjectiveProps {
  onSave: (data: {
    title: string
    description?: string
    ownerId: string
    workspaceId?: string
    cycleId: string
    status: OKRStatus
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    visibilityLevel: VisibilityLevel
    parentId?: string
  }) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableCycles?: Array<{ id: string; name: string }>
  parentObjectiveId?: string
}

export function SidePanelCreateObjective({
  onSave,
  onCancel,
  availableUsers = [],
  availableWorkspaces = [],
  availableCycles = [],
  parentObjectiveId,
}: SidePanelCreateObjectiveProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [cycleId, setCycleId] = useState<string>(availableCycles.length > 0 ? availableCycles[0].id : "")
  const [status, setStatus] = useState<OKRStatus>("ON_TRACK")
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>("PUBLIC_TENANT")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !ownerId || !cycleId) {
      toast({
        title: 'Validation Error',
        description: 'Title, owner, and cycle are required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        ownerId,
        workspaceId: workspaceId || undefined,
        cycleId,
        status,
        goalType,
        visibilityLevel,
        parentId: parentObjectiveId,
      })
      // Reset form
      setTitle("")
      setDescription("")
      setOwnerId("")
      setWorkspaceId("")
      setCycleId(availableCycles.length > 0 ? availableCycles[0].id : "")
      setStatus("ON_TRACK")
      setGoalType('ASPIRATIONAL')
      setVisibilityLevel("PUBLIC_TENANT")
    } catch (error) {
      console.error("Failed to create objective:", error)
      // Re-throw error to propagate to parent handler
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-5 mt-0">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="create-title" className="text-sm font-medium text-slate-200">
                  Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="create-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter objective title"
                  required
                  autoFocus
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-description" className="text-sm text-slate-300">Description</Label>
                <Textarea
                  id="create-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter objective description (optional)"
                  rows={3}
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-owner" className="text-sm text-slate-300">
                  Owner <span className="text-red-500">*</span>
                </Label>
                <SearchableUserSelect
                  value={ownerId}
                  onValueChange={setOwnerId}
                  availableUsers={availableUsers}
                  placeholder="Select owner"
                  id="create-owner"
                  required
                />
              </div>

              {availableCycles.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="create-cycle" className="text-sm text-slate-300">
                    Cycle <span className="text-red-500">*</span>
                  </Label>
                  <Select value={cycleId} onValueChange={setCycleId} required>
                    <SelectTrigger id="create-cycle" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      {availableCycles.map((cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id} className="text-white focus:bg-slate-700">
                          {cycle.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="create-status" className="text-sm text-slate-300">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select value={status} onValueChange={(value) => setStatus(value as OKRStatus)} required>
                  <SelectTrigger id="create-status" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                    <SelectValue placeholder="Select status" />
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
                id="create-goal-type"
              />
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-0">
            <div className="space-y-4">
              {availableWorkspaces.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="create-workspace" className="text-sm text-slate-300">Workspace</Label>
                  <Select value={workspaceId} onValueChange={setWorkspaceId}>
                    <SelectTrigger id="create-workspace" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                      <SelectValue placeholder="Select workspace (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="" className="text-white focus:bg-slate-700">None</SelectItem>
                      {availableWorkspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id} className="text-white focus:bg-slate-700">
                          {workspace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="create-visibility" className="text-sm text-slate-300">
                  Visibility <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={visibilityLevel}
                  onValueChange={(value) => setVisibilityLevel(value as VisibilityLevel)}
                  required
                >
                  <SelectTrigger id="create-visibility" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="PUBLIC_TENANT" className="text-white focus:bg-slate-700">Public (Tenant)</SelectItem>
                    <SelectItem value="PRIVATE" className="text-white focus:bg-slate-700">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {parentObjectiveId && (
                <div className="p-3 rounded-md border border-slate-800 bg-slate-800/30">
                  <p className="text-xs text-slate-500 mb-1">Parent Objective</p>
                  <p className="text-sm text-slate-300">This objective will be created as a child of the selected objective.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-10">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId || !cycleId} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium">
          {isSubmitting ? "Creating..." : "Create Objective"}
        </Button>
      </div>
    </form>
  )
}

