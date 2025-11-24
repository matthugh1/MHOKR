/**
 * Progress Breakdown Section component
 * Shows progress calculation breakdown for objectives (by KR) and key results (start/current/target)
 */

'use client'

import React from 'react'
import { BarChart3, TrendingUp, Target } from 'lucide-react'
import { cn, clampProgress, formatNumber } from '@/lib/utils'

interface ProgressBreakdownSectionProps {
  hideTitle?: boolean
  detail: {
    type: 'objective' | 'keyResult'
    progress: number
    // For objectives: key results breakdown
    keyResults?: Array<{
      id: string
      title: string
      progress: number
      weight?: number
    }>
    // For key results: value breakdown
    startValue?: number | null
    currentValue?: number | null
    targetValue?: number | null
    unit?: string | null
  } | null
}

export function ProgressBreakdownSection({ detail, hideTitle = false }: ProgressBreakdownSectionProps) {
  if (!detail) return null

  if (detail.type === 'objective') {
    // Show breakdown by key results
    if (!detail.keyResults || detail.keyResults.length === 0) {
      return null
    }

    const totalWeight = detail.keyResults.reduce((sum, kr) => sum + (kr.weight || 1), 0)

    return (
      <div className="space-y-4">
        {!hideTitle && (
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 size={16} className="text-slate-500" />
            Progress Breakdown
          </h4>
        )}

        <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Overall Progress</span>
            <span className="text-lg font-semibold text-white">{Math.round(clampProgress(detail.progress))}%</span>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            {detail.keyResults.map((kr) => {
              const weight = kr.weight || 1
              const contribution = totalWeight > 0 ? (weight / totalWeight) * 100 : 0

              return (
                <div key={kr.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 truncate flex-1 mr-2">{kr.title}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {totalWeight > 0 && weight !== 1 && (
                        <span className="text-slate-500">Weight: {weight.toFixed(1)}</span>
                      )}
                      <span className="text-slate-300 font-medium">{Math.round(clampProgress(kr.progress))}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-500',
                        kr.progress >= 100
                          ? 'bg-emerald-500'
                          : kr.progress >= 75
                            ? 'bg-indigo-500'
                            : kr.progress >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                      )}
                      style={{ width: `${clampProgress(kr.progress)}%` }}
                    />
                  </div>
                  {totalWeight > 0 && (
                    <div className="text-xs text-slate-500">
                      Contributes {contribution.toFixed(1)}% to overall progress
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  } else {
    // Show start → current → target breakdown for key results
    if (
      detail.startValue === undefined &&
      detail.currentValue === undefined &&
      detail.targetValue === undefined
    ) {
      return null
    }

    const start = detail.startValue ?? 0
    const current = detail.currentValue ?? start
    const target = detail.targetValue ?? 100
    const unit = detail.unit || ''

    // Calculate progress percentage
    const range = target - start
    const progress = range !== 0 ? ((current - start) / range) * 100 : 0

    return (
      <div className="space-y-4">
        {!hideTitle && (
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-slate-500" />
            Progress Breakdown
          </h4>
        )}

        <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Current Progress</span>
            <span className="text-lg font-semibold text-white">{Math.round(clampProgress(detail.progress))}%</span>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            {/* Start Value */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-slate-500" />
                <span className="text-xs text-slate-400">Start</span>
              </div>
              <span className="text-sm text-slate-200 font-medium">
                {formatNumber(start)}
                {unit && <span className="text-slate-400 ml-1">{unit}</span>}
              </span>
            </div>

            {/* Current Value */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-indigo-400" />
                <span className="text-xs text-slate-400">Current</span>
              </div>
              <span className="text-sm text-white font-semibold">
                {formatNumber(current)}
                {unit && <span className="text-slate-400 ml-1">{unit}</span>}
              </span>
            </div>

            {/* Target Value */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-emerald-400" />
                <span className="text-xs text-slate-400">Target</span>
              </div>
              <span className="text-sm text-slate-200 font-medium">
                {formatNumber(target)}
                {unit && <span className="text-slate-400 ml-1">{unit}</span>}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="pt-2 border-t border-slate-700/50">
              <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    progress >= 100
                      ? 'bg-emerald-500'
                      : progress >= 75
                        ? 'bg-indigo-500'
                        : progress >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                  )}
                  style={{ width: `${clampProgress(progress)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>{formatNumber(start)}</span>
                <span>{formatNumber(target)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

