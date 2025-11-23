/**
 * Action Panel Header component with breadcrumb navigation
 */

import React from 'react'
import { ChevronRight, Users } from 'lucide-react'
import { HierarchyOKRNode } from './types'
import { StatusBadge } from './StatusBadge'
import { getNodePath } from './utils/transformToHierarchy'
import { HierarchyTreeData } from './types'

interface ActionPanelHeaderProps {
  selectedNode: HierarchyOKRNode | null
  treeData: HierarchyTreeData | null
}

export function ActionPanelHeader({ selectedNode, treeData }: ActionPanelHeaderProps) {
  if (!selectedNode) {
    return (
      <div className="p-6 border-b border-slate-800">
        <h3 className="text-xl font-semibold text-white">Select an item to view details</h3>
      </div>
    )
  }

  // Build breadcrumb path
  const breadcrumbPath: HierarchyOKRNode[] = []
  if (treeData) {
    const path = getNodePath(treeData.roots, selectedNode.id)
    if (path) {
      breadcrumbPath.push(...path)
    }
  }

  const ownerName = selectedNode.owner?.name || 'Unassigned'
  const typeLabel = selectedNode.type === 'objective' ? 'Objective' : 'Key Result'

  return (
    <div className="p-6 border-b border-slate-800">
      {/* Breadcrumb */}
      {breadcrumbPath.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2 flex-wrap">
          {breadcrumbPath.slice(0, -1).map((node, index) => (
            <React.Fragment key={node.id}>
              <span className="uppercase tracking-wider font-semibold">{node.type === 'objective' ? 'Objective' : 'Key Result'}</span>
              {index < breadcrumbPath.length - 2 && <ChevronRight size={12} />}
            </React.Fragment>
          ))}
          <ChevronRight size={12} />
          <span className="uppercase tracking-wider font-semibold">{typeLabel}</span>
        </div>
      )}

      {/* Title */}
      <h3 className="text-xl font-semibold text-white leading-tight mb-4">
        {selectedNode.title}
      </h3>

      {/* Owner and Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Users size={14} />
          {ownerName}
        </div>
        <StatusBadge status={selectedNode.status} />
      </div>
    </div>
  )
}

