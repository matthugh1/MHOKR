'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Check, X, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RbacWhyTooltip } from '@/components/rbac/RbacWhyTooltip'

interface InlineNumericEditorProps {
  label: string // e.g., "Current" or "Target"
  value: number | undefined
  onSave: (newValue: number | undefined) => Promise<void>
  onCancel?: () => void
  canEdit: boolean
  lockReason?: string
  className?: string
  ariaLabel: string
  resource?: any // For RbacWhyTooltip
  disabled?: boolean
  unit?: string
  allowEmpty?: boolean // Allow clearing the value
}

export function InlineNumericEditor({
  label,
  value,
  onSave,
  onCancel,
  canEdit,
  lockReason,
  className,
  ariaLabel,
  resource,
  disabled = false,
  unit = '',
  allowEmpty = false,
}: InlineNumericEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value?.toString() || '')
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
  }

  const handleSave = async () => {
    const trimmed = editValue.trim()
    
    // Parse numeric value
    let numericValue: number | undefined
    if (trimmed === '' && allowEmpty) {
      numericValue = undefined
    } else {
      const parsed = parseFloat(trimmed)
      if (isNaN(parsed)) {
        setHasError(true)
        return
      }
      numericValue = parsed
    }

    // Check if value actually changed
    if (numericValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setHasError(false)

    try {
      await onSave(numericValue)
      setIsEditing(false)
    } catch (error) {
      setHasError(true)
      // Keep editor open on error
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value?.toString() || '')
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
    // Only auto-save on blur if value is valid
    const trimmed = editValue.trim()
    if (trimmed === '' && allowEmpty) {
      handleSave()
    } else if (!isNaN(parseFloat(trimmed))) {
      handleSave()
    } else {
      handleCancel()
    }
  }

  const formatDisplayValue = () => {
    if (value === undefined || value === null) return '—'
    const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1)
    return unit ? `${formatted} ${unit}` : formatted
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
            'flex items-center gap-1.5 text-neutral-600',
            className
          )}
        >
          <span className="text-[12px]">{formatDisplayValue()}</span>
          {lockReason && (
            <Lock className="h-3 w-3 text-neutral-400" aria-hidden="true" />
          )}
        </div>
      </RbacWhyTooltip>
    )
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-[12px] text-neutral-500 whitespace-nowrap">{label}:</span>
          <Input
            ref={inputRef}
            type="number"
            step="any"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isSaving}
            className={cn(
              'h-6 px-1.5 text-[12px] w-20',
              hasError && 'border-destructive focus:ring-destructive',
              className
            )}
            aria-label={ariaLabel}
            placeholder={allowEmpty ? '—' : '0'}
          />
          {unit && <span className="text-[12px] text-neutral-500">{unit}</span>}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin text-neutral-400" aria-hidden="true" />
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
                <Check className="h-3 w-3" />
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
                <X className="h-3 w-3" />
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
        'flex items-center gap-1 text-neutral-600 hover:bg-neutral-50 px-1 py-0.5 rounded -mx-1 transition-colors',
        className
      )}
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <span className="text-[12px]">{formatDisplayValue()}</span>
    </button>
  )
}



