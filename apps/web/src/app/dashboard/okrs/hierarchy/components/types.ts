/**
 * Type definitions for Hierarchy View components
 */

export type OKRStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'
export type OKRType = 'objective' | 'keyResult'

export interface HierarchyOKRNode {
  id: string
  type: OKRType
  title: string
  status: OKRStatus
  progress: number
  ownerId: string
  owner?: {
    id: string
    name: string
    email?: string | null
  }
  parentId?: string | null
  expanded?: boolean
  children: HierarchyOKRNode[]
  // Objective-specific fields
  cycleId?: string | null
  cycleName?: string | null
  visibilityLevel?: string
  isPublished?: boolean
  // Key Result-specific fields
  currentValue?: number | null
  targetValue?: number | null
  startValue?: number | null
  unit?: string | null
  keyResultId?: string // For key results nested under objectives
  objectiveId?: string // For key results
}

export interface SelectedItem {
  id: string
  type: OKRType
  node: HierarchyOKRNode
}

export interface HierarchyTreeData {
  roots: HierarchyOKRNode[]
  allNodes: Map<string, HierarchyOKRNode>
}


