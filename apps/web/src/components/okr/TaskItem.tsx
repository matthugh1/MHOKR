'use client'

import React from 'react'
import { Task, InitiativeStatus } from '@okr-nexus/types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { OkrBadge } from './OkrBadge'

interface TaskItemProps {
  task: Task
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  canEdit?: boolean
  ownerName?: string
}

const getTaskStatusBadge = (status: InitiativeStatus) => {
  switch (status) {
    case 'IN_PROGRESS':
      return { tone: 'good' as const, label: 'In Progress' }
    case 'NOT_STARTED':
      return { tone: 'neutral' as const, label: 'Not Started' }
    case 'BLOCKED':
      return { tone: 'bad' as const, label: 'Blocked' }
    case 'COMPLETED':
      return { tone: 'good' as const, label: 'Completed' }
    default:
      return { tone: 'neutral' as const, label: status }
  }
}

const formatDueDate = (dateString: string | Date | null | undefined): { text: string; isOverdue: boolean } | null => {
  if (!dateString) return null
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const formattedDate = format(date, 'MMM d, yyyy')

    if (diffDays < 0) {
      return { text: `${formattedDate} • Overdue`, isOverdue: true }
    } else if (diffDays === 0) {
      return { text: `Due today (${formattedDate})`, isOverdue: false }
    } else if (diffDays === 1) {
      return { text: `Due tomorrow (${formattedDate})`, isOverdue: false }
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days (${formattedDate})`, isOverdue: false }
    } else {
      return { text: `Due ${formattedDate}`, isOverdue: false }
    }
  } catch {
    return null
  }
}

export function TaskItem({ task, onEdit, onDelete, canEdit = false, ownerName }: TaskItemProps) {
  const statusBadge = getTaskStatusBadge(task.status)
  const dueDateInfo = formatDueDate(task.dueDate)

  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 bg-neutral-50/40 hover:bg-neutral-50/60 transition-all p-3',
        canEdit && (onEdit || onDelete) && 'cursor-pointer'
      )}
      onClick={() => canEdit && onEdit && onEdit(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h5 className="text-sm font-medium text-foreground">{task.title}</h5>
            <OkrBadge tone={statusBadge.tone}>{statusBadge.label}</OkrBadge>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            {ownerName && (
              <span>Owner: {ownerName}</span>
            )}
            {dueDateInfo && (
              <span className={cn(dueDateInfo.isOverdue && 'text-destructive font-medium')}>
                {dueDateInfo.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

