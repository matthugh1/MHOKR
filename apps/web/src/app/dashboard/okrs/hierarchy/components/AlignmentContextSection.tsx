/**
 * Alignment Context Section component
 * Shows parent objective chain for selected item
 */

import React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { HierarchyOKRNode } from './types'
import { StatusBadge } from './StatusBadge'
import { getNodePath } from './utils/transformToHierarchy'
import { HierarchyTreeData } from './types'

interface AlignmentContextSectionProps {
  selectedNode: HierarchyOKRNode | null
  treeData: HierarchyTreeData | null
}

export function AlignmentContextSection({ selectedNode, treeData }: AlignmentContextSectionProps) {
  if (!selectedNode || !treeData) {
    return null
  }

  // Get parent objective (if this is a key result or nested objective)
  const path = getNodePath(treeData.roots, selectedNode.id)
  if (!path || path.length < 2) {
    return null // No parent to show
  }

  // Find the parent objective (skip key results in the path)
  const parentObjective = path
    .slice(0, -1)
    .reverse()
    .find((node) => node.type === 'objective')

  if (!parentObjective) {
    return null
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-white flex items-center gap-2">
        <ArrowUpRight size={16} className="text-slate-500" />
        Alignment Context
      </h4>
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-800/30">
        <div className="text-xs text-slate-500 mb-1">
          {selectedNode.type === 'keyResult' ? 'Contributes to Objective' : 'Parent Objective'}
        </div>
        <div className="text-sm text-slate-200 font-medium mb-2">
          {parentObjective.title}
        </div>
        <StatusBadge status={parentObjective.status} />
      </div>
    </div>
  )
}

