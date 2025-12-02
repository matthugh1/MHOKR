'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock, TrendingDown, CheckCircle2 } from 'lucide-react'

interface IntelligenceSummaryProps {
  overdueCount: number
  dueThisWeekCount: number
  atRiskCount: number
  staleCount: number
  blockedCount: number
}

export function IntelligenceSummary({
  overdueCount,
  dueThisWeekCount,
  atRiskCount,
  staleCount,
  blockedCount,
}: IntelligenceSummaryProps) {
  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-muted-foreground">Overdue</span>
            </div>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {overdueCount}
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-muted-foreground">Due This Week</span>
            </div>
            <div className={`text-2xl font-bold ${dueThisWeekCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {dueThisWeekCount}
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-muted-foreground">At Risk</span>
            </div>
            <div className={`text-2xl font-bold ${atRiskCount > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
              {atRiskCount}
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-muted-foreground">Stale</span>
            </div>
            <div className={`text-2xl font-bold ${staleCount > 0 ? 'text-slate-500' : 'text-muted-foreground'}`}>
              {staleCount}
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-muted-foreground">Blocked</span>
            </div>
            <div className={`text-2xl font-bold ${blockedCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {blockedCount}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

