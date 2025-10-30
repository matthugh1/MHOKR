'use client'

import { useState, useRef, useEffect } from 'react'
import { NodeProps, Handle, Position } from 'reactflow'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, User, Briefcase, Calendar } from 'lucide-react'
import { Period } from '@okr-nexus/types'
import { formatPeriod } from '@/lib/date-utils'

interface InlineEditProps {
  value: string
  onSave: (value: string) => void
  onCancel: () => void
}

function InlineEdit({ value, onSave, onCancel }: InlineEditProps) {
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue)
    }    if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={() => onSave(editValue)}
      onKeyDown={handleKeyDown}
      className="w-full font-semibold text-xs bg-transparent border-b-2 border-blue-500 focus:outline-none px-1"
    />
  )
}

export function ObjectiveNode({ data, id }: NodeProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(data.label || '')

  useEffect(() => {
    setTitle(data.label || '')
  }, [data.label])

  const getAssignmentLevel = () => {
    if (data.organizationId && !data.workspaceId && !data.teamId) {
      return { icon: Building2, label: 'Org', color: 'text-purple-600' }
    }
    if (data.workspaceId && !data.teamId) {
      return { icon: Briefcase, label: 'Workspace', color: 'text-blue-600' }
    }
    if (data.teamId) {
      return { icon: Users, label: 'Team', color: 'text-green-600' }
    }
    return { icon: User, label: 'Personal', color: 'text-orange-600' }
  }

  const assignment = getAssignmentLevel()
  const AssignmentIcon = assignment.icon

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
  }

  const handleTitleSave = (newTitle: string) => {
    setIsEditingTitle(false)
    if (newTitle !== data.label && data.onQuickSave) {
      data.onQuickSave(id, { label: newTitle })
    }
    setTitle(newTitle)
  }

  const handleTitleCancel = () => {
    setIsEditingTitle(false)
    setTitle(data.label || '')
  }

  return (
    <div 
      onClick={(e) => {
        // Single click - open edit panel
        if (!isEditingTitle) {
          data.onEdit?.(id, data)
        }
      }}
      onDoubleClick={handleDoubleClick}
      title="Click to edit • Double-click title to edit inline"
      className="w-[260px] h-[120px] px-3 py-2 shadow-md rounded-lg border-2 border-blue-500 bg-white cursor-pointer hover:shadow-lg hover:border-blue-600 hover:scale-[1.02] transition-all"
    >
      {/* Always-visible Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 !bg-blue-500 !border-2 !border-white"
        style={{ top: -8 }}
      />
      
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Badge variant="default" className="text-[10px] px-1.5 py-0">Objective</Badge>
          <div className={`flex items-center gap-0.5 ${assignment.color}`}>
            <AssignmentIcon className="h-3 w-3" />
            <span className="text-[9px] font-medium">{assignment.label}</span>
          </div>
        </div>
        <span className="text-xs font-bold">{data.progress || 0}%</span>
      </div>
      
      <div className="font-semibold text-xs mb-1 line-clamp-2 min-h-[32px]">
        {isEditingTitle ? (
          <InlineEdit
            value={title}
            onSave={handleTitleSave}
            onCancel={handleTitleCancel}
          />
        ) : (
          <span onDoubleClick={handleDoubleClick}>{title}</span>
        )}
      </div>
      
      {data.period && data.startDate && (
        <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-1">
          <Calendar className="h-2.5 w-2.5" />
          <span>{formatPeriod(data.period as Period, data.startDate)}</span>
        </div>
      )}
      {data.description && (
        <div className="text-[10px] text-slate-400 line-clamp-1">{data.description}</div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 !bg-blue-500 !border-2 !border-white"
        style={{ bottom: -8 }}
      />
    </div>
  )
}

export function KeyResultNode({ data, id }: NodeProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(data.label || '')

  useEffect(() => {
    setTitle(data.label || '')
  }, [data.label])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
  }

  const handleTitleSave = (newTitle: string) => {
    setIsEditingTitle(false)
    if (newTitle !== data.label && data.onQuickSave) {
      data.onQuickSave(id, { label: newTitle })
    }
    setTitle(newTitle)
  }

  const handleTitleCancel = () => {
    setIsEditingTitle(false)
    setTitle(data.label || '')
  }

  return (
    <div 
      onClick={(e) => {
        if (!isEditingTitle) {
          data.onEdit?.(id, data)
        }
      }}
      onDoubleClick={handleDoubleClick}
      title="Click to edit • Double-click title to edit inline"
      className="w-[260px] h-[110px] px-3 py-2 shadow-md rounded-lg border-2 border-green-500 bg-white cursor-pointer hover:shadow-lg hover:border-green-600 hover:scale-[1.02] transition-all"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 !bg-green-500 !border-2 !border-white"
        style={{ top: -8 }}
      />

      <div className="flex items-center justify-between mb-1">
        <Badge variant="success" className="text-[10px] px-1.5 py-0">Key Result</Badge>
        <span className="text-xs font-bold">{data.progress || 0}%</span>
      </div>
      
      <div className="font-semibold text-xs mb-1 line-clamp-2 min-h-[32px]">
        {isEditingTitle ? (
          <InlineEdit
            value={title}
            onSave={handleTitleSave}
            onCancel={handleTitleCancel}
          />
        ) : (
          <span onDoubleClick={handleDoubleClick}>{title}</span>
        )}
      </div>
      
      {data.period && data.startDate && (
        <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-1">
          <Calendar className="h-2.5 w-2.5" />
          <span>{formatPeriod(data.period as Period, data.startDate)}</span>
        </div>
      )}
      {data.current !== undefined && data.target !== undefined && (
        <div className="text-[10px] text-slate-400">
          {data.current} / {data.target} {data.unit || ''}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 !bg-green-500 !border-2 !border-white"
        style={{ bottom: -8 }}
      />
    </div>
  )
}

export function InitiativeNode({ data, id }: NodeProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(data.label || '')

  useEffect(() => {
    setTitle(data.label || '')
  }, [data.label])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
  }

  const handleTitleSave = (newTitle: string) => {
    setIsEditingTitle(false)
    if (newTitle !== data.label && data.onQuickSave) {
      data.onQuickSave(id, { label: newTitle })
    }
    setTitle(newTitle)
  }

  const handleTitleCancel = () => {
    setIsEditingTitle(false)
    setTitle(data.label || '')
  }

  return (
    <div 
      onClick={(e) => {
        if (!isEditingTitle) {
          data.onEdit?.(id, data)
        }
      }}
      onDoubleClick={handleDoubleClick}
      title="Click to edit • Double-click title to edit inline"
      className="w-[260px] h-[100px] px-3 py-2 shadow-md rounded-lg border-2 border-purple-500 bg-white cursor-pointer hover:shadow-lg hover:border-purple-600 hover:scale-[1.02] transition-all"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 !bg-purple-500 !border-2 !border-white"
        style={{ top: -8 }}
      />

      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mb-1">Initiative</Badge>
      
      <div className="font-semibold text-xs mb-1 line-clamp-2 min-h-[32px]">
        {isEditingTitle ? (
          <InlineEdit
            value={title}
            onSave={handleTitleSave}
            onCancel={handleTitleCancel}
          />
        ) : (
          <span onDoubleClick={handleDoubleClick}>{title}</span>
        )}
      </div>
      
      {data.period && data.startDate && (
        <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-1">
          <Calendar className="h-2.5 w-2.5" />
          <span>{formatPeriod(data.period as Period, data.startDate)}</span>
        </div>
      )}
      {data.status && (
        <div className="text-[10px] text-slate-400">{data.status}</div>
      )}
    </div>
  )
}


