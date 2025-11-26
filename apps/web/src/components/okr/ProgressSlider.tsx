'use client'

import { useState, useRef, useEffect } from 'react'
import { cn, clampProgress } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ProgressSliderProps {
  progress: number
  onSave: (progress: number) => Promise<void>
  canEdit: boolean
  disabled?: boolean
  className?: string
  label?: string
}

export function ProgressSlider({
  progress,
  onSave,
  canEdit,
  disabled = false,
  className,
  label = 'Progress',
}: ProgressSliderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localProgress, setLocalProgress] = useState(progress)
  const [isSaving, setIsSaving] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalProgress(progress)
  }, [progress])

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit || disabled) return
    
    const newProgress = parseFloat(e.target.value)
    setLocalProgress(newProgress)
    setIsEditing(true)

    // Debounce save - wait 500ms after user stops dragging
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      if (Math.abs(newProgress - progress) > 0.5) {
        setIsSaving(true)
        try {
          await onSave(newProgress)
        } catch (error) {
          // Revert on error
          setLocalProgress(progress)
          console.error('Failed to update progress:', error)
        } finally {
          setIsSaving(false)
          setIsEditing(false)
        }
      } else {
        setIsEditing(false)
      }
    }, 500)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (!canEdit || disabled) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {label && <span className="text-[11px] text-muted-foreground min-w-[60px]">{label}:</span>}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                progress >= 100 ? 'bg-emerald-500' :
                progress >= 75 ? 'bg-green-500' :
                progress >= 50 ? 'bg-yellow-500' :
                progress >= 25 ? 'bg-orange-500' :
                'bg-red-500'
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground min-w-[35px] text-right">
            {Math.round(clampProgress(progress))}%
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label && <span className="text-[11px] text-neutral-500 min-w-[60px]">{label}:</span>}
      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={localProgress}
          onChange={handleValueChange}
          disabled={isSaving}
          className={cn(
            'flex-1 h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer',
            'accent-violet-600',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-600 [&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-violet-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer',
            isSaving && 'opacity-50 cursor-not-allowed'
          )}
        />
        <div className="flex items-center gap-1 min-w-[50px]">
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
          ) : (
            <span className={cn(
              'text-[11px] font-medium text-right transition-colors',
              isEditing ? 'text-violet-600' : 'text-neutral-600'
            )}>
              {Math.round(localProgress)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

