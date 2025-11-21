'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Target, Trash2, Edit2, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  getObjectivePhasedTargets,
  getKeyResultPhasedTargets,
  deletePhasedTarget,
  type PhasedTarget,
  type PhasedTargetInterval,
} from '@/lib/phased-targets-api'
import { format } from 'date-fns'

interface PhasedTargetTimelineProps {
  objectiveId?: string
  keyResultId?: string
  canEdit?: boolean
  onEdit?: (target: PhasedTarget) => void
  onAdd?: () => void
  className?: string
}

export function PhasedTargetTimeline({
  objectiveId,
  keyResultId,
  canEdit = false,
  onEdit,
  onAdd,
  className,
}: PhasedTargetTimelineProps) {
  const [targets, setTargets] = useState<PhasedTarget[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const loadTargets = async () => {
      if (!objectiveId && !keyResultId) return

      setIsLoading(true)
      try {
        const data = objectiveId
          ? await getObjectivePhasedTargets(objectiveId)
          : await getKeyResultPhasedTargets(keyResultId!)
        setTargets(data)
      } catch (error: any) {
        console.error('Failed to load phased targets:', error)
        toast({
          title: 'Error',
          description: 'Failed to load phased targets',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadTargets()
  }, [objectiveId, keyResultId, toast])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) {
      return
    }

    setIsDeleting(id)
    try {
      await deletePhasedTarget(id)
      setTargets(targets.filter(t => t.id !== id))
      toast({
        title: 'Milestone deleted',
        description: 'The milestone has been removed successfully.',
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete milestone'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const getIntervalBadgeColor = (interval: PhasedTargetInterval) => {
    switch (interval) {
      case 'MONTHLY':
        return 'bg-blue-100 text-blue-700'
      case 'QUARTERLY':
        return 'bg-purple-100 text-purple-700'
      case 'CUSTOM':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-4', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">Loading milestones...</span>
      </div>
    )
  }

  if (targets.length === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-neutral-700">Milestones</h4>
          {canEdit && onAdd && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAdd}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Milestone
            </Button>
          )}
        </div>
        <p className="text-sm text-neutral-500 italic">No milestones set</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-neutral-700">Milestones ({targets.length})</h4>
        {canEdit && onAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Milestone
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {targets.map((target) => (
          <div
            key={target.id}
            className="flex items-center gap-3 p-3 rounded-md border bg-white hover:bg-neutral-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={cn('text-xs', getIntervalBadgeColor(target.interval))}
                >
                  {target.interval}
                </Badge>
                <span className="text-xs text-neutral-500">Order: {target.order}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700">
                    {format(new Date(target.targetDate), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="text-sm text-neutral-600">
                    Target: {target.targetValue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center gap-1">
                {onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(target)}
                    className="h-7 w-7 p-0"
                    aria-label="Edit milestone"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(target.id)}
                  disabled={isDeleting === target.id}
                  className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete milestone"
                >
                  {isDeleting === target.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

