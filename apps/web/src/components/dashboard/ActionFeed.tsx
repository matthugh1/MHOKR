'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
// ScrollArea not available, using div with overflow
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Target, 
  Flag, 
  FileText,
  CheckSquare,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface FeedItem {
  id: string
  type: 'checkin' | 'status_update' | 'task_complete' | 'progress_update' | 'created'
  title: string
  description?: string
  timestamp: Date | string
  entityType: 'OBJECTIVE' | 'KEY_RESULT' | 'TASK' | 'INITIATIVE'
  entityId: string
  entityTitle: string
  status?: string
  progress?: number
  user?: {
    id: string
    name: string
    avatar?: string
  }
}

interface ActionFeedProps {
  items: FeedItem[]
  onItemClick?: (item: FeedItem) => void
  className?: string
}

const getIcon = (type: FeedItem['type'], status?: string) => {
  switch (type) {
    case 'checkin':
      return <Zap className="w-4 h-4 text-blue-500" />
    case 'status_update':
      if (status === 'AT_RISK' || status === 'OFF_TRACK') {
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      }
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'task_complete':
      return <CheckSquare className="w-4 h-4 text-green-500" />
    case 'progress_update':
      return <TrendingUp className="w-4 h-4 text-blue-500" />
    case 'created':
      return <Target className="w-4 h-4 text-purple-500" />
    default:
      return <Clock className="w-4 h-4 text-gray-500" />
  }
}

const getEntityIcon = (entityType: FeedItem['entityType']) => {
  switch (entityType) {
    case 'OBJECTIVE':
      return <Target className="w-3 h-3" />
    case 'KEY_RESULT':
      return <Flag className="w-3 h-3" />
    case 'TASK':
      return <CheckSquare className="w-3 h-3" />
    case 'INITIATIVE':
      return <FileText className="w-3 h-3" />
  }
}

export function ActionFeed({ items, onItemClick, className }: ActionFeedProps) {
  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="h-full overflow-y-auto px-4" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No recent activity
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border-l-2 border-border pl-4 pb-4 last:pb-0 cursor-pointer hover:bg-muted/50 rounded-r-md p-2 -ml-2 transition-colors"
                  onClick={() => onItemClick?.(item)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      {getIcon(item.type, item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {item.title}
                        </span>
                        {item.status && (
                          <Badge variant="outline" className="text-xs">
                            {item.status.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getEntityIcon(item.entityType)}
                          <span className="truncate">{item.entityTitle}</span>
                        </div>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</span>
                      </div>
                      {item.progress !== undefined && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{item.progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

