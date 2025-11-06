'use client'

import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { CycleHealthSkeleton } from '@/components/ui/skeletons'

interface CycleHealthSummary {
  cycleId: string
  objectives: { total: number; published: number; draft: number }
  krs: { total: number; onTrack: number; atRisk: number; blocked: number; completed: number }
  checkins: { upcoming7d: number; overdue: number; recent24h: number }
}

interface CycleHealthStripProps {
  cycleId: string | null
}

export function CycleHealthStrip({ cycleId }: CycleHealthStripProps) {
  const { user } = useAuth()
  const [summary, setSummary] = useState<CycleHealthSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cycleId) {
      setSummary(null)
      return
    }

    const fetchSummary = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get(`/okr/insights/cycle-summary?cycleId=${cycleId}`)
        setSummary(response.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load cycle health')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [cycleId, user?.id])

  if (!cycleId || loading) {
    return <CycleHealthSkeleton />
  }

  if (error || !summary) {
    return null
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-md border border-border" role="region" aria-label="Cycle health summary">
            <span className="text-xs font-medium text-muted-foreground">Cycle health:</span>
      
            {/* Objectives */}
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className="text-xs"
                aria-label={`${summary.objectives.total} objectives`}
              >
                <span className="text-xs font-medium">{summary.objectives.total}</span>
                <span className="text-xs text-muted-foreground ml-1">Objectives</span>
              </Badge>
              {summary.objectives.published > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  aria-label={`${summary.objectives.published} published objectives`}
                >
                  {summary.objectives.published} published
                </Badge>
              )}
              {summary.objectives.draft > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  aria-label={`${summary.objectives.draft} draft objectives`}
                >
                  {summary.objectives.draft} draft
                </Badge>
              )}
            </div>

            {/* KRs */}
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className="text-xs"
                aria-label={`${summary.krs.total} key results`}
              >
                <span className="text-xs font-medium">{summary.krs.total}</span>
                <span className="text-xs text-muted-foreground ml-1">KRs</span>
              </Badge>
              {summary.krs.onTrack > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs text-emerald-600"
                  aria-label={`${summary.krs.onTrack} key results on track`}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {summary.krs.onTrack} on track
                </Badge>
              )}
              {summary.krs.atRisk > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs text-amber-600"
                  aria-label={`${summary.krs.atRisk} key results at risk`}
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {summary.krs.atRisk} at risk
                </Badge>
              )}
              {summary.krs.blocked > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs text-rose-600"
                  aria-label={`${summary.krs.blocked} key results blocked`}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  {summary.krs.blocked} blocked
                </Badge>
              )}
            </div>

            {/* Check-ins */}
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className="text-xs"
                aria-label={`${summary.checkins.upcoming7d + summary.checkins.overdue} check-ins`}
              >
                <span className="text-xs font-medium">
                  {summary.checkins.upcoming7d + summary.checkins.overdue}
                </span>
                <span className="text-xs text-muted-foreground ml-1">check-ins</span>
              </Badge>
              {summary.checkins.overdue > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs text-rose-600"
                  aria-label={`${summary.checkins.overdue} overdue check-ins`}
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {summary.checkins.overdue} overdue
                </Badge>
              )}
              {summary.checkins.upcoming7d > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs text-amber-600"
                  aria-label={`${summary.checkins.upcoming7d} upcoming check-ins`}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {summary.checkins.upcoming7d} upcoming
                </Badge>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Cycle overview; use the filters below to refine the list.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
