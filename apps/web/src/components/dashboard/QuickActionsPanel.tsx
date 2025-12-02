'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, CheckSquare2, TrendingDown } from 'lucide-react'

interface QuickActionsPanelProps {
  canCheckInBulk: boolean
  overdueCheckInCount: number
  canCompleteTasksToday: boolean
  tasksDueTodayCount: number
  canUpdateAtRiskItems: boolean
  atRiskItemsCount: number
  onCheckInBulk?: () => void
  onCompleteTasksToday?: () => void
  onUpdateAtRiskItems?: () => void
}

export function QuickActionsPanel({
  canCheckInBulk,
  overdueCheckInCount,
  canCompleteTasksToday,
  tasksDueTodayCount,
  canUpdateAtRiskItems,
  atRiskItemsCount,
  onCheckInBulk,
  onCompleteTasksToday,
  onUpdateAtRiskItems,
}: QuickActionsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {canCheckInBulk && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={onCheckInBulk}
          >
            <Zap className="w-4 h-4" />
            Check in {overdueCheckInCount} overdue KR{overdueCheckInCount !== 1 ? 's' : ''}
          </Button>
        )}
        
        {canCompleteTasksToday && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={onCompleteTasksToday}
          >
            <CheckSquare2 className="w-4 h-4" />
            Complete {tasksDueTodayCount} task{tasksDueTodayCount !== 1 ? 's' : ''} due today
          </Button>
        )}
        
        {canUpdateAtRiskItems && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={onUpdateAtRiskItems}
          >
            <TrendingDown className="w-4 h-4" />
            Update {atRiskItemsCount} at-risk item{atRiskItemsCount !== 1 ? 's' : ''}
          </Button>
        )}
        
        {!canCheckInBulk && !canCompleteTasksToday && !canUpdateAtRiskItems && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No quick actions available
          </p>
        )}
      </CardContent>
    </Card>
  )
}

