/**
 * Action Panel container component
 * Conditionally renders sections based on selection type
 */

'use client'

import React from 'react'
import { HierarchyOKRNode } from './types'
import { HierarchyTreeData } from './types'
import { ActionPanelHeader } from './ActionPanelHeader'
import { AIInsightsSection } from './AIInsightsSection'
import { CheckInSection } from './CheckInSection'
import { AlignmentContextSection } from './AlignmentContextSection'

interface ActionPanelProps {
  selectedNode: HierarchyOKRNode | null
  treeData: HierarchyTreeData | null
  onCheckIn: (krId: string, data: { value: number; confidence: number; note?: string }) => Promise<void>
  checkInLoading?: boolean
}

export function ActionPanel({
  selectedNode,
  treeData,
  onCheckIn,
  checkInLoading,
}: ActionPanelProps) {
  return (
    <div className="w-full lg:w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden shadow-xl z-20">
      <ActionPanelHeader selectedNode={selectedNode} treeData={treeData} />

      {selectedNode ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* AI Insights - Only for objectives */}
          {selectedNode.type === 'objective' && (
            <AIInsightsSection selectedNode={selectedNode} />
          )}

          {/* Check-in Section - Only for key results */}
          {selectedNode.type === 'keyResult' && (
            <CheckInSection
              selectedNode={selectedNode}
              onCheckIn={onCheckIn}
              loading={checkInLoading}
            />
          )}

          {/* Alignment Context - Show for nested items */}
          <AlignmentContextSection selectedNode={selectedNode} treeData={treeData} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-2">No item selected</p>
            <p className="text-xs text-slate-500">
              Select an objective or key result from the tree to view details
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

