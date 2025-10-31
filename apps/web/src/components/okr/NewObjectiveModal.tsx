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

export interface NewObjectiveModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    ownerId: string
    workspaceId: string
    cycleId: string
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

export function NewObjectiveModal({
  isOpen,
  onClose,
  onSubmit,
  availableUsers = [],
  availableWorkspaces = [],
  availableCycles = [],
  availablePillars = [],
}: NewObjectiveModalProps) {
  const [title, setTitle] = React.useState("")
  const [ownerId, setOwnerId] = React.useState("")
  const [workspaceId, setWorkspaceId] = React.useState("")
  const [cycleId, setCycleId] = React.useState("")
  const [status, setStatus] = React.useState<OKRStatus>("ON_TRACK")
  const [visibilityLevel, setVisibilityLevel] = React.useState<VisibilityLevel>("PUBLIC_TENANT")
  const [pillarId, setPillarId] = React.useState<string>("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!title.trim() || !ownerId || !workspaceId || !cycleId) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        ownerId,
        workspaceId,
        cycleId,
        status,
        visibilityLevel,
        pillarId: pillarId || undefined,
      })
      // Reset form
      setTitle("")
      setOwnerId("")
      setWorkspaceId("")
      setCycleId("")
      setStatus("ON_TRACK")
      setVisibilityLevel("PUBLIC_TENANT")
      setPillarId("")
      onClose()
    } catch (error) {
      console.error("Failed to create objective:", error)
      // Don't close on error - let parent handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle("")
      setOwnerId("")
      setWorkspaceId("")
      setCycleId("")
      setStatus("ON_TRACK")
      setVisibilityLevel("PUBLIC_TENANT")
      setPillarId("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6 flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Create New Objective</DialogTitle>
          <DialogDescription>
            Define a new Objective to track progress towards your goals.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter objective title"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owner">
              Owner <span className="text-red-500">*</span>
            </Label>
            <Select value={ownerId} onValueChange={setOwnerId} required>
              <SelectTrigger id="owner">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace">
              Workspace <span className="text-red-500">*</span>
            </Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId} required>
              <SelectTrigger id="workspace">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {availableWorkspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cycle">
              Cycle / Period <span className="text-red-500">*</span>
            </Label>
            <Select value={cycleId} onValueChange={setCycleId} required>
              <SelectTrigger id="cycle">
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                {availableCycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="status">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as OKRStatus)} required>
              <SelectTrigger id="status">
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
            <Label htmlFor="visibility">
              Visibility <span className="text-red-500">*</span>
            </Label>
            <Select
              value={visibilityLevel}
              onValueChange={(value) => setVisibilityLevel(value as VisibilityLevel)}
              required
            >
              <SelectTrigger id="visibility">
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
              <Label htmlFor="pillar">Strategic Theme / Pillar (Optional)</Label>
              <Select value={pillarId} onValueChange={setPillarId}>
                <SelectTrigger id="pillar">
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

          {/* [phase6-polish]: After successful create, offer CTA "Add first Key Result" with the returned objectiveId. */}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId || !workspaceId || !cycleId}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

