'use client'

import {
  AlertDialog,
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
      return 'Cycle Locked'
    }
    if (lockReason === 'published') {
      return 'OKR is Published'
    }
    return 'Action Not Available'
  }

  const getDescription = () => {
    // Use lockMessage if provided, otherwise fall back to default messages
    if (lockMessage) {
      return lockMessage
    }
    // Fallback for backwards compatibility
    if (lockReason === 'cycle_locked') {
      return 'This cycle is locked. Changes are disabled until the cycle is reopened.'
    }
    if (lockReason === 'published') {
      return `${entityName ? `"${entityName}" is` : 'This item is'} published. Only Tenant Admins or Owners can change published OKRs for this cycle.`
    }
    return 'This action is not available.'
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent data-testid={lockReason === 'published' ? 'tip-publish-lock' : lockReason === 'cycle_locked' ? 'tip-cycle-lock' : undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm text-neutral-800">
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

