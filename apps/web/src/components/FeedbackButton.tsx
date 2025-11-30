'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FeedbackDialog } from './FeedbackDialog'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics'

interface FeedbackButtonProps {
  className?: string
}

export function FeedbackButton({ className }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = () => {
    setIsOpen(true)
    track('feedback_button_clicked', {
      page: typeof window !== 'undefined' ? window.location.pathname : undefined,
    })
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      track('feedback_dialog_opened', {
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })
    } else {
      track('feedback_dialog_closed', {
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className={cn(
          "gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-800 text-slate-200 hover:text-white",
          className
        )}
        title="Submit feedback"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </Button>
      <FeedbackDialog open={isOpen} onOpenChange={handleOpenChange} />
    </>
  )
}

