/**
 * Recursive tree node component for displaying OKR hierarchy
 */

'use client'

import React, { memo } from 'react'
import { ChevronRight, ChevronDown, Target, TrendingUp } from 'lucide-react'
import { HierarchyOKRNode, OKRType } from './types'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import { HierarchyConnector } from './HierarchyConnector'
import { cn } from '@/lib/utils'

interface CascadeTreeNodeProps {
  node: HierarchyOKRNode
  depth: number
  isSelected: boolean
  isExpanded: boolean
  selectedNodeId: string | null
  expandedNodeIds: Set<string>
  onSelect: (node: HierarchyOKRNode) => void
  onToggleExpand: (nodeId: string) => void
  isLast?: boolean
  hasSibling?: boolean
}

export const CascadeTreeNode = memo(function CascadeTreeNode({
  node,
  depth,
  isSelected,
  isExpanded,
  selectedNodeId,
  expandedNodeIds,
  onSelect,
  onToggleExpand,
  isLast,
  hasSibling,
}: CascadeTreeNodeProps) {
  const hasChildren = node.children.length > 0
  const paddingLeft = depth * 24 + 16

  const handleClick = () => {
    onSelect(node)
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      onToggleExpand(node.id)
    }
  }

  const ownerName = node.owner?.name || 'Unassigned'
  const ownerEmail = node.owner?.email

  return (
    <div className="relative">
      {/* Connector lines */}
      {depth > 0 && (
        <HierarchyConnector depth={depth} isLast={isLast} hasSibling={hasSibling} />
      )}

      {/* Node row */}
      <div
        onClick={handleClick}
        className={cn(
          'group flex items-center py-3 pr-4 border-b border-slate-800/50 cursor-pointer transition-colors relative',
          isSelected
            ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
            : 'hover:bg-slate-800/30 border-l-2 border-l-transparent'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        role="button"
        tabIndex={0}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e as any)
          } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
            e.preventDefault()
            onToggleExpand(node.id)
          } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
            e.preventDefault()
            onToggleExpand(node.id)
          }
        }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 z-10">
          {/* Expand/Collapse Icon */}
          {hasChildren ? (
            <button
              onClick={handleExpandClick}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Type Icon */}
          <div
            className={cn(
              'p-1.5 rounded-md flex-shrink-0',
              node.type === 'objective'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-slate-700/50 text-slate-400'
            )}
          >
            {node.type === 'objective' ? <Target size={16} /> : <TrendingUp size={16} />}
          </div>

          {/* Title & Owner */}
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                'truncate text-sm font-medium',
                isSelected ? 'text-indigo-100' : 'text-slate-200'
              )}
            >
              {node.title}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{ownerName}</span>
              {ownerEmail && (
                <span className="text-slate-600" title={ownerEmail}>
                  {ownerEmail}
                </span>
              )}
            </div>
          </div>

          {/* Status & Progress */}
          <div className="w-48 flex flex-col gap-1 items-end flex-shrink-0">
            <StatusBadge status={node.status} />
            <div className="w-24 flex items-center gap-2">
              <ProgressBar value={node.progress} status={node.status} />
              <span className="text-xs text-slate-400 w-6 text-right">{node.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recursively render children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Vertical guide line */}
          {depth >= 0 && (
            <div
              className="absolute w-px bg-slate-800"
              style={{
                left: `${depth * 24 + 27}px`,
                top: 0,
                bottom: 0,
              }}
            />
          )}
          {node.children.map((child, index) => (
            <CascadeTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isSelected={selectedNodeId === child.id}
              isExpanded={expandedNodeIds.has(child.id)}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              isLast={index === node.children.length - 1}
              hasSibling={node.children.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  )
})

