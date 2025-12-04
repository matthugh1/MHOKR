'use client'

import React from 'react'
import { Task } from '@okr-nexus/types'
import { TaskItem } from './TaskItem'
import { Button } from '@/components/ui/button'
import { Plus, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskListProps {
  tasks: Task[]
  keyResultId?: string
  initiativeId?: string
  onAddTask?: (keyResultId?: string, initiativeId?: string) => void
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  canEdit?: boolean
  ownerNames?: Record<string, string>
  hideTitle?: boolean
}

export function TaskList({
  tasks,
  keyResultId,
  initiativeId,
  onAddTask,
  onEditTask,
  onDeleteTask,
  canEdit = false,
  ownerNames = {},
  hideTitle = false,
}: TaskListProps) {
  const hasTasks = tasks.length > 0

  if (!hasTasks && !canEdit) {
    return null
  }

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckSquare size={16} className="text-muted-foreground" />
            Tasks ({tasks.length})
          </h4>
          {canEdit && onAddTask && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddTask(keyResultId, initiativeId)}
              className="h-7 px-2 text-xs"
            >
              <Plus size={14} className="mr-1" />
              Add Task
            </Button>
          )}
        </div>
      )}

      {!hasTasks && canEdit && (
        <div className="bg-muted/50 rounded-lg border border-border p-6 text-center">
          <CheckSquare size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No tasks yet</p>
          {onAddTask && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddTask(keyResultId, initiativeId)}
            >
              <Plus size={14} className="mr-1" />
              Create Task
            </Button>
          )}
        </div>
      )}

      {hasTasks && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              canEdit={canEdit}
              ownerName={ownerNames[task.ownerId]}
            />
          ))}
        </div>
      )}
    </div>
  )
}



