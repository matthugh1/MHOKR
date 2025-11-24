'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
import { OwnerList } from '@/components/okr/OwnerList'
import { useTenantAdmin } from '@/hooks/useTenantAdmin'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import {
  getObjectiveOwners,
  addObjectiveOwner,
  removeObjectiveOwner,
  type Owner,
} from '@/lib/okr-owners-api'
import { HierarchyOKRNode } from './types'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type OKRStatus = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "CANCELLED"
type VisibilityLevel = "PUBLIC_TENANT" | "PRIVATE"

interface SidePanelEditObjectiveProps {
  selectedNode: HierarchyOKRNode | null
  onSave: (data: {
    title: string
    ownerId: string
    workspaceId?: string
    cycleId?: string
    status: OKRStatus
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    visibilityLevel: VisibilityLevel
  }) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableCycles?: Array<{ id: string; name: string }>
}

export function SidePanelEditObjective({
  selectedNode,
  onSave,
  onCancel,
  availableUsers = [],
  availableWorkspaces = [],
  availableCycles = [],
}: SidePanelEditObjectiveProps) {
  const [title, setTitle] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [cycleId, setCycleId] = useState<string>("")
  const [status, setStatus] = useState<OKRStatus>("ON_TRACK")
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>("PUBLIC_TENANT")
  const [isPublished, setIsPublished] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTogglingPublish, setIsTogglingPublish] = useState(false)
  const [owners, setOwners] = useState<Owner[]>([])
  const [isLoadingOwners, setIsLoadingOwners] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  // Build complete cycles list including current cycleId if not in availableCycles
  const allCycles = useMemo(() => {
    const cycles = [...availableCycles]
    // If selectedNode has a cycleId that isn't in availableCycles, add it as an option
    const nodeCycleId = selectedNode?.cycleId
    if (nodeCycleId && nodeCycleId !== "none" && nodeCycleId !== "" && !availableCycles.some(c => c.id === nodeCycleId)) {
      cycles.push({
        id: nodeCycleId,
        name: selectedNode?.cycleName || `Cycle ${nodeCycleId.substring(0, 8)}...`
      })
    }
    return cycles
  }, [availableCycles, selectedNode?.cycleId, selectedNode?.cycleName])

  const { isTenantAdmin } = useTenantAdmin()
  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()

  // Load objective data when node changes
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'objective') {
      setTitle(selectedNode.title || "")
      setOwnerId(selectedNode.ownerId || "")
      setWorkspaceId(selectedNode.workspaceId || "")
      // Use cycleId directly from selectedNode - ensure it's set correctly
      if (selectedNode.cycleId) {
        setCycleId(selectedNode.cycleId)
      } else {
        setCycleId("")
      }
      setStatus((selectedNode.status as OKRStatus) || "ON_TRACK")
      setGoalType(selectedNode.goalType || "ASPIRATIONAL")
      setVisibilityLevel((selectedNode.visibilityLevel as VisibilityLevel) || "PUBLIC_TENANT")
      setIsPublished(selectedNode.isPublished || false)
    } else {
      // Reset form when no node is selected
      setTitle("")
      setOwnerId("")
      setWorkspaceId("")
      setCycleId("")
    }
  }, [selectedNode?.id, selectedNode?.cycleId])

  // Load owners
  useEffect(() => {
    const loadOwners = async () => {
      if (selectedNode?.id) {
        setIsLoadingOwners(true)
        try {
          const ownersData = await getObjectiveOwners(selectedNode.id)
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
    await addObjectiveOwner(selectedNode.id, userId)
    const ownersData = await getObjectiveOwners(selectedNode.id)
    setOwners(ownersData)
  }

  const handleRemoveOwner = async (userId: string) => {
    if (!selectedNode?.id) return
    await removeObjectiveOwner(selectedNode.id, userId)
    const ownersData = await getObjectiveOwners(selectedNode.id)
    setOwners(ownersData)
  }

  const canEditOwners = useMemo(() => {
    if (!selectedNode || !selectedNode.id) return false
    return tenantPermissions.canEditObjective({
      id: selectedNode.id,
      ownerId: selectedNode.ownerId,
      tenantId: selectedNode.tenantId || null,
      workspaceId: selectedNode.workspaceId || null,
      teamId: selectedNode.teamId || null,
      isPublished: isPublished,
      cycle: null,
      cycleStatus: null,
    })
  }, [selectedNode, isPublished, tenantPermissions])

  const canPublish = useMemo(() => {
    if (!selectedNode || !selectedNode.id) return false
    return isTenantAdmin ||
      (selectedNode.workspaceId && tenantPermissions.canEditObjective({
        id: selectedNode.id,
        ownerId: selectedNode.ownerId,
        tenantId: selectedNode.tenantId || null,
        workspaceId: selectedNode.workspaceId || null,
        teamId: selectedNode.teamId || null,
        isPublished: false,
        cycle: null,
        cycleStatus: null,
      }))
  }, [isTenantAdmin, selectedNode, tenantPermissions])

  const canUnpublish = useMemo(() => {
    if (!selectedNode || !selectedNode.id) return false
    return isTenantAdmin || tenantPermissions.canEditObjective({
      id: selectedNode.id,
      ownerId: selectedNode.ownerId,
      tenantId: selectedNode.tenantId || null,
      workspaceId: selectedNode.workspaceId || null,
      teamId: selectedNode.teamId || null,
      isPublished: isPublished,
      cycle: null,
      cycleStatus: null,
    })
  }, [isTenantAdmin, selectedNode, isPublished, tenantPermissions])

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
        workspaceId: workspaceId || undefined,
        cycleId: cycleId || undefined,
        status,
        goalType,
        visibilityLevel,
      })
    } catch (error) {
      console.error("Failed to update objective:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!selectedNode || selectedNode.type !== 'objective') {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col w-full bg-slate-900 m-0 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border-b border-slate-800 p-0 h-9">
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
          <TabsTrigger 
            value="metadata" 
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Metadata
          </TabsTrigger>
        </TabsList>

        {/* Basic Tab */}
        <TabsContent value="basic" className="p-4 space-y-4 mt-0">
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-sm font-medium text-slate-200">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter objective title"
              required
              className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-owner" className="text-sm font-medium text-slate-200">
              Primary Owner <span className="text-red-400">*</span>
            </Label>
            <SearchableUserSelect
              value={ownerId}
              onValueChange={setOwnerId}
              availableUsers={availableUsers}
              placeholder="Select owner"
              id="edit-owner"
              required
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
                  canEdit={canEditOwners}
                  resourceType="objective"
                  resourceId={selectedNode.id}
                  size="md"
                />
              )}
            </div>
          )}

          {availableWorkspaces.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="edit-workspace" className="text-sm font-medium text-slate-200">Workspace</Label>
              <Select value={workspaceId || "none"} onValueChange={(value) => setWorkspaceId(value === "none" ? "" : value)}>
                <SelectTrigger id="edit-workspace" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="none" className="text-white focus:bg-slate-700">None</SelectItem>
                  {availableWorkspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id} className="text-white focus:bg-slate-700">
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {availableCycles.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="edit-cycle" className="text-sm font-medium text-slate-200">Cycle / Period</Label>
              <Select 
                value={cycleId || selectedNode?.cycleId || "none"} 
                onValueChange={(value) => setCycleId(value === "none" ? "" : value)}
              >
                <SelectTrigger id="edit-cycle" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="none" className="text-white focus:bg-slate-700">None</SelectItem>
                  {allCycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id} className="text-white focus:bg-slate-700">
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-status" className="text-sm font-medium text-slate-200">
              Status <span className="text-red-400">*</span>
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as OKRStatus)} required>
              <SelectTrigger id="edit-status" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700">
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
            id="edit-goal-type"
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="p-4 space-y-4 mt-0">
          <div className="space-y-2">
            <Label htmlFor="edit-visibility" className="text-sm font-medium text-slate-200">
              Visibility <span className="text-red-400">*</span>
            </Label>
            <Select
              value={visibilityLevel}
              onValueChange={(value) => setVisibilityLevel(value as VisibilityLevel)}
              required
            >
              <SelectTrigger id="edit-visibility" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="PUBLIC_TENANT" className="text-white focus:bg-slate-700">Public (Tenant)</SelectItem>
                <SelectItem value="PRIVATE" className="text-white focus:bg-slate-700">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedNode.id && (
            <div className="border-t border-slate-800 pt-4">
              <Label className="text-sm text-slate-300">Publish Status</Label>
              <div className="flex items-center justify-between mt-2 p-3 rounded-md border border-slate-800 bg-slate-800/50">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    {isPublished ? 'Published' : 'Draft'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isPublished
                      ? 'This objective is published and locked. Only organization administrators can edit published objectives.'
                      : 'This objective is in draft mode and can be edited freely.'}
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      if (!selectedNode.id || isTogglingPublish) {
                        return
                      }

                      const canToggle = isPublished ? canUnpublish : canPublish

                      if (!canToggle) {
                        toast({
                          title: 'Permission denied',
                          description: isPublished
                            ? 'Only organization administrators can unpublish objectives.'
                            : 'Only organization administrators or workspace leads can publish objectives.',
                          variant: 'destructive',
                        })
                        return
                      }

                      const newIsPublished = !isPublished
                      setIsTogglingPublish(true)

                      try {
                        await api.patch(`/objectives/${selectedNode.id}`, {
                          isPublished: newIsPublished
                        })

                        setIsPublished(newIsPublished)

                        toast({
                          title: newIsPublished ? 'Objective published' : 'Objective unpublished',
                          description: newIsPublished
                            ? 'This objective is now published and locked for editing.'
                            : 'This objective is now in draft mode and can be edited.',
                        })
                      } catch (error: any) {
                        console.error('[SidePanelEditObjective] Failed to update publish status:', error)
                        const errorMessage = error.response?.data?.message || error.message || 'Failed to update publish status'
                        toast({
                          title: 'Error',
                          description: errorMessage,
                          variant: 'destructive',
                        })
                      } finally {
                        setIsTogglingPublish(false)
                      }
                    }}
                    disabled={isTogglingPublish || (isPublished ? !canUnpublish : !canPublish)}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-medium transition-colors h-10',
                      isPublished
                        ? 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isTogglingPublish ? 'Updating...' : (isPublished ? 'Unpublish' : 'Publish')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="p-4 space-y-4 mt-0">
          <div className="text-sm text-slate-400 py-4">
            Additional metadata features coming soon.
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel} 
          disabled={isSubmitting} 
          className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-10 font-medium"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || !title.trim() || !ownerId} 
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}

