/**
 * OKR Tree View component
 * Renders a hierarchical tree view of Objectives → Key Results → Initiatives
 * with support for nested Objectives and keyboard navigation
 */

'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useOKRTree, TreeObjective, TreeKeyResult, TreeInitiative } from '@/hooks/useOKRTree'
import { TreeNode } from './OKRTreeNode'
import { OKRTreeBreadcrumb, BreadcrumbItem } from './OKRTreeBreadcrumb'
import { cn } from '@/lib/utils'

interface OKRTreeViewProps {
  objectives: TreeObjective[]
  selectedNodeId?: string | null
  selectedNodeType?: 'objective' | 'keyResult' | 'initiative' | null
  onNodeClick: (nodeId: string, nodeType: 'objective' | 'keyResult' | 'initiative') => void
  onAddKeyResult?: (objectiveId: string, objectiveTitle: string) => void
  onAddInitiative?: (objectiveId: string, objectiveTitle: string) => void
  onAddInitiativeToKr?: (krId: string, krTitle: string, objectiveId: string) => void
  onAddSubObjective?: (parentId: string, parentTitle: string) => void
  onExpand?: (nodeId: string) => void
  onCollapse?: (nodeId: string) => void
}

type ExpandedState = Set<string>

export function OKRTreeView({
  objectives,
  selectedNodeId,
  selectedNodeType,
  onNodeClick,
  onAddKeyResult,
  onAddInitiative,
  onAddInitiativeToKr,
  onAddSubObjective,
  onExpand,
  onCollapse,
}: OKRTreeViewProps) {
  const { rootNodes, getNodePath } = useOKRTree(objectives)
  const [expanded, setExpanded] = useState<ExpandedState>(new Set())
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Initialize: expand root objectives by default
  useEffect(() => {
    const initialExpanded = new Set<string>()
    rootNodes.forEach(obj => {
      initialExpanded.add(obj.id)
    })
    setExpanded(initialExpanded)
  }, [rootNodes])

  // Get breadcrumb path for selected node
  const breadcrumbPath = useMemo(() => {
    if (!selectedNodeId || !selectedNodeType) return []
    return getNodePath(selectedNodeId, selectedNodeType)
  }, [selectedNodeId, selectedNodeType, getNodePath])

  // Track analytics events
  const trackExpand = (nodeId: string) => {
    // Telemetry: Use track() function from analytics.ts instead of console.log
    onExpand?.(nodeId)
  }

  const trackCollapse = (nodeId: string) => {
    // Telemetry: Use track() function from analytics.ts instead of console.log
    onCollapse?.(nodeId)
  }

  const handleToggle = (nodeId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
        trackCollapse(nodeId)
      } else {
        next.add(nodeId)
        trackExpand(nodeId)
      }
      return next
    })
  }

  const handleNodeClick = (nodeId: string, nodeType: 'objective' | 'keyResult' | 'initiative') => {
    onNodeClick(nodeId, nodeType)
  }

  // Keyboard navigation
  const getAllNodes = (): Array<{ id: string; type: 'objective' | 'keyResult' | 'initiative'; level: number }> => {
    const nodes: Array<{ id: string; type: 'objective' | 'keyResult' | 'initiative'; level: number }> = []
    
    const traverse = (obj: TreeObjective, level: number) => {
      nodes.push({ id: obj.id, type: 'objective', level })
      
      // Add key results
      obj.keyResults?.forEach(kr => {
        nodes.push({ id: kr.id, type: 'keyResult', level: level + 1 })
        
        // Add initiatives under KR
        kr.initiatives?.forEach(init => {
          nodes.push({ id: init.id, type: 'initiative', level: level + 2 })
        })
      })
      
      // Add initiatives directly under objective
      obj.initiatives?.forEach(init => {
        nodes.push({ id: init.id, type: 'initiative', level: level + 1 })
      })
      
      // Add child objectives
      obj.children?.forEach(child => {
        traverse(child, level + 1)
      })
    }
    
    rootNodes.forEach(obj => traverse(obj, 0))
    return nodes
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!treeRef.current) return

    const allNodes = getAllNodes()
    if (allNodes.length === 0) return

    const currentIndex = focusedNodeId
      ? allNodes.findIndex(n => n.id === focusedNodeId)
      : -1

    let newIndex = currentIndex

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        newIndex = currentIndex < allNodes.length - 1 ? currentIndex + 1 : currentIndex
        break
      case 'ArrowUp':
        e.preventDefault()
        newIndex = currentIndex > 0 ? currentIndex - 1 : 0
        break
      case 'ArrowRight':
        e.preventDefault()
        if (currentIndex >= 0) {
          const node = allNodes[currentIndex]
          if (node.type === 'objective' || node.type === 'keyResult') {
            if (!expanded.has(node.id)) {
              handleToggle(node.id)
            }
          }
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (currentIndex >= 0) {
          const node = allNodes[currentIndex]
          if (node.type === 'objective' || node.type === 'keyResult') {
            if (expanded.has(node.id)) {
              handleToggle(node.id)
            } else {
              // Move to parent if collapsed
              // This is simplified - in a full implementation, we'd track parent relationships
            }
          }
        }
        break
      case 'Enter':
        e.preventDefault()
        if (currentIndex >= 0) {
          const node = allNodes[currentIndex]
          handleNodeClick(node.id, node.type)
        }
        break
    }

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < allNodes.length) {
      const newNode = allNodes[newIndex]
      setFocusedNodeId(newNode.id)
      // Scroll into view
      const nodeElement = nodeRefs.current.get(newNode.id)
      if (nodeElement) {
        nodeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }

  // Render tree node recursively
  const renderObjective = (
    obj: TreeObjective,
    level: number
  ): React.ReactNode => {
    const isExpanded = expanded.has(obj.id)
    const hasKRs = obj.keyResults && obj.keyResults.length > 0
    const hasInitiatives = obj.initiatives && obj.initiatives.length > 0
    const hasChildren = hasKRs || hasInitiatives || (obj.children && obj.children.length > 0)
    const isSelected = selectedNodeId === obj.id && selectedNodeType === 'objective'
    const isFocused = focusedNodeId === obj.id

    return (
      <div key={obj.id} ref={el => el && nodeRefs.current.set(obj.id, el)}>
        <TreeNode
          type="objective"
          data={obj}
          level={level}
          isExpanded={isExpanded}
          hasChildren={!!hasChildren}
          onToggle={() => handleToggle(obj.id)}
          onClick={() => handleNodeClick(obj.id, 'objective')}
          onAddKeyResult={onAddKeyResult}
          onAddInitiative={onAddInitiative}
          onAddSubObjective={onAddSubObjective}
          canEdit={obj.canEdit}
          canCreateKeyResult={obj.canCreateKeyResult}
          canCreateInitiative={obj.canCreateInitiative}
          selectedId={isSelected || isFocused ? obj.id : undefined}
          aria-level={level + 1}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
        />
        
        {isExpanded && (
          <div role="group">
            {/* Key Results */}
            {obj.keyResults?.map(kr => {
              const krIsExpanded = expanded.has(kr.id)
              const krHasInitiatives = kr.initiatives && kr.initiatives.length > 0
              const krIsSelected = selectedNodeId === kr.id && selectedNodeType === 'keyResult'
              const krIsFocused = focusedNodeId === kr.id
              
              return (
                <div key={kr.id} ref={el => el && nodeRefs.current.set(kr.id, el)}>
                  <TreeNode
                    type="keyResult"
                    data={kr}
                    level={level + 1}
                    isExpanded={krIsExpanded}
                    hasChildren={!!krHasInitiatives}
                    onToggle={() => handleToggle(kr.id)}
                    onClick={() => handleNodeClick(kr.id, 'keyResult')}
                    onAddInitiativeToKr={onAddInitiativeToKr}
                    canEdit={obj.canEditKeyResult?.(kr.id)}
                    canCreateInitiative={obj.canCreateInitiative}
                    selectedId={krIsSelected || krIsFocused ? kr.id : undefined}
                    aria-level={level + 2}
                    aria-expanded={krHasInitiatives ? krIsExpanded : undefined}
                    aria-selected={krIsSelected}
                  />
                  
                  {/* Initiatives under KR */}
                  {krIsExpanded && kr.initiatives?.map(init => {
                    const initIsSelected = selectedNodeId === init.id && selectedNodeType === 'initiative'
                    const initIsFocused = focusedNodeId === init.id
                    
                    return (
                      <div key={init.id} ref={el => el && nodeRefs.current.set(init.id, el)}>
                        <TreeNode
                          type="initiative"
                          data={init}
                          level={level + 2}
                          isExpanded={false}
                          hasChildren={false}
                          onToggle={() => {}}
                          onClick={() => handleNodeClick(init.id, 'initiative')}
                          selectedId={initIsSelected || initIsFocused ? init.id : undefined}
                          aria-level={level + 3}
                          aria-selected={initIsSelected}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
            
            {/* Initiatives directly under Objective */}
            {obj.initiatives?.map(init => {
              const initIsSelected = selectedNodeId === init.id && selectedNodeType === 'initiative'
              const initIsFocused = focusedNodeId === init.id
              
              return (
                <div key={init.id} ref={el => el && nodeRefs.current.set(init.id, el)}>
                  <TreeNode
                    type="initiative"
                    data={init}
                    level={level + 1}
                    isExpanded={false}
                    hasChildren={false}
                    onToggle={() => {}}
                    onClick={() => handleNodeClick(init.id, 'initiative')}
                    selectedId={initIsSelected || initIsFocused ? init.id : undefined}
                    aria-level={level + 2}
                    aria-selected={initIsSelected}
                  />
                </div>
              )
            })}
            
            {/* Child Objectives */}
            {obj.children?.map(child => renderObjective(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (rootNodes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm text-neutral-600">
          <p>No OKRs found</p>
          {onAddKeyResult && (
            <p className="text-xs text-neutral-500 mt-2">
              Create an objective to get started
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      {breadcrumbPath.length > 0 && (
        <div className="mb-4 pb-4 border-b border-neutral-200">
          <OKRTreeBreadcrumb
            items={breadcrumbPath}
            onItemClick={(item) => handleNodeClick(item.id, item.type)}
          />
        </div>
      )}
      
      {/* Tree */}
      <div
        ref={treeRef}
        role="tree"
        aria-label="OKR hierarchy"
        className="space-y-1"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {rootNodes.map(obj => renderObjective(obj, 0))}
      </div>
    </div>
  )
}
