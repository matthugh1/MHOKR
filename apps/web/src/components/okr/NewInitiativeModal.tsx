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

type InitiativeStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"

export interface NewInitiativeModalProps {
  isOpen: boolean
  objectiveId?: string
  keyResultId?: string
  parentName?: string // e.g. "Stabilise Cost to Serve for Voice Contact"
  onClose: () => void
  onSubmit: (data: {
    title: string
    ownerId: string
    status: InitiativeStatus
    dueDate?: string
  }) => Promise<void>
  // Options for dropdowns (parent should provide these)
  availableUsers?: Array<{ id: string; name: string; email?: string }>
}

export function NewInitiativeModal({
  isOpen,
  objectiveId,
  keyResultId,
  parentName,
  onClose,
  onSubmit,
  availableUsers = [],
}: NewInitiativeModalProps) {
  const [title, setTitle] = React.useState("")
  const [ownerId, setOwnerId] = React.useState("")
  const [status, setStatus] = React.useState<InitiativeStatus>("NOT_STARTED")
  const [dueDate, setDueDate] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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
        status,
        dueDate: dueDate || undefined,
      })
      // Reset form
      setTitle("")
      setOwnerId("")
      setStatus("NOT_STARTED")
      setDueDate("")
      onClose()
    } catch (error) {
      console.error("Failed to create initiative:", error)
      // Don't close on error - let parent handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle("")
      setOwnerId("")
      setStatus("NOT_STARTED")
      setDueDate("")
      onClose()
    }
  }

  // Determine parent context message
  const parentContextMessage = React.useMemo(() => {
    if (keyResultId && parentName) {
      return `This initiative supports Key Result: ${parentName}`
    }
    if (objectiveId && parentName) {
      return `This initiative supports Objective: ${parentName}`
    }
    return null
  }, [keyResultId, objectiveId, parentName])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6 flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Create New Initiative</DialogTitle>
          <DialogDescription>
            Define a new Initiative to support your objectives and key results.
          </DialogDescription>
        </DialogHeader>

        {parentContextMessage && (
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
            {parentContextMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter initiative title"
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
            <Label htmlFor="status">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as InitiativeStatus)} required>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* [phase7-hardening]: Support re-parenting / linking initiative to both an Objective and a Key Result */}

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




