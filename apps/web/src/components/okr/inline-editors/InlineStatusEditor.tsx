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

type ObjectiveStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'

interface StatusOption {
  value: ObjectiveStatus
  label: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'ON_TRACK', label: 'On track', tone: 'success' },
  { value: 'AT_RISK', label: 'At risk', tone: 'warning' },
  { value: 'OFF_TRACK', label: 'Off track', tone: 'danger' },
]

interface InlineStatusEditorProps {
  currentStatus: ObjectiveStatus
  onSave: (status: ObjectiveStatus) => Promise<void>
  canEdit: boolean
  lockReason?: string
  className?: string
  ariaLabel: string
  resource?: any // For RbacWhyTooltip
  disabled?: boolean
  renderBadge?: (status: ObjectiveStatus, label: string, tone: string) => React.ReactNode
}

export function InlineStatusEditor({
  currentStatus,
  onSave,
  canEdit,
  lockReason,
  className,
  ariaLabel,
  resource,
  disabled = false,
  renderBadge,
}: InlineStatusEditorProps) {
  const [open, setOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)
  const [isSaving, setIsSaving] = useState(false)

  const handleSelect = async (status: ObjectiveStatus) => {
    if (status === currentStatus) {
      setOpen(false)
      return
    }

    setIsSaving(true)

    try {
      await onSave(status)
      setOpen(false)
    } catch (error) {
      // Keep popover open on error
    } finally {
      setIsSaving(false)
    }
  }

  const currentOption = STATUS_OPTIONS.find(opt => opt.value === currentStatus) || STATUS_OPTIONS[0]

  if (!canEdit || disabled) {
    const content = renderBadge
      ? renderBadge(currentStatus, currentOption.label, currentOption.tone)
      : (
          <div className={cn('flex items-center gap-1.5', className)}>
            <span>{currentOption.label}</span>
            {lockReason && (
              <Lock className="h-3 w-3 text-neutral-400" aria-hidden="true" />
            )}
          </div>
        )

    return (
      <RbacWhyTooltip
        action="edit_okr"
        resource={resource}
        allowed={false}
      >
        {content}
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
          {renderBadge
            ? renderBadge(selectedStatus, currentOption.label, currentOption.tone)
            : currentOption.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-0.5">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              disabled={isSaving}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-neutral-100 transition-colors',
                selectedStatus === option.value && 'bg-neutral-50',
                isSaving && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span>{option.label}</span>
              {selectedStatus === option.value && (
                <Check className="h-4 w-4 text-emerald-600" />
              )}
              {isSaving && selectedStatus === option.value && (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}



