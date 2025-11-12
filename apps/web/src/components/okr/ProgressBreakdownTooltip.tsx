"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

export interface KeyResultContribution {
  id: string
  title: string
  progress: number
  weight?: number // Optional - defaults to 1.0 if not provided
}

export interface ProgressBreakdownTooltipProps {
  objectiveProgress: number
  keyResults: KeyResultContribution[]
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
  objectiveProgress,
  keyResults,
  className,
}: ProgressBreakdownTooltipProps) {
  // Don't show if no key results
  if (!keyResults || keyResults.length === 0) {
    return null
  }

  // Calculate weighted contributions
  const contributions = React.useMemo(() => {
    const totalWeight = keyResults.reduce(
      (sum, kr) => sum + (kr.weight ?? 1.0),
      0
    )

    return keyResults.map(kr => {
      const weight = kr.weight ?? 1.0
      const contribution = totalWeight > 0
        ? (kr.progress * weight) / totalWeight
        : kr.progress / keyResults.length

      return {
        ...kr,
        weight,
        contribution,
        contributionPercent: contribution,
      }
    })
  }, [keyResults])

  // Format the calculation string
  const calculationParts = contributions.map((c, i) => {
    const prefix = i > 0 ? ' + ' : ''
    return `${prefix}(${c.title}: ${Math.round(c.progress)}% × ${c.weight})`
  })

  const calculationString = `${Math.round(objectiveProgress)}% = ${calculationParts.join('')}`

  return (
    <TooltipProvider>
      <Tooltip>
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
          className="max-w-sm p-3 bg-white border shadow-lg"
        >
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-neutral-900 mb-1">
                Progress Breakdown
              </div>
              <div className="text-xs text-neutral-600 leading-relaxed">
                {calculationString}
              </div>
            </div>

            {/* Visual breakdown bars */}
            <div className="space-y-2 pt-2 border-t border-neutral-200">
              {contributions.map((contribution) => (
                <div key={contribution.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-700 truncate flex-1 min-w-0 mr-2">
                      {contribution.title}
                    </span>
                    <span className="text-neutral-600 font-medium whitespace-nowrap">
                      {Math.round(contribution.contributionPercent)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, contribution.contributionPercent))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span>KR Progress: {Math.round(contribution.progress)}%</span>
                    <span>Weight: {contribution.weight}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-200">
              Progress calculated from Key Results using weighted average
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

