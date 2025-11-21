"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableUserSelect } from "@/components/okr/SearchableUserSelect"
import { GoalTypeSelector } from "@/components/okr/GoalTypeSelector"
import { OwnerList } from "@/components/okr/OwnerList"
import { useTenantAdmin } from "@/hooks/useTenantAdmin"
import { useTenantPermissions } from "@/hooks/useTenantPermissions"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import {
  getObjectiveOwners,
  addObjectiveOwner,
  removeObjectiveOwner,
  type Owner,
} from "@/lib/okr-owners-api"

type OKRStatus = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "CANCELLED"
type VisibilityLevel = "PUBLIC_TENANT" | "PRIVATE"

export interface EditObjectiveModalProps {
  isOpen: boolean
  objectiveId: string | null
  objectiveData?: {
    title: string
    ownerId: string
    workspaceId?: string
    teamId?: string
    tenantId?: string | null
    cycleId?: string
    status: OKRStatus
    visibilityLevel: VisibilityLevel
    isPublished?: boolean
    // W4.M1: pillarId removed - deprecated
  }
  onClose: () => void
  onSubmit: (data: {
    title: string
    ownerId: string
    workspaceId?: string
    cycleId?: string
    status: OKRStatus
    visibilityLevel: VisibilityLevel
    // W4.M1: pillarId removed - deprecated
  }) => Promise<void>
  // Options for dropdowns (parent should provide these)
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableCycles?: Array<{ id: string; name: string }>
  availablePillars?: Array<{ id: string; name: string }> // W4.M1: Deprecated - not used
}

export function EditObjectiveModal({
  isOpen,
  objectiveId,
  objectiveData,
  onClose,
  onSubmit,
  availableUsers = [],
  availableWorkspaces = [],
  availableCycles = [],
  availablePillars = [],
}: EditObjectiveModalProps) {
  const [title, setTitle] = React.useState("")
  const [ownerId, setOwnerId] = React.useState("")
  const [workspaceId, setWorkspaceId] = React.useState<string>("")
  const [cycleId, setCycleId] = React.useState<string>("")
  const [status, setStatus] = React.useState<OKRStatus>("ON_TRACK")
  const [goalType, setGoalType] = React.useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [visibilityLevel, setVisibilityLevel] = React.useState<VisibilityLevel>("PUBLIC_TENANT")
  const [isPublished, setIsPublished] = React.useState(false)
  // W4.M1: pillarId removed - deprecated
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isTogglingPublish, setIsTogglingPublish] = React.useState(false)
  const [owners, setOwners] = React.useState<Owner[]>([])
  const [isLoadingOwners, setIsLoadingOwners] = React.useState(false)

  const { isTenantAdmin } = useTenantAdmin()
  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()

  // Load objective data when modal opens or data changes
  React.useEffect(() => {
    if (isOpen && objectiveData) {
      setTitle(objectiveData.title || "")
      setOwnerId(objectiveData.ownerId || "")
      setWorkspaceId(objectiveData.workspaceId || "")
      setCycleId(objectiveData.cycleId || "")
      setStatus(objectiveData.status || "ON_TRACK")
      setGoalType(objectiveData.goalType || "ASPIRATIONAL")
      setVisibilityLevel(objectiveData.visibilityLevel || "PUBLIC_TENANT")
      setIsPublished(objectiveData.isPublished || false)
      // W4.M1: pillarId removed
    }
  }, [isOpen, objectiveData])

  // Load owners when modal opens with an objective ID
  React.useEffect(() => {
    const loadOwners = async () => {
      if (isOpen && objectiveId) {
        setIsLoadingOwners(true)
        try {
          const ownersData = await getObjectiveOwners(objectiveId)
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
  }, [isOpen, objectiveId])

  const handleAddOwner = async (userId: string) => {
    if (!objectiveId) return
    await addObjectiveOwner(objectiveId, userId)
    // Reload owners
    const ownersData = await getObjectiveOwners(objectiveId)
    setOwners(ownersData)
  }

  const handleRemoveOwner = async (userId: string) => {
    if (!objectiveId) return
    await removeObjectiveOwner(objectiveId, userId)
    // Reload owners
    const ownersData = await getObjectiveOwners(objectiveId)
    setOwners(ownersData)
  }

  // Check if user can edit (for owner management)
  const canEditOwners = React.useMemo(() => {
    if (!objectiveData || !objectiveId) return false
    return tenantPermissions.canEditObjective({
      id: objectiveId,
      ownerId: objectiveData.ownerId,
      tenantId: objectiveData.tenantId || null,
      workspaceId: objectiveData.workspaceId || null,
      teamId: objectiveData.teamId || null,
      isPublished: isPublished,
      cycle: null,
      cycleStatus: null,
    })
  }, [objectiveData, objectiveId, isPublished, tenantPermissions])

  // Check if user can publish/unpublish
  const canPublish = React.useMemo(() => {
    if (!objectiveData || !objectiveId) return false
    return isTenantAdmin ||
      (objectiveData.workspaceId && tenantPermissions.canEditObjective({
        id: objectiveId,
        ownerId: objectiveData.ownerId,
        tenantId: objectiveData.tenantId || null,
        workspaceId: objectiveData.workspaceId || null,
        teamId: objectiveData.teamId || null,
        isPublished: false,
        cycle: null,
        cycleStatus: null,
      }))
  }, [isTenantAdmin, objectiveData, objectiveId, tenantPermissions])

  const canUnpublish = React.useMemo(() => {
    if (!objectiveData || !objectiveId) return false
    return isTenantAdmin || tenantPermissions.canEditObjective({
      id: objectiveId,
      ownerId: objectiveData.ownerId,
      tenantId: objectiveData.tenantId || null,
      workspaceId: objectiveData.workspaceId || null,
      teamId: objectiveData.teamId || null,
      isPublished: isPublished,
      cycle: null,
      cycleStatus: null,
    })
  }, [isTenantAdmin, objectiveData, objectiveId, isPublished, tenantPermissions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!title.trim() || !ownerId) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        ownerId,
        workspaceId: workspaceId || undefined,
        cycleId: cycleId || undefined,
        status,
        goalType,
        visibilityLevel,
        // W4.M1: pillarId removed
      })
      // Don't reset form here - let parent handle closing
      onClose()
    } catch (error) {
      console.error("Failed to update objective:", error)
      // Don't close on error - let parent handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6 flex flex-col gap-4" role="dialog" aria-modal="true">
        <DialogHeader>
          <DialogTitle>Edit Objective</DialogTitle>
          <DialogDescription>
            Update the Objective details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter objective title"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-owner">
              Primary Owner <span className="text-red-500">*</span>
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

          {/* Multiple Owners Management */}
          {objectiveId && (
            <div className="flex flex-col gap-2 border-t pt-4">
              {isLoadingOwners ? (
                <div className="text-sm text-neutral-500">Loading owners...</div>
              ) : (
                <OwnerList
                  owners={owners}
                  availableUsers={availableUsers}
                  onAddOwner={handleAddOwner}
                  onRemoveOwner={handleRemoveOwner}
                  canEdit={canEditOwners}
                  resourceType="objective"
                  resourceId={objectiveId}
                  size="md"
                />
              )}
            </div>
          )}

          {availableWorkspaces.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-workspace">Workspace</Label>
              <Select value={workspaceId || "none"} onValueChange={(value) => setWorkspaceId(value === "none" ? "" : value)}>
                <SelectTrigger id="edit-workspace">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableWorkspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {availableCycles.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-cycle">Cycle / Period</Label>
              <Select value={cycleId || "none"} onValueChange={(value) => setCycleId(value === "none" ? "" : value)}>
                <SelectTrigger id="edit-cycle">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableCycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-status">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as OKRStatus)} required>
              <SelectTrigger id="edit-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                <SelectItem value="ON_TRACK">On Track</SelectItem>
                <SelectItem value="AT_RISK">At Risk</SelectItem>
                <SelectItem value="OFF_TRACK">Off Track</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <GoalTypeSelector
            value={goalType}
            onValueChange={setGoalType}
            label="Goal Type"
            id="edit-goal-type"
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-visibility">
              Visibility <span className="text-red-500">*</span>
            </Label>
            <Select
              value={visibilityLevel}
              onValueChange={(value) => setVisibilityLevel(value as VisibilityLevel)}
              required
            >
              <SelectTrigger id="edit-visibility">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC_TENANT">Public (Tenant)</SelectItem>
                <SelectItem value="PRIVATE">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Publish Status Toggle */}
          {objectiveId && (
            <div className="border-t pt-4">
              <Label>Publish Status</Label>
              <div className="flex items-center justify-between mt-2 p-3 rounded-md border bg-slate-50">
                <div className="flex-1">
                  <div className="text-sm font-medium">
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



                      if (!objectiveId || isTogglingPublish) {
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
                        const response = await api.patch(`/objectives/${objectiveId}`, {
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
                        console.error('[EditObjectiveModal] Failed to update publish status:', error)
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
                    className={`
                      px-4 py-2 rounded-md text-sm font-medium transition-colors
                      ${isPublished
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {isTogglingPublish ? 'Updating...' : (isPublished ? 'Unpublish' : 'Publish')}
                  </button>
                </div>
              </div>
              {!isTenantAdmin && !isPublished && objectiveData?.workspaceId && (
                <p className="text-xs text-slate-500 mt-2">
                  Only organization administrators or workspace leads can publish objectives.
                </p>
              )}
              {!isTenantAdmin && !isPublished && !objectiveData?.workspaceId && (
                <p className="text-xs text-slate-500 mt-2">
                  Only organization administrators can publish organization-level objectives.
                </p>
              )}
            </div>
          )}

          {/* W4.M1: Pillar UI removed - deprecated */}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

