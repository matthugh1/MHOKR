'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface PublishLockWarningModalProps {
  open: boolean
  onClose: () => void
  lockReason: 'published' | 'cycle_locked' | null
  lockMessage?: string
  entityName?: string
}

export function PublishLockWarningModal({
  open,
  onClose,
  lockReason,
  lockMessage,
  entityName,
}: PublishLockWarningModalProps) {
  const getTitle = () => {
    if (lockReason === 'cycle_locked') {
      return 'OKR is Locked by Cycle'
    }
    return 'OKR is Published and Locked'
  }

  const getDescription = () => {
    // Use lockMessage if provided, otherwise fall back to default messages
    if (lockMessage) {
      return lockMessage
    }
    // Fallback for backwards compatibility
    if (lockReason === 'cycle_locked') {
      return `This OKR is locked because its cycle is locked. You cannot change targets during a locked cycle. Only tenant administrators can edit or delete OKRs in locked cycles.`
    }
    return `${entityName ? `"${entityName}" is` : 'This OKR is'} published and locked. You cannot change targets after publish. Only tenant administrators can edit or delete published OKRs.`
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription>
            {getDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

