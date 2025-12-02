/**
 * Type definitions for Hierarchy View components
 */

export type OKRStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'
export type InitiativeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
export type OKRType = 'objective' | 'keyResult' | 'initiative'

export interface HierarchyOKRNode {
  id: string
  type: OKRType
  title: string
  status: OKRStatus | InitiativeStatus
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
  workspaceId?: string | null
  teamId?: string | null
  pillarId?: string | null
  // Key Result-specific fields
  currentValue?: number | null
  targetValue?: number | null
  startValue?: number | null
  unit?: string | null
  keyResultId?: string // For key results nested under objectives
  objectiveId?: string // For key results and initiatives
  // Initiative-specific fields
  initiativeId?: string // For initiatives
  dueDate?: string | null
  description?: string | null
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


