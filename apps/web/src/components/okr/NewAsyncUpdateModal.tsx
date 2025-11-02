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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import { Sparkles } from "lucide-react"

export interface NewAsyncUpdateModalProps {
  isOpen: boolean
  requestId: string
  dueAt?: string | Date
  isOverdue?: boolean
  onClose: () => void
  onSubmitted: () => void
}

export function NewAsyncUpdateModal({
  isOpen,
  requestId,
  dueAt,
  isOverdue = false,
  onClose,
  onSubmitted,
}: NewAsyncUpdateModalProps) {
  const [summaryWhatMoved, setSummaryWhatMoved] = React.useState("")
  const [summaryBlocked, setSummaryBlocked] = React.useState("")
  const [summaryNeedHelp, setSummaryNeedHelp] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSubmitting(true)
    try {
      await api.post('/okr/checkin-responses', {
        requestId,
        summaryWhatMoved: summaryWhatMoved.trim() || undefined,
        summaryBlocked: summaryBlocked.trim() || undefined,
        summaryNeedHelp: summaryNeedHelp.trim() || undefined,
      })
      // Reset form
      setSummaryWhatMoved("")
      setSummaryBlocked("")
      setSummaryNeedHelp("")
      onSubmitted()
      onClose()
    } catch (error) {
      console.error("Failed to submit async update:", error)
      // Don't close on error - let parent handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuggestDraft = () => {
    // TODO [phase6-polish]: Replace this with AI-assisted draft using latest KR/status signals
    setSummaryWhatMoved("Made progress on key deliverables. Completed several tasks and moved forward on priority items.")
    setSummaryBlocked("No blockers at the moment.")
    setSummaryNeedHelp("All good, thanks!")
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setSummaryWhatMoved("")
      setSummaryBlocked("")
      setSummaryNeedHelp("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6 flex flex-col gap-4" 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="async-update-title"
        aria-describedby="async-update-description"
      >
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle id="async-update-title">Submit update</DialogTitle>
              <DialogDescription id="async-update-description" className="mt-1">
                {isOverdue ? (
                  <span className="text-rose-600 font-medium">This update is overdue.</span>
                ) : dueAt ? (
                  `Due: ${new Date(dueAt).toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}`
                ) : (
                  'Submit your update'
                )}
              </DialogDescription>
            </div>
            {isOverdue && (
              <span className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                Overdue
              </span>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="what-moved">
              What moved?
            </Label>
            <Textarea
              id="what-moved"
              value={summaryWhatMoved}
              onChange={(e) => setSummaryWhatMoved(e.target.value)}
              placeholder="Share what progress you've made..."
              rows={3}
              aria-label="What moved?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="what-blocked">
              What's blocked?
            </Label>
            <Textarea
              id="what-blocked"
              value={summaryBlocked}
              onChange={(e) => setSummaryBlocked(e.target.value)}
              placeholder="List any blockers or challenges..."
              rows={3}
              aria-label="What's blocked?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="what-need-help">
              What do you need?
            </Label>
            <Textarea
              id="what-need-help"
              value={summaryNeedHelp}
              onChange={(e) => setSummaryNeedHelp(e.target.value)}
              placeholder="What support or resources do you need?"
              rows={3}
              aria-label="What do you need?"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSuggestDraft}
              className="text-xs"
              aria-label="Suggest draft update"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Suggest draft
            </Button>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose} 
              disabled={isSubmitting}
              aria-label="Cancel submitting update"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              aria-label="Submit update"
            >
              {isSubmitting ? "Submitting..." : "Submit update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

