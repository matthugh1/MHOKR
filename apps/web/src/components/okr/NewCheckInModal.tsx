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

export interface NewCheckInModalProps {
  isOpen: boolean
  keyResultId: string
  onClose: () => void
  onSubmit: (data: {
    value: number
    confidence: number
    note?: string
    blockers?: string
  }) => Promise<void>
}

export function NewCheckInModal({
  isOpen,
  keyResultId: _keyResultId,
  onClose,
  onSubmit,
}: NewCheckInModalProps) {
  const [value, setValue] = React.useState<string>("")
  const [confidence, setConfidence] = React.useState<string>("50")
  const [note, setNote] = React.useState("")
  const [blockers, setBlockers] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const numValue = parseFloat(value)
    const numConfidence = parseInt(confidence, 10)

    // Basic validation
    if (isNaN(numValue) || isNaN(numConfidence) || numConfidence < 0 || numConfidence > 100) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        value: numValue,
        confidence: numConfidence,
        note: note.trim() || undefined,
        blockers: blockers.trim() || undefined,
      })
      // Reset form
      setValue("")
      setConfidence("50")
      setNote("")
      setBlockers("")
      onClose()
    } catch (error) {
      console.error("Failed to create check-in:", error)
      // Don't close on error - let parent handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setValue("")
      setConfidence("50")
      setNote("")
      setBlockers("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6 flex flex-col gap-4" role="dialog" aria-modal="true">
        <DialogHeader>
          <DialogTitle>Add Check-in</DialogTitle>
          <DialogDescription>
            Record progress and confidence for this Key Result.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="checkin-value">
              Latest Value <span className="text-red-500">*</span>
            </Label>
            <Input
              id="checkin-value"
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter current value"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="checkin-confidence">
              Confidence (0-100) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="checkin-confidence"
              type="number"
              min="0"
              max="100"
              step="1"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              placeholder="50"
              required
            />
            <p className="text-xs text-neutral-500">
              How confident are you that you'll achieve the target? (0 = not confident, 100 = very confident)
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="checkin-note">Note (Optional)</Label>
            <Textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any additional context..."
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="checkin-blockers">Blockers (Optional)</Label>
            <Textarea
              id="checkin-blockers"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="List any blockers or challenges..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !value ||
                !confidence ||
                isNaN(parseFloat(value)) ||
                isNaN(parseInt(confidence, 10)) ||
                parseInt(confidence, 10) < 0 ||
                parseInt(confidence, 10) > 100
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

