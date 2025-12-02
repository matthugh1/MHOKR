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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableUserSelect } from "@/components/okr/SearchableUserSelect"
import { InitiativeStatus } from '@okr-nexus/types'

export interface TaskFormProps {
  isOpen: boolean
  task?: {
    id: string
    title: string
    description?: string | null
    ownerId: string
    status: InitiativeStatus
    dueDate?: string | null
  } | null
  keyResultId?: string
  initiativeId?: string
  parentName?: string
  onClose: () => void
  onSubmit: (data: {
    title: string
    description?: string
    ownerId: string
    status: InitiativeStatus
    dueDate?: string
  }) => Promise<void>
  availableUsers?: Array<{ id: string; name: string; email?: string }>
}

export function TaskForm({
  isOpen,
  task,
  keyResultId,
  initiativeId,
  parentName,
  onClose,
  onSubmit,
  availableUsers = [],
}: TaskFormProps) {
  const [title, setTitle] = React.useState(task?.title || "")
  const [description, setDescription] = React.useState(task?.description || "")
  const [ownerId, setOwnerId] = React.useState(task?.ownerId || "")
  const [status, setStatus] = React.useState<InitiativeStatus>(task?.status || InitiativeStatus.NOT_STARTED)
  const [dueDate, setDueDate] = React.useState(
    task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || "")
      setOwnerId(task.ownerId)
      setStatus(task.status)
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "")
    } else {
      setTitle("")
      setDescription("")
      setOwnerId("")
      setStatus(InitiativeStatus.NOT_STARTED)
      setDueDate("")
    }
  }, [task, isOpen])

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
        description: description.trim() || undefined,
        ownerId,
        status,
        dueDate: dueDate || undefined,
      })
      // Reset form
      if (!task) {
        setTitle("")
        setDescription("")
        setOwnerId("")
        setStatus(InitiativeStatus.NOT_STARTED)
        setDueDate("")
      }
      onClose()
    } catch (error) {
      console.error("Failed to save task:", error)
      // Don't close on error - let parent handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      if (!task) {
        setTitle("")
        setDescription("")
        setOwnerId("")
        setStatus(InitiativeStatus.NOT_STARTED)
        setDueDate("")
      }
      onClose()
    }
  }

  // Determine parent context message
  const parentContextMessage = React.useMemo(() => {
    if (keyResultId && parentName) {
      return `This task supports Key Result: ${parentName}`
    }
    if (initiativeId && parentName) {
      return `This task supports Initiative: ${parentName}`
    }
    return null
  }, [keyResultId, initiativeId, parentName])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6 flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update task details.' : 'Define a new task to break down work into actionable items.'}
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
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task details (optional)"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owner">
              Owner <span className="text-red-500">*</span>
            </Label>
            <SearchableUserSelect
              value={ownerId}
              onValueChange={setOwnerId}
              availableUsers={availableUsers}
              placeholder="Select owner"
              id="owner"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="status">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={(value: string) => setStatus(value as InitiativeStatus)} required>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={InitiativeStatus.NOT_STARTED}>Not Started</SelectItem>
                <SelectItem value={InitiativeStatus.IN_PROGRESS}>In Progress</SelectItem>
                <SelectItem value={InitiativeStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={InitiativeStatus.BLOCKED}>Blocked</SelectItem>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId}>
              {isSubmitting ? "Saving..." : task ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

