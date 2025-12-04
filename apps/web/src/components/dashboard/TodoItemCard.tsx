'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckSquare, Target, Zap, FileText, AlertCircle, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { InlineStatusEditor } from './InlineStatusEditor'
import { InlineProgressEditor } from './InlineProgressEditor'

interface TodoItem {
  type: 'CHECK_IN' | 'TASK' | 'KEY_RESULT' | 'OBJECTIVE' | 'INITIATIVE'
  id: string
  title: string
  reason: string
  priority: number
  dueDate: string | Date | null
  status: string
  metadata: {
    objectiveId?: string
    objectiveTitle?: string
    keyResultId?: string
    keyResultTitle?: string
    initiativeId?: string
    daysOverdue?: number
    daysSinceUpdate?: number
    [key: string]: any
  }
}

interface TodoItemCardProps {
  todo: TodoItem
  onAction?: (todo: TodoItem) => void | Promise<void>
  onView?: (todo: TodoItem) => void
  onStatusUpdate?: () => void | Promise<void>
  loading?: boolean
  showProgress?: boolean
  currentProgress?: number
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  isDragging?: boolean
  dragOver?: boolean
}

const typeIcons = {
  CHECK_IN: Zap,
  TASK: CheckSquare,
  KEY_RESULT: Target,
  OBJECTIVE: Target,
  INITIATIVE: FileText,
}

const typeColors = {
  CHECK_IN: 'bg-blue-500',
  TASK: 'bg-green-500',
  KEY_RESULT: 'bg-purple-500',
  OBJECTIVE: 'bg-indigo-500',
  INITIATIVE: 'bg-orange-500',
}

const statusColors: Record<string, string> = {
  OVERDUE: 'bg-destructive',
  DUE: 'bg-amber-600',
  AT_RISK: 'bg-orange-600',
  OFF_TRACK: 'bg-red-600',
  BLOCKED: 'bg-red-600',
  ON_TRACK: 'bg-green-600',
  COMPLETED: 'bg-slate-500',
}

export function TodoItemCard({ todo, onAction, onView, onStatusUpdate, loading = false, showProgress = false, currentProgress, draggable = false, onDragStart, onDragOver, onDrop, onDragEnd, isDragging = false, dragOver = false }: TodoItemCardProps) {
  const Icon = typeIcons[todo.type] || AlertCircle
  const typeColor = typeColors[todo.type] || 'bg-gray-500'
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [isEditingProgress, setIsEditingProgress] = useState(false)

  // Determine if status editing is supported for this todo type
  const canEditStatus = todo.type === 'OBJECTIVE' || todo.type === 'KEY_RESULT' || todo.type === 'INITIATIVE' || todo.type === 'TASK'
  const canEditProgress = (todo.type === 'OBJECTIVE' || todo.type === 'KEY_RESULT') && showProgress
  const progress = currentProgress !== undefined ? currentProgress : (todo.metadata.progress || 0)

  const getStatusBadgeColor = () => {
    if (todo.reason.includes('Overdue')) return 'destructive'
    if (todo.reason.includes('Due today') || todo.reason.includes('Due tomorrow')) return 'default'
    if (todo.reason.includes('At Risk') || todo.reason.includes('Off Track')) return 'destructive'
    if (todo.reason.includes('Blocked')) return 'destructive'
    return 'secondary'
  }

  const handleView = () => {
    if (onView) {
      onView(todo)
    } else {
      // Default navigation based on type
      if (todo.type === 'CHECK_IN' && todo.metadata.keyResultId) {
        window.location.href = `/dashboard/okrs/hierarchy?krId=${todo.metadata.keyResultId}`
      } else if (todo.type === 'TASK' && todo.metadata.keyResultId) {
        window.location.href = `/dashboard/okrs/hierarchy?krId=${todo.metadata.keyResultId}`
      } else if (todo.type === 'KEY_RESULT' && todo.metadata.keyResultId) {
        window.location.href = `/dashboard/okrs/hierarchy?krId=${todo.metadata.keyResultId}`
      } else if (todo.type === 'OBJECTIVE' && todo.metadata.objectiveId) {
        window.location.href = `/dashboard/okrs/hierarchy?objectiveId=${todo.metadata.objectiveId}`
      } else if (todo.type === 'INITIATIVE' && todo.metadata.initiativeId) {
        window.location.href = `/dashboard/okrs/hierarchy?initiativeId=${todo.metadata.initiativeId}`
      }
    }
  }

  const getActionLabel = () => {
    switch (todo.type) {
      case 'CHECK_IN':
        return 'Check In'
      case 'TASK':
        if (todo.status === 'COMPLETED') return null
        return 'Complete'
      case 'KEY_RESULT':
      case 'OBJECTIVE':
        return 'Update'
      case 'INITIATIVE':
        return 'Update'
      default:
        return null
    }
  }

  const actionLabel = getActionLabel()

  return (
    <Card
      className={`hover:shadow-md transition-shadow ${isDragging ? 'opacity-50' : ''} ${dragOver ? 'border-2 border-primary' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver?.(e)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop?.(e)
      }}
      onDragEnd={onDragEnd}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`${typeColor} rounded-lg p-2 flex-shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {todo.type.replace(/_/g, ' ')}
                  </Badge>
                  {isEditingStatus && canEditStatus ? (
                    <InlineStatusEditor
                      itemType={todo.type as 'OBJECTIVE' | 'KEY_RESULT' | 'INITIATIVE' | 'TASK'}
                      itemId={todo.id}
                      currentStatus={todo.status}
                      onSuccess={async () => {
                        setIsEditingStatus(false)
                        await onStatusUpdate?.()
                      }}
                      onCancel={() => setIsEditingStatus(false)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeColor()} className="text-xs">
                        {todo.status}
                      </Badge>
                      {canEditStatus && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => setIsEditingStatus(true)}
                          title="Edit status"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-card-foreground mb-1 line-clamp-2">
                  {todo.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {todo.reason}
                </p>
                {canEditProgress && (
                  <div className="mb-2">
                    {isEditingProgress ? (
                      <InlineProgressEditor
                        itemType={todo.type as 'OBJECTIVE' | 'KEY_RESULT'}
                        itemId={todo.id}
                        currentProgress={progress}
                        onSuccess={async () => {
                          setIsEditingProgress(false)
                          await onStatusUpdate?.()
                        }}
                        onCancel={() => setIsEditingProgress(false)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => setIsEditingProgress(true)}
                          title="Edit progress"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {todo.dueDate && (
                  <p className="text-xs text-muted-foreground">
                    Due: {format(new Date(todo.dueDate), 'MMM d, yyyy')}
                  </p>
                )}
                {todo.metadata.objectiveTitle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Objective: {todo.metadata.objectiveTitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              {actionLabel && onAction && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onAction(todo)}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? '...' : actionLabel}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleView}
                className="gap-2"
              >
                View
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

