'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { mapErrorToMessage } from '@/lib/error-mapping'
import { useToast } from '@/hooks/use-toast'

interface LinkedKR {
  id: string
  keyResultId: string
  keyResult: {
    id: string
    title: string
  }
  weight: number
}

interface LinkedKeyResultsListProps {
  objectiveId: string
  keyResults: LinkedKR[]
  onRefresh?: () => void
  canEdit?: boolean
}

export function LinkedKeyResultsList({
  objectiveId,
  keyResults,
  onRefresh,
  canEdit = true,
}: LinkedKeyResultsListProps) {
  const { toast } = useToast()
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [debounceTimers, setDebounceTimers] = useState<Record<string, NodeJS.Timeout>>({})

  // Initialize weights from props
  useEffect(() => {
    const initialWeights: Record<string, number> = {}
    keyResults.forEach((kr) => {
      // Handle both junction.weight and weight at top level
      const weight = (kr as any).weight ?? kr.weight ?? 1.0
      initialWeights[kr.keyResultId] = weight
    })
    setWeights(initialWeights)
  }, [keyResults])

  const updateWeight = useCallback(
    async (keyResultId: string, weight: number) => {
      // Validate client-side
      if (weight < 0 || weight > 3.0 || !isFinite(weight)) {
        setErrors((prev) => ({
          ...prev,
          [keyResultId]: 'Weight must be between 0.0 and 3.0',
        }))
        return
      }

      setErrors((prev) => {
        const next = { ...prev }
        delete next[keyResultId]
        return next
      })
      setPending((prev) => ({ ...prev, [keyResultId]: true }))

      try {
        await api.patch(`/objectives/${objectiveId}/key-results/${keyResultId}/weight`, {
          weight,
        })

        // Success - clear any errors
        setErrors((prev) => {
          const next = { ...prev }
          delete next[keyResultId]
          return next
        })

        // Trigger refresh if callback provided
        onRefresh?.()
      } catch (error: any) {
        const errorInfo = mapErrorToMessage(error)
        
        // Revert weight on error
        const kr = keyResults.find((kr) => kr.keyResultId === keyResultId)
        const originalWeight = (kr as any)?.weight ?? kr?.weight ?? 1.0
        setWeights((prev) => ({ ...prev, [keyResultId]: originalWeight }))

        if (error.response?.status === 404 && error.response?.data?.code === 'LINK_NOT_FOUND') {
          // Link was removed - refresh list
          onRefresh?.()
        } else {
          setErrors((prev) => ({
            ...prev,
            [keyResultId]: errorInfo.message,
          }))
          toast({
            title: 'Failed to update weight',
            description: errorInfo.message,
            variant: 'destructive',
          })
        }
      } finally {
        setPending((prev) => {
          const next = { ...prev }
          delete next[keyResultId]
          return next
        })
      }
    },
    [objectiveId, keyResults, onRefresh, toast]
  )

  const handleWeightChange = useCallback(
    (keyResultId: string, value: string) => {
      const numValue = parseFloat(value)
      
      // Update local state immediately (optimistic)
      setWeights((prev) => ({ ...prev, [keyResultId]: isNaN(numValue) ? 0 : numValue }))

      // Clear existing debounce timer
      if (debounceTimers[keyResultId]) {
        clearTimeout(debounceTimers[keyResultId])
      }

      // Validate immediately for UI feedback
      if (value !== '' && (isNaN(numValue) || numValue < 0 || numValue > 3.0)) {
        setErrors((prev) => ({
          ...prev,
          [keyResultId]: 'Weight must be between 0.0 and 3.0',
        }))
      } else {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[keyResultId]
          return next
        })
      }

      // Debounce API call
      const timer = setTimeout(() => {
        if (!isNaN(numValue) && isFinite(numValue)) {
          updateWeight(keyResultId, numValue)
        }
      }, 500)

      setDebounceTimers((prev) => ({ ...prev, [keyResultId]: timer }))
    },
    [debounceTimers, updateWeight]
  )

  const handleBlur = useCallback(
    (keyResultId: string) => {
      // Clear debounce and fire immediately on blur
      if (debounceTimers[keyResultId]) {
        clearTimeout(debounceTimers[keyResultId])
        setDebounceTimers((prev) => {
          const next = { ...prev }
          delete next[keyResultId]
          return next
        })
      }

      const weight = weights[keyResultId]
      if (weight !== undefined && isFinite(weight)) {
        updateWeight(keyResultId, weight)
      }
    },
    [debounceTimers, weights, updateWeight]
  )

  if (keyResults.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No linked Key Results. Link KRs by connecting them in the canvas.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {keyResults.map((kr) => (
        <div key={kr.keyResultId} className="flex items-center gap-3">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{kr.keyResult.title}</div>
            {errors[kr.keyResultId] && (
              <div className="text-xs text-red-500 mt-0.5">{errors[kr.keyResultId]}</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-20">
              <Input
                type="number"
                min="0"
                max="3"
                step="0.1"
                value={weights[kr.keyResultId] ?? 1.0}
                onChange={(e) => handleWeightChange(kr.keyResultId, e.target.value)}
                onBlur={() => handleBlur(kr.keyResultId)}
                disabled={!canEdit || pending[kr.keyResultId]}
                className="h-8 text-sm"
                aria-label={`Weight for ${kr.keyResult.title}`}
              />
            </div>
            {pending[kr.keyResultId] && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      ))}
      <div className="text-xs text-muted-foreground mt-2">
        Influence of each KR on objective progress (0.0–3.0). Default 1.0.
      </div>
    </div>
  )
}

