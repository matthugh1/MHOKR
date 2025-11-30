'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useFeedback } from '@/contexts/feedback.context'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [message, setMessage] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const { errors, submitFeedback, isSubmitting } = useFeedback()
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Feedback required',
        description: 'Please enter your feedback before submitting.',
        variant: 'destructive',
      })
      return
    }

    try {
      await submitFeedback(message)
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your feedback! We appreciate your help.',
        variant: 'success',
      })
      setMessage('')
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: 'Failed to submit feedback',
        description: error?.response?.data?.message || error?.message || 'Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const formatError = (error: any) => {
    if (error.type === 'api') {
      return `${error.message}${error.statusCode ? ` (${error.statusCode})` : ''}`
    }
    return error.message || 'Unknown error'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your feedback. Any errors you've encountered will be automatically included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="feedback-message" className="text-sm font-medium">
              Your Feedback
            </label>
            <Textarea
              id="feedback-message"
              placeholder="Tell us what you think, what's working well, or what could be improved..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              disabled={isSubmitting}
            />
          </div>

          {errors.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const newShowErrors = !showErrors
                  setShowErrors(newShowErrors)
                  track('feedback_errors_toggled', {
                    expanded: newShowErrors,
                    error_count: errors.length,
                    page: typeof window !== 'undefined' ? window.location.pathname : undefined,
                  })
                }}
                className="flex items-center justify-between w-full text-left text-sm font-medium hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  {errors.length} error{errors.length !== 1 ? 's' : ''} detected
                </span>
                {showErrors ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showErrors && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-2 max-h-[200px] overflow-y-auto">
                  {errors.map((error, index) => (
                    <div
                      key={index}
                      className="text-xs font-mono bg-background rounded p-2 border border-border"
                    >
                      <div className="font-semibold text-destructive mb-1">
                        [{error.type.toUpperCase()}] {formatError(error)}
                      </div>
                      {error.stack && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Stack trace
                          </summary>
                          <pre className="mt-1 text-[10px] overflow-x-auto whitespace-pre-wrap break-words">
                            {error.stack}
                          </pre>
                        </details>
                      )}
                      {error.url && (
                        <div className="text-muted-foreground mt-1">URL: {error.url}</div>
                      )}
                      {error.timestamp && (
                        <div className="text-muted-foreground text-[10px]">
                          {new Date(error.timestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Page: {typeof window !== 'undefined' ? window.location.href : ''}</div>
            <div>Browser: {typeof navigator !== 'undefined' ? navigator.userAgent.split(' ')[0] : ''}</div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Feedback'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

