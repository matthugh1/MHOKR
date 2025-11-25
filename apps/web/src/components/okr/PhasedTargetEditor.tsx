'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  createPhasedTarget,
  updatePhasedTarget,
  type PhasedTarget,
  type PhasedTargetInterval,
  type CreatePhasedTargetDto,
  type UpdatePhasedTargetDto,
} from '@/lib/phased-targets-api'

interface PhasedTargetEditorProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  objectiveId?: string
  keyResultId?: string
  existingTarget?: PhasedTarget | null
  // For validation
  startDate?: string | Date
  endDate?: string | Date
  startValue?: number
  targetValue?: number
}

export function PhasedTargetEditor({
  isOpen,
  onClose,
  onSuccess,
  objectiveId,
  keyResultId,
  existingTarget,
  startDate,
  endDate,
  startValue,
  targetValue,
}: PhasedTargetEditorProps) {
  const [interval, setInterval] = useState<PhasedTargetInterval>('MONTHLY')
  const [targetValueInput, setTargetValueInput] = useState('')
  const [targetDateInput, setTargetDateInput] = useState('')
  const [orderInput, setOrderInput] = useState('1')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Initialize form from existing target
  useEffect(() => {
    if (existingTarget) {
      setInterval(existingTarget.interval)
      setTargetValueInput(existingTarget.targetValue.toString())
      setTargetDateInput(new Date(existingTarget.targetDate).toISOString().split('T')[0])
      setOrderInput(existingTarget.order.toString())
    } else {
      // Reset to defaults
      setInterval('MONTHLY')
      setTargetValueInput('')
      setTargetDateInput('')
      setOrderInput('1')
    }
  }, [existingTarget, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!targetValueInput || !targetDateInput || !orderInput) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    const targetValueNum = parseFloat(targetValueInput)
    const orderNum = parseInt(orderInput, 10)
    const targetDate = new Date(targetDateInput)

    if (isNaN(targetValueNum)) {
      toast({
        title: 'Validation Error',
        description: 'Target value must be a valid number',
        variant: 'destructive',
      })
      return
    }

    if (isNaN(orderNum) || orderNum < 1) {
      toast({
        title: 'Validation Error',
        description: 'Order must be a positive integer',
        variant: 'destructive',
      })
      return
    }

    if (isNaN(targetDate.getTime())) {
      toast({
        title: 'Validation Error',
        description: 'Target date must be a valid date',
        variant: 'destructive',
      })
      return
    }

    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (targetDate < start || targetDate > end) {
        toast({
          title: 'Validation Error',
          description: `Target date must be between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}`,
          variant: 'destructive',
        })
        return
      }
    }

    // Validate value range (for Key Results)
    if (startValue !== undefined && targetValue !== undefined && keyResultId) {
      const minValue = Math.min(startValue, targetValue)
      const maxValue = Math.max(startValue, targetValue)
      if (targetValueNum < minValue || targetValueNum > maxValue) {
        toast({
          title: 'Validation Error',
          description: `Target value must be between ${minValue} and ${maxValue}`,
          variant: 'destructive',
        })
        return
      }
    }

    setIsSubmitting(true)
    try {
      if (existingTarget) {
        // Update
        const updateDto: UpdatePhasedTargetDto = {
          interval,
          targetValue: targetValueNum,
          targetDate: targetDate.toISOString(),
          order: orderNum,
        }
        await updatePhasedTarget(existingTarget.id, updateDto)
        toast({
          title: 'Milestone updated',
          description: 'The milestone has been updated successfully.',
        })
      } else {
        // Create
        const createDto: CreatePhasedTargetDto = {
          ...(objectiveId && { objectiveId }),
          ...(keyResultId && { keyResultId }),
          interval,
          targetValue: targetValueNum,
          targetDate: targetDate.toISOString(),
          order: orderNum,
        }
        await createPhasedTarget(createDto)
        toast({
          title: 'Milestone created',
          description: 'The milestone has been created successfully.',
        })
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save milestone'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-xl border bg-white shadow-xl max-w-lg w-full p-6">
        <DialogHeader>
          <DialogTitle>
            {existingTarget ? 'Edit Milestone' : 'Add Milestone'}
          </DialogTitle>
          <DialogDescription>
            Set a target value and date for this milestone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="interval">
              Interval <span className="text-red-500">*</span>
            </Label>
            <Select value={interval} onValueChange={(value: string) => setInterval(value as PhasedTargetInterval)}>
              <SelectTrigger id="interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="targetValue">
              Target Value <span className="text-red-500">*</span>
            </Label>
            <Input
              id="targetValue"
              type="number"
              step="any"
              value={targetValueInput}
              onChange={(e) => setTargetValueInput(e.target.value)}
              placeholder="Enter target value"
              required
            />
            {startValue !== undefined && targetValue !== undefined && (
              <p className="text-xs text-neutral-500">
                Range: {Math.min(startValue, targetValue)} to {Math.max(startValue, targetValue)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="targetDate">
              Target Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDateInput}
              onChange={(e) => setTargetDateInput(e.target.value)}
              required
            />
            {startDate && endDate && (
              <p className="text-xs text-neutral-500">
                Must be between {new Date(startDate).toLocaleDateString()} and {new Date(endDate).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="order">
              Order <span className="text-red-500">*</span>
            </Label>
            <Input
              id="order"
              type="number"
              min="1"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder="1, 2, 3..."
              required
            />
            <p className="text-xs text-neutral-500">
              Order determines the sequence of milestones (1 = first, 2 = second, etc.)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : existingTarget ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

