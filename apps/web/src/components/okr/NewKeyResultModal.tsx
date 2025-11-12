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

type OKRStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "CANCELLED"
type VisibilityLevel = "PUBLIC_TENANT" | "PRIVATE"
type CheckInCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "NONE"

export interface NewKeyResultModalProps {
  isOpen: boolean
  objectiveId: string // required, the parent Objective
  objectiveName?: string // for display ("Linked to Objective: ___")
  onClose: () => void
  onSubmit: (data: {
    title: string
    ownerId: string
    startValue: number
    targetValue: number
    unit: string
    cadence: CheckInCadence
    visibilityLevel: VisibilityLevel
    status: OKRStatus
    objectiveId: string
  }) => Promise<void>
  // Options for dropdowns (parent should provide these)
  availableUsers?: Array<{ id: string; name: string; email?: string }>
}

export function NewKeyResultModal({
  isOpen,
  objectiveId,
  objectiveName,
  onClose,
  onSubmit,
  availableUsers = [],
}: NewKeyResultModalProps) {
  const [title, setTitle] = React.useState("")
  const [ownerId, setOwnerId] = React.useState("")
  const [startValue, setStartValue] = React.useState<string>("")
  const [targetValue, setTargetValue] = React.useState<string>("")
  const [unit, setUnit] = React.useState("")
  const [cadence, setCadence] = React.useState<CheckInCadence>("MONTHLY")
  const [status, setStatus] = React.useState<OKRStatus>("ON_TRACK")
  const [visibilityLevel, setVisibilityLevel] = React.useState<VisibilityLevel>("PUBLIC_TENANT")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!title.trim() || !ownerId || startValue === "" || targetValue === "" || !unit.trim()) {
      return
    }

    const start = parseFloat(startValue)
    const target = parseFloat(targetValue)

    if (isNaN(start) || isNaN(target)) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        ownerId,
        startValue: start,
        targetValue: target,
        unit: unit.trim(),
        cadence,
        visibilityLevel,
        status,
        objectiveId,
      })
      // Reset form
      setTitle("")
      setOwnerId("")
      setStartValue("")
      setTargetValue("")
      setUnit("")
      setCadence("MONTHLY")
      setStatus("ON_TRACK")
      setVisibilityLevel("PUBLIC_TENANT")
      onClose()
    } catch (error) {
      console.error("Failed to create key result:", error)
      // Don't close on error - let parent handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle("")
      setOwnerId("")
      setStartValue("")
      setTargetValue("")
      setUnit("")
      setCadence("MONTHLY")
      setStatus("ON_TRACK")
      setVisibilityLevel("PUBLIC_TENANT")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6 flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Create New Key Result</DialogTitle>
          <DialogDescription>
            Define a measurable Key Result for tracking progress.
          </DialogDescription>
        </DialogHeader>

        {objectiveName && (
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
            This Key Result will be added to: <strong>{objectiveName}</strong>
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
              placeholder="Enter key result title"
              required
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startValue">
                Baseline / Start Value <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startValue"
                type="number"
                step="any"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="targetValue">
                Target Value <span className="text-red-500">*</span>
              </Label>
              <Input
                id="targetValue"
                type="number"
                step="any"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="100"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="unit">
              Unit <span className="text-red-500">*</span>
            </Label>
            <Input
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="%, £, seconds, etc."
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cadence">
              Check-in Cadence <span className="text-red-500">*</span>
            </Label>
            <Select value={cadence} onValueChange={(value) => setCadence(value as CheckInCadence)} required>
              <SelectTrigger id="cadence">
                <SelectValue placeholder="Select cadence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="NONE">None</SelectItem>
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
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !title.trim() ||
                !ownerId ||
                startValue === "" ||
                targetValue === "" ||
                !unit.trim()
              }
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

