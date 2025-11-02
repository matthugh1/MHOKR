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

type OKRStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "CANCELLED"
type VisibilityLevel = "PUBLIC_TENANT" | "PRIVATE" | "WORKSPACE_ONLY" | "TEAM_ONLY" | "MANAGER_CHAIN" | "EXEC_ONLY"

export interface EditObjectiveModalProps {
  isOpen: boolean
  objectiveId: string | null
  objectiveData?: {
    title: string
    ownerId: string
    workspaceId?: string
    cycleId?: string
    status: OKRStatus
    visibilityLevel: VisibilityLevel
    pillarId?: string
  }
  onClose: () => void
  onSubmit: (data: {
    title: string
    ownerId: string
    workspaceId?: string
    cycleId?: string
    status: OKRStatus
    visibilityLevel: VisibilityLevel
    pillarId?: string
  }) => Promise<void>
  // Options for dropdowns (parent should provide these)
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableCycles?: Array<{ id: string; name: string }>
  availablePillars?: Array<{ id: string; name: string }>
}

export function EditObjectiveModal({
  isOpen,
  objectiveId: _objectiveId,
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
  const [visibilityLevel, setVisibilityLevel] = React.useState<VisibilityLevel>("PUBLIC_TENANT")
  const [pillarId, setPillarId] = React.useState<string>("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Load objective data when modal opens or data changes
  React.useEffect(() => {
    if (isOpen && objectiveData) {
      setTitle(objectiveData.title || "")
      setOwnerId(objectiveData.ownerId || "")
      setWorkspaceId(objectiveData.workspaceId || "")
      setCycleId(objectiveData.cycleId || "")
      setStatus(objectiveData.status || "ON_TRACK")
      setVisibilityLevel(objectiveData.visibilityLevel || "PUBLIC_TENANT")
      setPillarId(objectiveData.pillarId || "")
    }
  }, [isOpen, objectiveData])

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
        visibilityLevel,
        pillarId: pillarId || undefined,
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
              Owner <span className="text-red-500">*</span>
            </Label>
            <Select value={ownerId} onValueChange={setOwnerId} required>
              <SelectTrigger id="edit-owner">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email || user.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableWorkspaces.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-workspace">Workspace</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger id="edit-workspace">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
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
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger id="edit-cycle">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
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
                <SelectItem value="ON_TRACK">On Track</SelectItem>
                <SelectItem value="AT_RISK">At Risk</SelectItem>
                <SelectItem value="OFF_TRACK">Off Track</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                <SelectItem value="WORKSPACE_ONLY">Workspace Only</SelectItem>
                <SelectItem value="TEAM_ONLY">Team Only</SelectItem>
                <SelectItem value="MANAGER_CHAIN">Manager Chain</SelectItem>
                <SelectItem value="EXEC_ONLY">Executive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {availablePillars.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-pillar">Strategic Theme / Pillar (Optional)</Label>
              <Select value={pillarId} onValueChange={setPillarId}>
                <SelectTrigger id="edit-pillar">
                  <SelectValue placeholder="Select strategic theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {availablePillars.map((pillar) => (
                    <SelectItem key={pillar.id} value={pillar.id}>
                      {pillar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

