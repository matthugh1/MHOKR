'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Check, X, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RbacWhyTooltip } from '@/components/rbac/RbacWhyTooltip'

interface InlineTitleEditorProps {
  value: string
  onSave: (newValue: string) => Promise<void>
  onCancel?: () => void
  canEdit: boolean
  lockReason?: string
  className?: string
  ariaLabel: string
  resource?: any // For RbacWhyTooltip
  disabled?: boolean
}

export function InlineTitleEditor({
  value,
  onSave,
  onCancel,
  canEdit,
  lockReason,
  className,
  ariaLabel,
  resource,
  disabled = false,
}: InlineTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (!canEdit || disabled) return
    setIsEditing(true)
    setHasError(false)
    // Telemetry is logged in the parent mutation handler
  }

  const handleSave = async () => {
    const trimmed = editValue.trim()
    if (trimmed === value.trim() || trimmed === '') {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setHasError(false)

    try {
      await onSave(trimmed)
      setIsEditing(false)
    } catch (error) {
      setHasError(true)
      // Keep editor open on error so user can retry
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
    setHasError(false)
    onCancel?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = () => {
    // Only auto-save on blur if value changed and not empty
    if (editValue.trim() !== value.trim() && editValue.trim() !== '') {
      handleSave()
    } else {
      handleCancel()
    }
  }

  if (!canEdit || disabled) {
    return (
      <RbacWhyTooltip
        action="edit_okr"
        resource={resource}
        allowed={false}
      >
        <div
          className={cn(
            'flex items-center gap-1.5 text-neutral-900',
            className
          )}
        >
          <span>{value}</span>
          {lockReason && (
            <Lock className="h-3 w-3 text-neutral-400" aria-hidden="true" />
          )}
        </div>
      </RbacWhyTooltip>
    )
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          className={cn(
            'h-7 px-2 text-[14px] font-medium',
            hasError && 'border-destructive focus:ring-destructive',
            className
          )}
          aria-label={ariaLabel}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" aria-hidden="true" />
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave()
                }}
                disabled={isSaving}
                className="p-0.5 hover:bg-neutral-100 rounded text-emerald-600"
                aria-label="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancel()
                }}
                disabled={isSaving}
                className="p-0.5 hover:bg-neutral-100 rounded text-neutral-400"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleStartEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleStartEdit(e)
        }
      }}
      className={cn(
        'text-left truncate text-[14px] font-medium text-neutral-900 hover:bg-neutral-50 px-1 py-0.5 rounded -mx-1 transition-colors',
        className
      )}
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {value}
    </button>
  )
}
