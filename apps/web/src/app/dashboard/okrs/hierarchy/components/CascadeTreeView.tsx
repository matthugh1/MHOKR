/**
 * Cascade Tree View container component
 */

'use client'

import React, { useState, useMemo } from 'react'
import { HierarchyOKRNode, HierarchyTreeData } from './types'
import { CascadeTreeNode } from './CascadeTreeNode'
import { OkrRowSkeleton } from '@/components/ui/skeletons'
import { cn } from '@/lib/utils'

interface CascadeTreeViewProps {
  treeData: HierarchyTreeData | null
  loading: boolean
  error: string | null
  selectedNodeId: string | null
  expandedNodeIds: Set<string>
  onSelectNode: (node: HierarchyOKRNode) => void
  onToggleExpand: (nodeId: string) => void
}

export function CascadeTreeView({
  treeData,
  loading,
  error,
  selectedNodeId,
  expandedNodeIds,
  onSelectNode,
  onToggleExpand,
}: CascadeTreeViewProps) {
  const handleToggleExpand = (nodeId: string) => {
    onToggleExpand(nodeId)
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-900/30">
        <div className="px-6 py-3 flex items-center justify-between border-b border-slate-800/50 sticky top-0 bg-slate-900/30 backdrop-blur-sm z-10">
          <div className="flex gap-2">
            <div className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">
              Hierarchy View
            </div>
          </div>
        </div>
        <div className="py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-4 border-b border-slate-800/50">
              <div className="h-4 bg-slate-800/50 rounded w-3/4 mb-2 animate-pulse" />
              <div className="h-3 bg-slate-800/30 rounded w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-900/30">
        <div className="px-6 py-3 flex items-center justify-between border-b border-slate-800/50 sticky top-0 bg-slate-900/30 backdrop-blur-sm z-10">
          <div className="flex gap-2">
            <div className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">
              Hierarchy View
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-red-400 mb-2">Error loading OKRs</p>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!treeData || treeData.roots.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-900/30">
        <div className="px-6 py-3 flex items-center justify-between border-b border-slate-800/50 sticky top-0 bg-slate-900/30 backdrop-blur-sm z-10">
          <div className="flex gap-2">
            <div className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">
              Hierarchy View
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-2">No OKRs found</p>
            <p className="text-xs text-slate-500">
              Create your first objective to get started
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900/30">
      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-slate-800/50 sticky top-0 bg-slate-900/30 backdrop-blur-sm z-10">
        <div className="flex gap-2">
          <div className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">
            Hierarchy View
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{treeData.roots.length} root objective{treeData.roots.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tree Content */}
      <div className="py-2">
        {treeData.roots.map((node, index) => (
            <CascadeTreeNode
              key={node.id}
              node={node}
              depth={0}
              isSelected={selectedNodeId === node.id}
              isExpanded={expandedNodeIds.has(node.id)}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onSelect={onSelectNode}
              onToggleExpand={handleToggleExpand}
              isLast={index === treeData.roots.length - 1}
              hasSibling={treeData.roots.length > 1}
            />
        ))}
      </div>
    </div>
  )
}

