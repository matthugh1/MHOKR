'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RbacWhyTooltip } from '@/components/rbac/RbacWhyTooltip'
import { OkrBadge } from '@/components/okr/OkrBadge'

interface InlinePublishEditorProps {
  currentIsPublished: boolean
  onSave: (isPublished: boolean) => Promise<void>
  canEdit: boolean
  canPublish: boolean
  canUnpublish: boolean
  lockReason?: string
  className?: string
  ariaLabel: string
  resource?: any // For RbacWhyTooltip
  disabled?: boolean
}

export function InlinePublishEditor({
  currentIsPublished,
  onSave,
  canEdit,
  canPublish,
  canUnpublish,
  className,
  ariaLabel,
  resource,
  disabled = false,
}: InlinePublishEditorProps) {
  const [open, setOpen] = useState(false)
  const [selectedIsPublished, setSelectedIsPublished] = useState(currentIsPublished)
  const [isSaving, setIsSaving] = useState(false)

  const handleSelect = async (isPublished: boolean) => {
    if (isPublished === currentIsPublished) {
      setOpen(false)
      return
    }

    setIsSaving(true)

    try {
      await onSave(isPublished)
      setOpen(false)
    } catch (error) {
      // Keep popover open on error
    } finally {
      setIsSaving(false)
    }
  }

  const canToggle = currentIsPublished ? canUnpublish : canPublish
  const displayLabel = currentIsPublished ? 'Published' : 'Draft'
  const tone = currentIsPublished ? 'neutral' : 'warn'

  if (!canEdit || disabled || !canToggle) {
    return (
      <RbacWhyTooltip
        action="edit_okr"
        resource={resource}
        allowed={false}
      >
        <OkrBadge tone={tone}>
          {displayLabel}
        </OkrBadge>
      </RbacWhyTooltip>
    )
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn('h-auto p-0 hover:bg-transparent', className)}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <OkrBadge tone={tone}>
            {displayLabel}
          </OkrBadge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-0.5">
          <button
            onClick={() => handleSelect(false)}
            disabled={isSaving || !canPublish}
            className={cn(
              'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-neutral-100 transition-colors',
              !selectedIsPublished && 'bg-neutral-50',
              (isSaving || !canPublish) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span>Draft</span>
            {!selectedIsPublished && (
              <Check className="h-4 w-4 text-emerald-600" />
            )}
            {isSaving && !selectedIsPublished && (
              <Loader2 className="h-4 w-4 animate-spin ml-1" />
            )}
          </button>
          <button
            onClick={() => handleSelect(true)}
            disabled={isSaving || !canUnpublish}
            className={cn(
              'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-neutral-100 transition-colors',
              selectedIsPublished && 'bg-neutral-50',
              (isSaving || !canUnpublish) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span>Published</span>
            {selectedIsPublished && (
              <Check className="h-4 w-4 text-emerald-600" />
            )}
            {isSaving && selectedIsPublished && (
              <Loader2 className="h-4 w-4 animate-spin ml-1" />
            )}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

