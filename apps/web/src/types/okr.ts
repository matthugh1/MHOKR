/**
 * Shared OKR-facing types for frontend components
 * 
 * NOTE [phase14-hardening]:
 * These are intentionally lean and partial types for UI consumption.
 * We don't need full Prisma mirrors - only what's needed by:
 * - analytics/page.tsx
 * - okrs/page.tsx
 * - ActivityDrawer
 * - PublishLockWarningModal
 * - useTenantPermissions
 */

export type ObjectiveStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'

export interface Objective {
  id: string
  title: string
  description?: string | null
  status: ObjectiveStatus
  progressPct: number
  ownerId: string
  ownerName?: string | null
  tenantId: string
  workspaceId?: string | null
  teamId?: string | null
  isPublished: boolean
  cycleId?: string | null
  createdAt: string
  updatedAt: string
}

export interface KeyResult {
  id: string
  title: string
  target: number
  current: number
  unit?: string | null
  status: ObjectiveStatus
  objectiveId: string
  ownerId: string
  isPublished: boolean
}

export interface ActivityItem {
  id: string
  timestamp: string // ISO
  actorName: string
  action: string // "UPDATED", "CHECK_IN", etc.
  summary: string // human readable like "Target 80 → 95" or "Check-in: 37 (confidence 4/5)"
}

