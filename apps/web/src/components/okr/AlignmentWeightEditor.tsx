'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Edit2, Save, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { updateKeyResultWeight } from '@/lib/alignment-weights-api'

interface AlignmentWeightEditorProps {
  objectiveId: string
  keyResultId: string
  currentWeight: number
  onUpdate?: () => void
  canEdit?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function AlignmentWeightEditor({
  objectiveId,
  keyResultId,
  currentWeight,
  onUpdate,
  canEdit = false,
  className,
  size = 'sm',
}: AlignmentWeightEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [weight, setWeight] = useState(currentWeight.toString())
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    const weightNum = parseFloat(weight)
    
    // Validation
    if (isNaN(weightNum)) {
      toast({
        title: 'Invalid weight',
        description: 'Weight must be a valid number',
        variant: 'destructive',
      })
      return
    }

    const MAX_WEIGHT = 3.0
    if (weightNum < 0 || weightNum > MAX_WEIGHT) {
      toast({
        title: 'Invalid weight',
        description: `Weight must be between 0.0 and ${MAX_WEIGHT}`,
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      await updateKeyResultWeight(objectiveId, keyResultId, weightNum)
      toast({
        title: 'Weight updated',
        description: 'The alignment weight has been updated successfully.',
      })
      setIsEditing(false)
      onUpdate?.()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update weight'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setWeight(currentWeight.toString())
    setIsEditing(false)
  }

  if (!canEdit) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <span className={cn(
          'text-neutral-600',
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          Weight: {currentWeight.toFixed(1)}
        </span>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="weight-input" className={cn(
            'text-neutral-600',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}>
            Weight:
          </Label>
          <Input
            id="weight-input"
            type="number"
            min="0"
            max="3"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={cn(
              'w-20',
              size === 'sm' ? 'h-6 text-xs' : 'h-7 text-sm'
            )}
            disabled={isSaving}
            autoFocus
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size={size === 'sm' ? 'sm' : 'default'}
          onClick={handleSave}
          disabled={isSaving}
          className="h-6 w-6 p-0"
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={size === 'sm' ? 'sm' : 'default'}
          onClick={handleCancel}
          disabled={isSaving}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn(
        'text-neutral-600',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}>
        Weight: {currentWeight.toFixed(1)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size={size === 'sm' ? 'sm' : 'default'}
        onClick={() => setIsEditing(true)}
        className="h-6 w-6 p-0"
        aria-label="Edit weight"
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

