"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { cn, clampProgress } from "@/lib/utils"
import api from "@/lib/api"

export interface KeyResultContribution {
  id: string
  title: string
  progress: number
  weight?: number // Optional - defaults to 1.0 if not provided
}

export interface ChildObjectiveContribution {
  id: string
  title: string
  progress: number
  weight?: number // Optional - defaults to 1.0 if not provided
}

export interface ProgressBreakdownTooltipProps {
  objectiveId: string
  objectiveProgress: number
  keyResults?: KeyResultContribution[]
  childObjectives?: ChildObjectiveContribution[]
  calculationMethod?: 'WEIGHTED_AVERAGE' | 'SIMPLE_AVERAGE' | 'MANUAL' | 'NONE'
  className?: string
}

/**
 * ProgressBreakdownTooltip Component
 * 
 * Shows a breakdown of how Objective progress is calculated from Key Results.
 * Displays weighted contributions and visual breakdown bars.
 * 
 * @example
 * ```tsx
 * <ProgressBreakdownTooltip
 *   objectiveProgress={75}
 *   keyResults={[
 *     { id: '1', title: 'KR 1', progress: 80, weight: 0.5 },
 *     { id: '2', title: 'KR 2', progress: 70, weight: 0.5 }
 *   ]}
 * />
 * ```
 */
export function ProgressBreakdownTooltip({
  objectiveId,
  objectiveProgress,
  keyResults = [],
  childObjectives = [],
  calculationMethod,
  className,
}: ProgressBreakdownTooltipProps) {
  const [breakdown, setBreakdown] = React.useState<{
    totalProgress: number
    contributions: Array<{
      id: string
      title: string
      type: 'KEY_RESULT' | 'CHILD_OBJECTIVE'
      progress: number
      weight: number
      contribution: number
      percentage: number
    }>
    calculationMethod: 'WEIGHTED_AVERAGE' | 'SIMPLE_AVERAGE' | 'MANUAL' | 'NONE'
  } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch contribution breakdown from API when tooltip is opened
  const fetchBreakdown = React.useCallback(async () => {
    if (breakdown || loading) return // Already fetched or fetching

    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/objectives/${objectiveId}/progress-contribution`)
      setBreakdown(response.data)
    } catch (err: any) {
      console.error('Failed to fetch progress contribution breakdown:', err)
      setError(err.response?.data?.message || 'Failed to load breakdown')
      // Fall back to client-side calculation if API fails
    } finally {
      setLoading(false)
    }
  }, [objectiveId, breakdown, loading])

  // Don't show if manual progress or no contributions
  if (calculationMethod === 'MANUAL' || calculationMethod === 'NONE') {
    return null
  }

  // Use API breakdown if available, otherwise fall back to props
  const useApiData = breakdown !== null && !error
  const apiContributions = breakdown?.contributions || []
  
  // Fallback: Use Key Results if available, otherwise use child Objectives
  const fallbackItems = keyResults.length > 0 ? keyResults : childObjectives
  const fallbackItemType = keyResults.length > 0 ? 'Key Result' : 'Child Objective'

  const items = useApiData 
    ? apiContributions.map(c => ({
        id: c.id,
        title: c.title,
        progress: c.progress,
        weight: c.weight,
        type: c.type,
      }))
    : fallbackItems

  const itemType = useApiData
    ? (apiContributions[0]?.type === 'KEY_RESULT' ? 'Key Result' : 'Child Objective')
    : fallbackItemType

  if (!items || items.length === 0) {
    return null
  }

  // Calculate weighted contributions (only if not using API data)
  const contributions = React.useMemo(() => {
    if (useApiData && breakdown) {
      // Use API breakdown data directly
      return breakdown.contributions.map(c => ({
        id: c.id,
        title: c.title,
        progress: c.progress,
        weight: c.weight,
        contribution: c.contribution,
        contributionPercent: c.contribution,
        type: c.type,
      }))
    }

    // Fallback: calculate from props
    const totalWeight = items.reduce(
      (sum, item) => sum + (item.weight ?? 1.0),
      0
    )

    return items.map(item => {
      const weight = item.weight ?? 1.0
      const contribution = totalWeight > 0
        ? (item.progress * weight) / totalWeight
        : item.progress / items.length

      return {
        ...item,
        weight,
        contribution,
        contributionPercent: contribution,
        type: 'KEY_RESULT' as const, // Default type for fallback
      }
    })
  }, [items, useApiData, breakdown])

  // Format the calculation string
  const calculationParts = contributions.map((c, i) => {
    const prefix = i > 0 ? ' + ' : ''
    return `${prefix}(${c.title}: ${Math.round(clampProgress(c.progress))}% × ${c.weight})`
  })

  const calculationString = `${Math.round(objectiveProgress)}% = ${calculationParts.join('')}`

  return (
    <TooltipProvider>
      <Tooltip onOpenChange={(open: boolean) => {
        if (open) {
          fetchBreakdown()
        }
      }}>
        <TooltipTrigger asChild>
          <Info
            className={cn(
              "h-3 w-3 text-muted-foreground cursor-help",
              className
            )}
            aria-label="Progress breakdown information"
          />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-sm p-3 bg-popover border shadow-lg"
        >
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-popover-foreground mb-1">
                Progress Breakdown
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {calculationString}
              </div>
            </div>

            {/* Visual breakdown bars */}
            <div className="space-y-2 pt-2 border-t border-border">
              {contributions.map((contribution) => (
                <div key={contribution.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-popover-foreground truncate flex-1 min-w-0 mr-2">
                      {contribution.title}
                    </span>
                    <span className="text-muted-foreground font-medium whitespace-nowrap">
                      {Math.round(contribution.contributionPercent)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, contribution.contributionPercent))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{(contribution as any).type === 'CHILD_OBJECTIVE' ? 'Child Objective' : 'Key Result'} Progress: {Math.round(clampProgress(contribution.progress))}%</span>
                    <span>Weight: {contribution.weight}</span>
                  </div>
                </div>
              ))}
            </div>

            {loading && (
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Loading breakdown...
              </div>
            )}
            {error && (
              <div className="text-[10px] text-destructive pt-1 border-t border-border">
                {error}
              </div>
            )}
            {!loading && !error && (
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Progress calculated from {useApiData 
                  ? (breakdown?.calculationMethod === 'WEIGHTED_AVERAGE' ? `${itemType}s` : 'items')
                  : (keyResults.length > 0 ? 'Key Results' : 'Child Objectives')
                } using {useApiData && breakdown?.calculationMethod === 'WEIGHTED_AVERAGE' ? 'weighted' : 'simple'} average
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

