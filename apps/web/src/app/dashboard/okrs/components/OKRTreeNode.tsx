/**
 * TreeNode component for OKR Tree view
 * Renders individual nodes (Objective, Key Result, or Initiative) with expand/collapse and actions
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OkrBadge } from '@/components/okr/OkrBadge'
import { TreeObjective, TreeKeyResult, TreeInitiative } from '@/hooks/useOKRTree'

interface TreeNodeProps {
  type: 'objective' | 'keyResult' | 'initiative'
  data: TreeObjective | TreeKeyResult | TreeInitiative
  level: number
  isExpanded: boolean
  hasChildren: boolean
  onToggle: () => void
  onClick: () => void
  onAddKeyResult?: (objectiveId: string, objectiveTitle: string) => void
  onAddInitiative?: (objectiveId: string, objectiveTitle: string) => void
  onAddInitiativeToKr?: (krId: string, krTitle: string, objectiveId: string) => void
  onAddSubObjective?: (parentId: string, parentTitle: string) => void
  onEdit?: () => void
  canEdit?: boolean
  canCreateKeyResult?: boolean
  canCreateInitiative?: boolean
  selectedId?: string | null
  'aria-level'?: number
  'aria-expanded'?: boolean | undefined
  'aria-selected'?: boolean
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ON_TRACK':
      return { tone: 'good' as const, label: 'On track' }
    case 'AT_RISK':
      return { tone: 'warn' as const, label: 'At risk' }
    case 'BLOCKED':
    case 'OFF_TRACK':
      return { tone: 'bad' as const, label: 'Blocked' }
    case 'COMPLETED':
      return { tone: 'neutral' as const, label: 'Completed' }
    case 'CANCELLED':
      return { tone: 'neutral' as const, label: 'Cancelled' }
    default:
      return { tone: 'neutral' as const, label: '—' }
  }
}

const getInitiativeStatusBadge = (status?: string) => {
  switch (status) {
    case 'IN_PROGRESS':
      return { tone: 'good' as const, label: 'In progress' }
    case 'NOT_STARTED':
      return { tone: 'warn' as const, label: 'Not started' }
    case 'BLOCKED':
      return { tone: 'bad' as const, label: 'Blocked' }
    case 'COMPLETED':
      return { tone: 'neutral' as const, label: 'Complete' }
    default:
      return { tone: 'neutral' as const, label: status || '—' }
  }
}

const getProgressBarColor = (status: string) => {
  switch (status) {
    case 'ON_TRACK':
      return 'bg-emerald-500'
    case 'AT_RISK':
      return 'bg-amber-500'
    case 'OFF_TRACK':
    case 'BLOCKED':
      return 'bg-rose-500'
    case 'COMPLETED':
      return 'bg-green-600'
    default:
      return 'bg-neutral-400'
  }
}

const formatProgressLabel = (kr: TreeKeyResult) => {
  if (kr.targetValue !== undefined && kr.currentValue !== undefined) {
    const unit = kr.unit || ''
    return `${kr.currentValue}${unit ? ` ${unit}` : ''} / ${kr.targetValue}${unit ? ` ${unit}` : ''}`
  }
  if (kr.currentValue !== undefined) {
    return `${kr.currentValue}${kr.unit ? ` ${kr.unit}` : ''}`
  }
  return 'No target set'
}

export function TreeNode({
  type,
  data,
  level,
  isExpanded,
  hasChildren,
  onToggle,
  onClick,
  onAddKeyResult,
  onAddInitiative,
  onAddInitiativeToKr,
  onAddSubObjective,
  onEdit,
  canEdit = false,
  canCreateKeyResult = false,
  canCreateInitiative = false,
  selectedId,
  'aria-level': ariaLevel,
  'aria-expanded': ariaExpanded,
  'aria-selected': ariaSelected,
}: TreeNodeProps) {
  const indent = level * 20
  const isSelected = selectedId === data.id
  const isObjective = type === 'objective'
  const isKeyResult = type === 'keyResult'
  const isInitiative = type === 'initiative'
  
  const objectiveData = isObjective ? (data as TreeObjective) : null
  const krData = isKeyResult ? (data as TreeKeyResult) : null
  const initiativeData = isInitiative ? (data as TreeInitiative) : null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick()
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      onToggle()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (hasChildren) {
        onToggle()
      } else {
        onClick()
      }
    }
  }

  // Render Objective node
  if (isObjective && objectiveData) {
    const statusBadge = getStatusBadge(objectiveData.status)
    const hasKRs = objectiveData.keyResults && objectiveData.keyResults.length > 0
    const hasInitiatives = objectiveData.initiatives && objectiveData.initiatives.length > 0
    const hasDirectChildren = hasKRs || hasInitiatives || (objectiveData.children && objectiveData.children.length > 0)
    
    return (
      <div
        role="treeitem"
        aria-level={ariaLevel ?? level + 1}
        aria-expanded={hasDirectChildren ? (ariaExpanded ?? isExpanded) : undefined}
        aria-selected={ariaSelected ?? isSelected}
        className={cn(
          'group relative',
          isSelected && 'ring-2 ring-violet-500 ring-offset-1 rounded-lg'
        )}
      >
        <div
          className={cn(
            'flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-blue-50/50 transition-colors cursor-pointer bg-blue-50/20',
            isSelected && 'bg-blue-100'
          )}
          style={{ paddingLeft: `${indent + 12}px` }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Chevron for expand/collapse */}
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-200 transition-colors',
              !hasDirectChildren && 'invisible'
            )}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={hasDirectChildren ? isExpanded : undefined}
          >
            {hasDirectChildren && (
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              >
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </motion.div>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-neutral-900 truncate">
                {objectiveData.title}
              </h4>
              <OkrBadge tone="neutral" className="text-[10px]">
                {objectiveData.level || 'Personal'}
              </OkrBadge>
              <OkrBadge tone={statusBadge.tone}>
                {statusBadge.label}
              </OkrBadge>
              {objectiveData.progress !== undefined && (
                <span className="text-xs text-neutral-600">
                  {Math.round(objectiveData.progress)}%
                </span>
              )}
            </div>
            
            {/* Owner and quick actions */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-neutral-500">
                {objectiveData.owner?.name || 'Unassigned'}
              </span>
              {canEdit && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canCreateKeyResult && onAddKeyResult && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddKeyResult(objectiveData.id, objectiveData.title)
                      }}
                      className="text-xs text-violet-600 hover:text-violet-700 px-1"
                      aria-label="Add Key Result"
                    >
                      + KR
                    </button>
                  )}
                  {canCreateInitiative && onAddInitiative && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddInitiative(objectiveData.id, objectiveData.title)
                      }}
                      className="text-xs text-violet-600 hover:text-violet-700 px-1"
                      aria-label="Add Initiative"
                    >
                      + I
                    </button>
                  )}
                  {onAddSubObjective && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddSubObjective(objectiveData.id, objectiveData.title)
                      }}
                      className="text-xs text-violet-600 hover:text-violet-700 px-1"
                      aria-label="Add Sub-objective"
                    >
                      + Sub-O
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Key Result node
  if (isKeyResult && krData) {
    const statusBadge = getStatusBadge(krData.status || 'ON_TRACK')
    const progressBarColor = getProgressBarColor(krData.status || 'ON_TRACK')
    const hasInitiatives = krData.initiatives && krData.initiatives.length > 0
    
    return (
      <div
        role="treeitem"
        aria-level={ariaLevel ?? level + 1}
        aria-expanded={hasInitiatives ? (ariaExpanded ?? isExpanded) : undefined}
        aria-selected={ariaSelected ?? isSelected}
        className={cn(
          'group relative',
          isSelected && 'ring-2 ring-violet-500 ring-offset-1 rounded-lg'
        )}
      >
        <div
          className={cn(
            'flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-violet-50/50 transition-colors cursor-pointer bg-violet-50/20',
            isSelected && 'bg-violet-100'
          )}
          style={{ paddingLeft: `${indent + 12}px` }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Chevron */}
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-200 transition-colors',
              !hasInitiatives && 'invisible'
            )}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={hasInitiatives ? isExpanded : undefined}
          >
            {hasInitiatives && (
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              >
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </motion.div>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium text-neutral-900 truncate">
                {krData.title}
              </h4>
              <OkrBadge tone={statusBadge.tone}>
                {statusBadge.label}
              </OkrBadge>
            </div>
            
            {/* Progress bar */}
            {krData.progress !== undefined && (
              <div className="mt-1 w-full h-1 rounded-full bg-neutral-200 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', progressBarColor)}
                  initial={false}
                  animate={{ width: `${Math.min(100, Math.max(0, krData.progress))}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                />
              </div>
            )}
            
            {/* Progress label */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-neutral-600">
                {formatProgressLabel(krData)}
              </span>
              {canCreateInitiative && onAddInitiativeToKr && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddInitiativeToKr(krData.id, krData.title, krData.objectiveId)
                  }}
                  className="text-xs text-violet-600 hover:text-violet-700 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                  aria-label="Add Initiative"
                >
                  + I
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Initiative node
  if (isInitiative && initiativeData) {
    const statusBadge = getInitiativeStatusBadge(initiativeData.status)
    
    return (
      <div
        role="treeitem"
        aria-level={ariaLevel ?? level + 1}
        aria-selected={ariaSelected ?? isSelected}
        className={cn(
          'group relative',
          isSelected && 'ring-2 ring-violet-500 ring-offset-1 rounded-lg'
        )}
      >
        <div
          className={cn(
            'flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-emerald-50/50 transition-colors cursor-pointer bg-emerald-50/20',
            isSelected && 'bg-emerald-100'
          )}
          style={{ paddingLeft: `${indent + 12}px` }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Spacer for alignment */}
          <div className="flex-shrink-0 w-5" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-normal text-neutral-700 truncate">
                {initiativeData.title}
              </h4>
              <OkrBadge tone={statusBadge.tone}>
                {statusBadge.label}
              </OkrBadge>
            </div>
            
            {/* Divider line under initiative */}
            <div className="mt-2 w-full h-px bg-neutral-200" />
          </div>
        </div>
      </div>
    )
  }

  return null
}
