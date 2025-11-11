"use client"

import * as React from "react"
import { useState, useRef, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { OkrBadge } from "./OkrBadge"
import { PillarBadge } from "./PillarBadge"
import { AvatarCircle } from "@/components/dashboard/AvatarCircle"
import { Edit2, Trash2, History, Plus, ChevronDown, ChevronUp, MoreVertical, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { InlineInsightBar } from "./InlineInsightBar"
import { RbacWhyTooltip } from "@/components/rbac/RbacWhyTooltip"
import { WhyCantIInspector } from "./WhyCantIInspector"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InlineTitleEditor } from "./inline-editors/InlineTitleEditor"
import { InlineOwnerEditor } from "./inline-editors/InlineOwnerEditor"
import { InlineStatusEditor } from "./inline-editors/InlineStatusEditor"
import { InlineNumericEditor } from "./inline-editors/InlineNumericEditor"
import { InlinePublishEditor } from "./inline-editors/InlinePublishEditor"
import { useAuth } from "@/contexts/auth.context"
import { usePermissions } from "@/hooks/usePermissions"
import { useTenantPermissions } from "@/hooks/useTenantPermissions"
import { useWorkspace } from "@/contexts/workspace.context"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { mapErrorToMessage } from "@/lib/error-mapping"
import { KeyResultTrendChart } from "./KeyResultTrendChart"
import { ProgressBreakdownTooltip } from "./ProgressBreakdownTooltip"
import { ObjectiveProgressTrendChart } from "./ObjectiveProgressTrendChart"
import { KeyResultStatusTrendChart } from "./KeyResultStatusTrendChart"
import { InitiativeStatusTrendChart } from "./InitiativeStatusTrendChart"

export interface ObjectiveRowProps {
  objective: {
    id: string
    title: string
    status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
    publishState?: 'PUBLISHED' | 'DRAFT' // W4.M1: New field from backend
    progress: number
    isPublished: boolean // W4.M1: Kept for backward compatibility
    cycleName?: string
    cycleLabel?: string
    cycleStatus?: string
    visibilityLevel?: string // W4.M1: Not displayed as badge (server-enforced)
    owner: {
      id: string
      name: string
      email?: string | null
    }
    tenantId?: string | null
    workspaceId?: string | null
    teamId?: string | null
    pillarId?: string | null
    overdueCountForObjective?: number
    lowestConfidence?: number | null
    keyResults?: Array<{
      id: string
      title: string
      status?: string
      progress?: number
      currentValue?: number
      targetValue?: number
      startValue?: number
      unit?: string
      checkInCadence?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'NONE'
      isOverdue?: boolean
      ownerId?: string
      lastCheckInDate?: string | null
      nextCheckInDue?: string | null
      weight?: number // Weight from ObjectiveKeyResult junction table
    }>
    initiatives?: Array<{
      id: string
      title: string
      description?: string
      status?: string
      dueDate?: string
      keyResultId?: string
      keyResultTitle?: string
      ownerId?: string
      createdAt?: string
      updatedAt?: string
    }>
  }
  isExpanded: boolean
  onToggle: (id: string) => void
  onAddKeyResult: (objectiveId: string, objectiveName: string) => void
  onAddInitiative: (objectiveId: string, objectiveName: string) => void
  onEdit: (objectiveId: string) => void
  onDelete: (objectiveId: string) => void
  onOpenHistory?: () => void
  onAddInitiativeToKr?: (krId: string) => void
  onAddCheckIn?: (krId: string) => void
  onEditKeyResult?: (krId: string) => void
  canEdit: boolean
  canDelete: boolean
  canEditKeyResult?: (krId: string) => boolean
  canCheckInOnKeyResult?: (krId: string) => boolean
  canCreateKeyResult?: boolean // Story 5: RBAC-aware permission to create KR
  canCreateInitiative?: boolean // Story 5: RBAC-aware permission to create Initiative
  onOpenContextualAddMenu?: () => void // Story 5: Telemetry callback
  onContextualAddKeyResult?: (objectiveId: string, objectiveTitle: string) => void // Story 5: Contextual KR creation
  onContextualAddInitiative?: (objectiveId: string, objectiveTitle: string) => void // Story 5: Contextual Initiative creation
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  onUpdate?: () => void // Callback when inline edit succeeds (optional - for targeted refresh)
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

// W4.M1: Publish State badge (governance state, separate from status)
const getPublishStateBadge = (publishState?: string, isPublished?: boolean) => {
  // Use publishState if available, otherwise derive from isPublished
  const state = publishState || (isPublished ? 'PUBLISHED' : 'DRAFT')
  
  switch (state) {
    case 'PUBLISHED':
      return { tone: 'neutral' as const, label: 'Published' }
    case 'DRAFT':
      return { tone: 'warn' as const, label: 'Draft' }
    default:
      return { tone: 'neutral' as const, label: publishState || 'Draft' }
  }
}

const getCadenceLabel = (cadence?: string) => {
  switch (cadence) {
    case 'WEEKLY':
      return 'Weekly check-ins'
    case 'BIWEEKLY':
      return 'Fortnightly check-ins'
    case 'MONTHLY':
      return 'Monthly check-ins'
    default:
      return 'No cadence'
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

const formatDueDate = (dateString?: string) => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    const formattedDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    
    if (diffDays < 0) {
      return { text: `${formattedDate} • Overdue`, isOverdue: true }
    } else if (diffDays === 0) {
      return { text: `Due today (${formattedDate})`, isOverdue: false }
    } else if (diffDays === 1) {
      return { text: `Due in 1 day (${formattedDate})`, isOverdue: false }
    } else {
      return { text: `Due in ${diffDays} days (${formattedDate})`, isOverdue: false }
    }
  } catch {
    return null
  }
}

const formatLastCheckIn = (dateString?: string | null) => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    
    if (diffDays === 0) {
      if (diffHours < 1) return { text: 'Just now', isRecent: true }
      return { text: `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`, isRecent: true }
    } else if (diffDays === 1) {
      return { text: '1 day ago', isRecent: true }
    } else if (diffDays < 7) {
      return { text: `${diffDays} days ago`, isRecent: diffDays < 3 }
    } else {
      const formattedDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return { text: formattedDate, isRecent: false }
    }
  } catch {
    return null
  }
}

const formatNextCheckIn = (cadence?: string, lastCheckIn?: string | null) => {
  if (!cadence || cadence === 'NONE') return null
  
  let daysBetween = 7
  switch (cadence) {
    case 'WEEKLY':
      daysBetween = 7
      break
    case 'BIWEEKLY':
      daysBetween = 14
      break
    case 'MONTHLY':
      daysBetween = 31
      break
    default:
      return null
  }
  
  const now = new Date()
  const lastCheckInDate = lastCheckIn ? new Date(lastCheckIn) : null
  const nextCheckInDate = lastCheckInDate 
    ? new Date(lastCheckInDate.getTime() + daysBetween * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + daysBetween * 24 * 60 * 60 * 1000)
  
  const diffTime = nextCheckInDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return { text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, isOverdue: true }
  } else if (diffDays === 0) {
    return { text: 'Due today', isOverdue: false, isDueSoon: true }
  } else if (diffDays <= 3) {
    return { text: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, isOverdue: false, isDueSoon: true }
  } else {
    const formattedDate = nextCheckInDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return { text: formattedDate, isOverdue: false, isDueSoon: false }
  }
}

const formatLastUpdated = (dateString?: string) => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

const groupInitiativesByStatus = (initiatives: Array<{
  id: string
  title: string
  status?: string
  dueDate?: string
  keyResultId?: string
  keyResultTitle?: string
  description?: string
  ownerId?: string
  createdAt?: string
  updatedAt?: string
}>) => {
  const groups = {
    COMPLETED: [] as typeof initiatives,
    IN_PROGRESS: [] as typeof initiatives,
    NOT_STARTED: [] as typeof initiatives,
    BLOCKED: [] as typeof initiatives,
    UNKNOWN: [] as typeof initiatives,
  }
  
  initiatives.forEach(init => {
    const status = init.status || 'NOT_STARTED'
    if (status === 'COMPLETED') {
      groups.COMPLETED.push(init)
    } else if (status === 'IN_PROGRESS') {
      groups.IN_PROGRESS.push(init)
    } else if (status === 'NOT_STARTED') {
      groups.NOT_STARTED.push(init)
    } else if (status === 'BLOCKED') {
      groups.BLOCKED.push(init)
    } else {
      groups.UNKNOWN.push(init)
    }
  })
  
  // Sort each group by due date (overdue first, then by date)
  const sortByDueDate = (a: typeof initiatives[0], b: typeof initiatives[0]) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    const aDate = new Date(a.dueDate)
    const bDate = new Date(b.dueDate)
    const now = new Date()
    const aOverdue = aDate < now
    const bOverdue = bDate < now
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    return aDate.getTime() - bDate.getTime()
  }
  
  groups.COMPLETED.sort(sortByDueDate)
  groups.IN_PROGRESS.sort(sortByDueDate)
  groups.NOT_STARTED.sort(sortByDueDate)
  groups.BLOCKED.sort(sortByDueDate)
  groups.UNKNOWN.sort(sortByDueDate)
  
  return groups
}

const getProgressBarColor = (status: string) => {
  switch (status) {
    case 'ON_TRACK':
      return 'bg-emerald-500'
    case 'AT_RISK':
      return 'bg-amber-500'
    case 'BLOCKED':
      return 'bg-rose-500'
    case 'COMPLETED':
    case 'CANCELLED':
      return 'bg-neutral-400'
    default:
      return 'bg-neutral-300'
  }
}

const formatProgressLabel = (kr: {
  currentValue?: number
  targetValue?: number
  unit?: string
}): string => {
  if (kr.currentValue === undefined || kr.targetValue === undefined) {
    return 'Progress not tracked'
  }
  
  const current = kr.currentValue
  const target = kr.targetValue
  const unit = kr.unit || ''
  
  if (unit.toLowerCase() === 'percentage') {
    return `${Math.round(current)}% of ${Math.round(target)}%`
  } else if (unit.toLowerCase() === 'seconds') {
    return `${Math.round(current)}s → ${Math.round(target)}s target`
  } else {
    return `${current} of ${target} ${unit}`.trim()
  }
}

const getCyclePill = (cycleLabel: string, cycleStatus: string) => {
  const baseClasses = "px-2 py-1 rounded-full text-[11px] font-medium leading-none"
  
  // Strip "(draft)" from cycle label to avoid confusion with objective publish status
  const cleanCycleLabel = cycleLabel.replace(/\s*\(draft\)/i, '').trim()
  
  if (cycleStatus === "DRAFT") {
    return {
      text: cleanCycleLabel,
      className: cn(baseClasses, "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300"),
      activeChip: null,
    }
  }
  if (cycleStatus === "ARCHIVED") {
    return {
      text: cleanCycleLabel,
      className: cn(baseClasses, "bg-neutral-200 text-neutral-600"),
      activeChip: null,
    }
  }
  if (cycleStatus === "ACTIVE") {
    return {
      text: cleanCycleLabel,
      className: cn(baseClasses, "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-300"),
      activeChip: { text: "Active", className: cn(baseClasses, "bg-emerald-500 text-white") },
    }
  }
  return {
    text: cleanCycleLabel,
    className: cn(baseClasses, "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-300"),
    activeChip: null,
  }
}

export function ObjectiveRow({
  objective,
  isExpanded,
  onToggle,
  onAddKeyResult,
  onAddInitiative,
  onEdit,
  onDelete,
  onOpenHistory,
  onAddInitiativeToKr,
  onAddCheckIn,
  onEditKeyResult,
  canEdit,
  canDelete,
  canEditKeyResult,
  canCheckInOnKeyResult,
  canCreateKeyResult = false,
  canCreateInitiative = false,
  onOpenContextualAddMenu,
  onContextualAddKeyResult,
  onContextualAddInitiative,
  availableUsers = [],
  onUpdate,
}: ObjectiveRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [expandedKeyResults, setExpandedKeyResults] = useState<Set<string>>(new Set())
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  
  // Hooks for inline editing
  const { user } = useAuth()
  const permissions = usePermissions()
  const tenantPermissions = useTenantPermissions()
  const { currentOrganization } = useWorkspace()
  const { toast } = useToast()
  
  // Optimistic state for inline edits
  const [optimisticObjective, setOptimisticObjective] = useState(objective)
  
  // Sync optimistic state when objective prop changes (from parent refresh)
  useEffect(() => {
    setOptimisticObjective(objective)
  }, [objective])
  
  const statusBadge = getStatusBadge(optimisticObjective.status)
  // Note: publishStateBadge removed - using InlinePublishEditor instead
  
  // Deduplicate arrays by ID to prevent duplicate key warnings
  // Directly use array references - React will handle memoization
  const keyResults = React.useMemo(() => {
    const keyResultsArray = optimisticObjective.keyResults || []
    const seen = new Set<string>()
    return keyResultsArray.filter(kr => {
      if (seen.has(kr.id)) {
        console.warn(`Duplicate Key Result ID detected: ${kr.id}`)
        return false
      }
      seen.add(kr.id)
      return true
    })
  }, [optimisticObjective.keyResults])
  
  // Deduplicate and organize initiatives
  const initiatives = React.useMemo(() => {
    const initiativesArray = Array.isArray(optimisticObjective.initiatives) 
      ? optimisticObjective.initiatives 
      : []
    const seen = new Set<string>()
    // Prioritize KR-linked initiatives (they have more context)
    
    const krInitiatives: Array<{
      id: string
      title: string
      status?: string
      dueDate?: string
      keyResultId?: string
      keyResultTitle?: string
    }> = []
    const objectiveInitiatives: Array<{
      id: string
      title: string
      status?: string
      dueDate?: string
      keyResultId?: string
      keyResultTitle?: string
    }> = []
    
    // Separate initiatives by source
    initiativesArray.forEach(init => {
      if (init.keyResultId) {
        krInitiatives.push(init)
      } else {
        objectiveInitiatives.push(init)
      }
    })
    
    // Add KR initiatives first (with context), then objective-only initiatives
    const deduplicated: Array<{
      id: string
      title: string
      status?: string
      dueDate?: string
      keyResultId?: string
      keyResultTitle?: string
    }> = []
    
    // Add KR-linked initiatives first
    krInitiatives.forEach(init => {
      if (!seen.has(init.id)) {
        seen.add(init.id)
        deduplicated.push(init)
      }
    })
    
    // Add objective-only initiatives (skip if already seen from KR)
    objectiveInitiatives.forEach(init => {
      if (!seen.has(init.id)) {
        seen.add(init.id)
        deduplicated.push(init)
      }
    })
    
    return deduplicated
  }, [optimisticObjective.initiatives])
  
  const overdueCount = optimisticObjective.overdueCountForObjective ?? 0
  
  // Build objective context for permission checks
  const objectiveForHook = {
    id: optimisticObjective.id,
    ownerId: optimisticObjective.owner.id,
    tenantId: optimisticObjective.tenantId,
    workspaceId: optimisticObjective.workspaceId,
    teamId: optimisticObjective.teamId,
    isPublished: optimisticObjective.isPublished,
    visibilityLevel: optimisticObjective.visibilityLevel,
    cycle: optimisticObjective.cycleStatus ? { id: '', status: optimisticObjective.cycleStatus } : null,
    cycleStatus: optimisticObjective.cycleStatus,
  }
  
  // Check if SUPERUSER (read-only)
  const isSuperuserReadOnly = permissions.isSuperuser
  
  // Get lock info for tooltips
  const lockInfo = tenantPermissions.getLockInfoForObjective(objectiveForHook)
  
  // Check if can edit (respecting SUPERUSER read-only)
  const canEditInline = canEdit && !isSuperuserReadOnly
  
  // Check if user can publish/unpublish
  const canPublish = useMemo(() => {
    return permissions.isTenantAdminOrOwner(objectiveForHook.tenantId || undefined) || 
      (objectiveForHook.workspaceId && canEditInline)
  }, [permissions, objectiveForHook.tenantId, objectiveForHook.workspaceId, canEditInline])
  
  const canUnpublish = useMemo(() => {
    return permissions.isTenantAdminOrOwner(objectiveForHook.tenantId || undefined) || canEditInline
  }, [permissions, objectiveForHook.tenantId, canEditInline])
  
  // Mutation handlers
  const handleUpdateObjectiveTitle = async (newTitle: string) => {
    // Optimistic update
    setOptimisticObjective(prev => ({ ...prev, title: newTitle }))
    
    try {
      const response = await api.patch(`/objectives/${optimisticObjective.id}`, { title: newTitle })
      
      // Update from server response
      setOptimisticObjective(prev => ({ ...prev, title: response.data.title }))
      onUpdate?.()
    } catch (error: any) {
      // Revert on error
      setOptimisticObjective(prev => ({ ...prev, title: objective.title }))
      
      const errorInfo = mapErrorToMessage(error)
      // Map error variant to toast variant (toast doesn't support 'warning')
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not save',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  const handleUpdateObjectiveOwner = async (userId: string) => {
    const newOwner = availableUsers.find(u => u.id === userId) || optimisticObjective.owner
    
    // Optimistic update
    setOptimisticObjective(prev => ({
      ...prev,
      owner: { id: newOwner.id, name: newOwner.name, email: newOwner.email || null },
    }))
    
    try {
      const response = await api.patch(`/objectives/${optimisticObjective.id}`, { ownerId: userId })
      
      const updatedOwner = availableUsers.find(u => u.id === response.data.ownerId) || newOwner
      
      // Update from server response
      setOptimisticObjective(prev => ({
        ...prev,
        owner: { id: updatedOwner.id, name: updatedOwner.name, email: updatedOwner.email || null },
      }))
      onUpdate?.()
    } catch (error: any) {
      // Revert on error
      setOptimisticObjective(prev => ({ ...prev, owner: objective.owner }))
      
      const errorInfo = mapErrorToMessage(error)
      // Map error variant to toast variant (toast doesn't support 'warning')
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not save',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  const handleUpdateObjectiveStatus = async (status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED') => {
    // Optimistic update
    setOptimisticObjective(prev => ({ ...prev, status }))
    
    try {
      const response = await api.patch(`/objectives/${optimisticObjective.id}`, { status })
      
      // Update from server response
      setOptimisticObjective(prev => ({ ...prev, status: response.data.status }))
      onUpdate?.()
    } catch (error: any) {
      // Revert on error
      setOptimisticObjective(prev => ({ ...prev, status: objective.status }))
      
      const errorInfo = mapErrorToMessage(error)
      // Map error variant to toast variant (toast doesn't support 'warning')
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not save',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  const handleUpdateObjectivePublishStatus = async (isPublished: boolean) => {
    // Optimistic update
    setOptimisticObjective(prev => ({ 
      ...prev, 
      isPublished,
      publishState: isPublished ? 'PUBLISHED' : 'DRAFT'
    }))
    
    try {
      const response = await api.patch(`/objectives/${optimisticObjective.id}`, { isPublished })
      
      // Update from server response
      setOptimisticObjective(prev => ({ 
        ...prev, 
        isPublished: response.data.isPublished ?? isPublished,
        publishState: (response.data.isPublished ?? isPublished) ? 'PUBLISHED' : 'DRAFT'
      }))
      
      toast({
        title: isPublished ? 'Objective published' : 'Objective unpublished',
        description: isPublished 
          ? 'This objective is now published and locked for editing.'
          : 'This objective is now in draft mode and can be edited.',
      })
      
      onUpdate?.()
    } catch (error: any) {
      // Revert on error
      setOptimisticObjective(prev => ({ 
        ...prev, 
        isPublished: objective.isPublished,
        publishState: objective.publishState || (objective.isPublished ? 'PUBLISHED' : 'DRAFT')
      }))
      
      const errorInfo = mapErrorToMessage(error)
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not update publish status',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  // Key Result mutation handlers
  const handleUpdateKeyResultTitle = async (krId: string, newTitle: string) => {
    // Optimistic update
    setOptimisticObjective(prev => ({
      ...prev,
      keyResults: prev.keyResults?.map(kr => kr.id === krId ? { ...kr, title: newTitle } : kr),
    }))
    
    try {
      const response = await api.patch(`/key-results/${krId}`, { title: newTitle })
      
      // Update from server response
      setOptimisticObjective(prev => ({
        ...prev,
        keyResults: prev.keyResults?.map(kr => kr.id === krId ? { ...kr, title: response.data.title } : kr),
      }))
      onUpdate?.()
    } catch (error: any) {
      // Revert on error
      const originalKr = objective.keyResults?.find(kr => kr.id === krId)
      if (originalKr) {
        setOptimisticObjective(prev => ({
          ...prev,
          keyResults: prev.keyResults?.map(kr => kr.id === krId ? originalKr : kr),
        }))
      }
      
      const errorInfo = mapErrorToMessage(error)
      // Map error variant to toast variant (toast doesn't support 'warning')
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not save',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  const handleUpdateKeyResultOwner = async (krId: string, userId: string) => {
    try {
      const response = await api.patch(`/key-results/${krId}`, { ownerId: userId })
      
      // Update from server response - need to refresh KR ownerId
      setOptimisticObjective(prev => ({
        ...prev,
        keyResults: prev.keyResults?.map(kr => kr.id === krId ? { ...kr, ownerId: userId } : kr),
      }))
      onUpdate?.()
    } catch (error: any) {
      const errorInfo = mapErrorToMessage(error)
      // Map error variant to toast variant (toast doesn't support 'warning')
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not save',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  const handleUpdateKeyResultCurrent = async (krId: string, value: number | undefined) => {
    // Optimistic update
    setOptimisticObjective(prev => ({
      ...prev,
      keyResults: prev.keyResults?.map(kr => kr.id === krId ? { ...kr, currentValue: value } : kr),
    }))
    
    try {
      const response = await api.patch(`/key-results/${krId}`, { currentValue: value })
      
      // Update from server response
      setOptimisticObjective(prev => ({
        ...prev,
        keyResults: prev.keyResults?.map(kr => kr.id === krId ? { ...kr, currentValue: response.data.currentValue } : kr),
      }))
      onUpdate?.()
    } catch (error: any) {
      // Revert on error
      const originalKr = objective.keyResults?.find(kr => kr.id === krId)
      if (originalKr) {
        setOptimisticObjective(prev => ({
          ...prev,
          keyResults: prev.keyResults?.map(kr => kr.id === krId ? originalKr : kr),
        }))
      }
      
      const errorInfo = mapErrorToMessage(error)
      // Map error variant to toast variant (toast doesn't support 'warning')
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not save',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  const handleUpdateKeyResultTarget = async (krId: string, value: number | undefined) => {
    // Optimistic update
    setOptimisticObjective(prev => ({
      ...prev,
      keyResults: prev.keyResults?.map(kr => kr.id === krId ? { ...kr, targetValue: value } : kr),
    }))
    
    try {
      const response = await api.patch(`/key-results/${krId}`, { targetValue: value })
      
      // Update from server response
      setOptimisticObjective(prev => ({
        ...prev,
        keyResults: prev.keyResults?.map(kr => kr.id === krId ? { ...kr, targetValue: response.data.targetValue } : kr),
      }))
      onUpdate?.()
    } catch (error: any) {
      // Revert on error
      const originalKr = objective.keyResults?.find(kr => kr.id === krId)
      if (originalKr) {
        setOptimisticObjective(prev => ({
          ...prev,
          keyResults: prev.keyResults?.map(kr => kr.id === krId ? originalKr : kr),
        }))
      }
      
      const errorInfo = mapErrorToMessage(error)
      // Map error variant to toast variant (toast doesn't support 'warning')
      let toastVariant: 'default' | 'destructive' = 'default'
      if (errorInfo.variant === 'destructive') {
        toastVariant = 'destructive'
      }
      toast({
        title: 'Could not save',
        description: errorInfo.message,
        variant: toastVariant,
      })
      
      throw error
    }
  }
  
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    if (menuOpen || addMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen, addMenuOpen])

  // Keyboard navigation for KR and Initiative expansion
  useEffect(() => {
    if (!isExpanded) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if within this objective row
      const rowElement = menuRef.current?.closest('section')
      if (!rowElement || !rowElement.contains(document.activeElement)) return
      
      // Arrow down: expand next KR or initiative
      if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const allKrIds = keyResults.map(kr => kr.id)
        const expandedKrs = Array.from(expandedKeyResults)
        if (expandedKrs.length === 0 && allKrIds.length > 0) {
          handleToggleKeyResult(allKrIds[0])
        } else if (expandedKrs.length > 0) {
          const currentIndex = allKrIds.indexOf(expandedKrs[expandedKrs.length - 1])
          if (currentIndex < allKrIds.length - 1) {
            handleToggleKeyResult(allKrIds[currentIndex + 1])
          }
        }
      }
      
      // Arrow up: collapse previous KR
      if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const allKrIds = keyResults.map(kr => kr.id)
        const expandedKrs = Array.from(expandedKeyResults)
        if (expandedKrs.length > 0) {
          const currentIndex = allKrIds.indexOf(expandedKrs[expandedKrs.length - 1])
          if (currentIndex > 0) {
            handleToggleKeyResult(allKrIds[currentIndex - 1])
          } else {
            handleToggleKeyResult(allKrIds[0])
          }
        }
      }
      
      // 'E' key: expand all KRs
      if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const allKrIds = keyResults.map(kr => kr.id)
        setExpandedKeyResults(new Set(allKrIds))
      }
      
      // 'C' key: collapse all KRs
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setExpandedKeyResults(new Set())
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, keyResults, expandedKeyResults, onEditKeyResult, canEditKeyResult])

  // Keyboard shortcut: Ctrl/Cmd+E to edit focused KR
  useEffect(() => {
    if (!isExpanded || !onEditKeyResult) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if within this objective row and a KR is focused
      const rowElement = menuRef.current?.closest('section')
      if (!rowElement || !rowElement.contains(document.activeElement)) return

      // Check if focus is on a KR element
      const activeElement = document.activeElement
      const krElement = activeElement?.closest('[data-kr-id]')
      if (!krElement) return

      const krId = krElement.getAttribute('data-kr-id')
      if (!krId) return

      // Ctrl/Cmd+E: Edit focused KR
      if ((e.key === 'e' || e.key === 'E') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (canEditKeyResult && canEditKeyResult(krId)) {
          onEditKeyResult(krId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, onEditKeyResult, canEditKeyResult])

  // Keyboard shortcut: Alt+A (or Option+A on Mac) to open Add menu when row is focused
  useEffect(() => {
    if (!(canCreateKeyResult || canCreateInitiative)) return

    const rowElement = menuRef.current?.closest('section')
    if (!rowElement) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if the row or its children have focus
      const isFocused = rowElement.contains(document.activeElement)
      if (!isFocused) return
      
      if ((e.key === 'a' || e.key === 'A') && (e.altKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        setAddMenuOpen(prev => {
          if (!prev) {
            onOpenContextualAddMenu?.()
          }
          return !prev
        })
      }
    }
    
    // Add to window to catch keyboard events
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [canCreateKeyResult, canCreateInitiative, onOpenContextualAddMenu])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle(objective.id)
    }
  }

  const handleToggleKeyResult = (krId: string) => {
    setExpandedKeyResults(prev => {
      const next = new Set(prev)
      if (next.has(krId)) {
        next.delete(krId)
      } else {
        next.add(krId)
      }
      return next
    })
  }

  const handleToggleInitiative = (initId: string) => {
    setExpandedInitiatives(prev => {
      const next = new Set(prev)
      if (next.has(initId)) {
        next.delete(initId)
      } else {
        next.add(initId)
      }
      return next
    })
  }

  const handleKeyResultKeyDown = (e: React.KeyboardEvent, krId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggleKeyResult(krId)
    }
  }

  const progressBarColor = getProgressBarColor(objective.status)
  const cyclePill = getCyclePill(
    objective.cycleLabel || objective.cycleName || 'Unassigned',
    objective.cycleStatus || 'ACTIVE'
  )

  return (
    <section 
      className="border border-neutral-200 rounded-xl bg-blue-50/30 shadow-sm hover:shadow-md transition-all duration-200"
      aria-expanded={isExpanded}
      style={{ overflow: 'visible' }}
    >
      {/* Collapsed header (always visible) */}
      <div
        className="py-3.5 px-4 cursor-pointer hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 rounded-t-xl"
        onClick={() => onToggle(objective.id)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} objective: ${objective.title}`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left block: Title, status, publication, cycle, owner */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 flex-1 min-w-0">
            {/* Title - Inline Editor */}
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                <InlineTitleEditor
                  value={optimisticObjective.title}
                  onSave={handleUpdateObjectiveTitle}
                  canEdit={canEditInline}
                  lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                  ariaLabel="Edit objective title"
                  resource={objectiveForHook}
                  disabled={isSuperuserReadOnly}
                />
              </div>
              
              {/* Badges row - W4.M1: Separate Status and Publish State chips */}
              <div className="flex items-center gap-2 flex-wrap">
              {/* Status chip - Progress state - Inline Editor */}
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                <InlineStatusEditor
                  currentStatus={optimisticObjective.status}
                  onSave={handleUpdateObjectiveStatus}
                  canEdit={canEditInline}
                  lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                  ariaLabel="Edit objective status"
                  resource={objectiveForHook}
                  disabled={isSuperuserReadOnly}
                  renderBadge={(status, label, tone) => (
                    <OkrBadge tone={tone === 'success' ? 'good' : tone === 'warning' ? 'warn' : 'bad'}>
                      {label}
                    </OkrBadge>
                  )}
                />
                {/* Show tooltip if status is auto-calculated from Key Results */}
                {keyResults.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" aria-label="Status information" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Status calculated from Key Results</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              
              {/* Publish State chip - Governance state - Inline Editor */}
              <div onClick={(e) => e.stopPropagation()}>
                <InlinePublishEditor
                  currentIsPublished={optimisticObjective.isPublished}
                  onSave={handleUpdateObjectivePublishStatus}
                  canEdit={canEditInline}
                  canPublish={canPublish}
                  canUnpublish={canUnpublish}
                  lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                  ariaLabel="Edit objective publish status"
                  resource={objectiveForHook}
                  disabled={isSuperuserReadOnly}
                />
              </div>
              
              {/* Cycle pill */}
              {optimisticObjective.cycleLabel && (
                <>
                  <span className={cyclePill.className}>
                    {cyclePill.text}
                  </span>
                  {cyclePill.activeChip && (
                    <span className={cyclePill.activeChip.className}>
                      {cyclePill.activeChip.text}
                    </span>
                  )}
                </>
              )}
              
              {/* Pillar badge */}
              <PillarBadge pillarId={optimisticObjective.pillarId} />
              
              {/* Owner chip - Inline Editor */}
              <div onClick={(e) => e.stopPropagation()}>
                <InlineOwnerEditor
                  currentOwner={optimisticObjective.owner}
                  availableUsers={availableUsers}
                  onSave={handleUpdateObjectiveOwner}
                  canEdit={canEditInline}
                  lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                  ariaLabel="Edit objective owner"
                  resource={objectiveForHook}
                  disabled={isSuperuserReadOnly}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Middle block: Progress bar and micro-metrics (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-md">
            {/* Progress bar with breakdown tooltip */}
            <div className="flex items-center gap-1.5 flex-1">
              <div className="flex-1 h-1 rounded-full bg-neutral-200 overflow-hidden" style={{ height: '4px' }}>
                <motion.div
                  className={cn("h-full rounded-full", progressBarColor)}
                  initial={false}
                  animate={{ width: `${Math.min(100, Math.max(0, objective.progress))}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                />
              </div>
              {/* Show breakdown tooltip if Objective has Key Results */}
              {keyResults.length > 0 && (
                <div className="flex items-center gap-1">
                  <ProgressBreakdownTooltip
                    objectiveProgress={objective.progress}
                    keyResults={keyResults.map(kr => ({
                      id: kr.id,
                      title: kr.title,
                      progress: kr.progress ?? 0,
                      weight: kr.weight ?? 1.0,
                    }))}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground font-medium cursor-help">Auto</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Progress calculated from Key Results</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
            
            {/* Micro-metrics pills */}
            <div className="flex items-center gap-2 text-[11px]">
              {/* Check-in discipline pill */}
              {overdueCount === 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-medium leading-none whitespace-nowrap">
                  All check-ins on time
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-medium leading-none whitespace-nowrap">
                  Overdue check-ins
                </span>
              )}
              
              {/* Update freshness pill */}
              {objective.lowestConfidence === null ? (
                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 font-medium leading-none whitespace-nowrap">
                  No recent update
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 font-medium leading-none whitespace-nowrap">
                  Updated recently
                </span>
              )}
            </div>
            
            {/* Inline Insight Bar */}
            {isExpanded && (
              <div className="mt-2">
                <InlineInsightBar
                  objectiveId={objective.id}
                  isVisible={isExpanded}
                  onCheckInClick={(krId) => {
                    if (onAddCheckIn) {
                      onAddCheckIn(krId)
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Right block: Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Story 5: Contextual Add menu (replaces individual + KR and + Initiative buttons) */}
            {(canCreateKeyResult || canCreateInitiative) && (
              <div className="relative" ref={addMenuRef} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setAddMenuOpen(!addMenuOpen)
                    onOpenContextualAddMenu?.()
                  }}
                  aria-label="Add Key Result or Initiative"
                  aria-expanded={addMenuOpen}
                  aria-haspopup="true"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                
                {/* Add menu dropdown */}
                {addMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 rounded-md border bg-white shadow-lg text-[13px] z-50 min-w-[180px]">
                    {canCreateKeyResult && (
                      <button
                        className="w-full px-3 py-2 text-left hover:bg-neutral-100 rounded-t-md"
                        onClick={() => {
                          if (onContextualAddKeyResult) {
                            onContextualAddKeyResult(objective.id, objective.title)
                          } else if (onAddKeyResult) {
                            onAddKeyResult(objective.id, objective.title)
                          }
                          setAddMenuOpen(false)
                        }}
                      >
                        Add Key Result
                      </button>
                    )}
                    {canCreateInitiative && (
                      <button
                        className={`w-full px-3 py-2 text-left hover:bg-neutral-100 ${canCreateKeyResult ? '' : 'rounded-t-md'} rounded-b-md`}
                        onClick={() => {
                          if (onContextualAddInitiative) {
                            onContextualAddInitiative(objective.id, objective.title)
                          } else if (onAddInitiative) {
                            onAddInitiative(objective.id, objective.title)
                          }
                          setAddMenuOpen(false)
                        }}
                      >
                        Add Initiative
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Fallback: Legacy + KR button (if contextual menu not available but onAddKeyResult provided) */}
            {canCreateKeyResult === false && canCreateInitiative === false && onAddKeyResult && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[12px] font-medium"
                  onClick={() => onAddKeyResult(objective.id, objective.title)}
                  aria-label="Add Key Result"
                >
                  + KR
                </Button>
              </div>
            )}
            
            {/* Fallback: Legacy + Initiative button (if contextual menu not available but onAddInitiative provided) */}
            {canCreateKeyResult === false && canCreateInitiative === false && onAddInitiative && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[12px] font-medium"
                  onClick={() => onAddInitiative(objective.id, objective.title)}
                  aria-label="Add Initiative"
                >
                  + Initiative
                </Button>
              </div>
            )}
            
            {/* Edit button - hidden if not permitted */}
            {onEdit && canEdit && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[12px] font-medium"
                  onClick={() => onEdit(objective.id)}
                  aria-label="Edit objective"
                >
                  Edit
                </Button>
              </div>
            )}
            {/* Why? inspector for blocked edit */}
            {onEdit && !canEdit && (
              <div onClick={(e) => e.stopPropagation()}>
                <WhyCantIInspector
                  action="edit_okr"
                  resource={objectiveForHook}
                  className="ml-1"
                />
              </div>
            )}
            
            {/* Menu button - only show if at least one action is available */}
            {((onDelete && canDelete) || (typeof onOpenHistory === 'function')) ? (
              <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="More actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
                
                {/* Menu dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 rounded-md border bg-white shadow-lg text-[13px] z-50 min-w-[160px]">
                    {onDelete && canDelete && (
                      <button
                        className="w-full px-3 py-2 text-left hover:bg-neutral-100 rounded-t-md text-rose-600"
                        onClick={() => {
                          onDelete(objective.id)
                          setMenuOpen(false)
                        }}
                      >
                        Delete Objective
                      </button>
                    )}
                    {onOpenHistory != null && (
                      <button
                        className={`w-full px-3 py-2 text-left hover:bg-neutral-100 ${((onDelete && canDelete)) ? 'rounded-b-md' : 'rounded-t-md rounded-b-md'}`}
                        onClick={() => {
                          onOpenHistory()
                          setMenuOpen(false)
                        }}
                      >
                        View history
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            {/* Why? inspector for blocked delete */}
            {onDelete && !canDelete && (
              <div onClick={(e) => e.stopPropagation()}>
                <WhyCantIInspector
                  action="delete_okr"
                  resource={objectiveForHook}
                  className="ml-1"
                />
              </div>
            )}
            
            {/* Chevron */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="ml-1"
            >
              <ChevronDown className="h-5 w-5 text-neutral-400" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            layout // Use layout animation for better height calculation
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ overflow: 'visible' }} // Ensure content is not clipped during animation
            className="bg-neutral-50/80 border-t border-neutral-200 px-4 py-4 rounded-b-xl"
          >
            {/* Objective Progress Trend Chart */}
            {keyResults.length > 0 && (
              <div className="mb-4 pb-4 border-b border-neutral-200">
                <ObjectiveProgressTrendChart objectiveId={objective.id} />
              </div>
            )}
            
            {/* Key Results block */}
            <div className="mb-4">
              <h4 className="text-[13px] font-medium text-neutral-700 mb-2">
                Key Results
              </h4>
              {keyResults.length > 0 ? (
                <div className="space-y-3">
                  {keyResults.map((kr) => {
                    const krStatusBadge = getStatusBadge(kr.status || 'ON_TRACK')
                    const cadenceLabel = getCadenceLabel(kr.checkInCadence)
                    const progressLabel = formatProgressLabel(kr)
                    const krProgressBarColor = getProgressBarColor(kr.status || 'ON_TRACK')
                    const isKrExpanded = expandedKeyResults.has(kr.id)
                    
                    return (
                        <div
                          key={`kr-${kr.id}`}
                          className="rounded-lg border border-neutral-200 bg-violet-50/40 overflow-hidden"
                          data-kr-id={kr.id}
                        >
                          {/* Key Result collapsed header (always visible) */}
                          <div
                            className="p-3 cursor-pointer hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                            onClick={() => handleToggleKeyResult(kr.id)}
                            onKeyDown={(e) => handleKeyResultKeyDown(e, kr.id)}
                            role="button"
                            tabIndex={0}
                            aria-label={`${isKrExpanded ? 'Collapse' : 'Expand'} key result: ${kr.title}. Press Ctrl+E to edit all fields.`}
                            data-kr-id={kr.id}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-col gap-2 flex-1 min-w-0">
                                {/* Title - Inline Editor with Edit button */}
                                <div className="flex items-center gap-2 group">
                                  <div onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
                                    <InlineTitleEditor
                                      value={kr.title}
                                      onSave={(newTitle) => handleUpdateKeyResultTitle(kr.id, newTitle)}
                                      canEdit={canEditKeyResult ? canEditKeyResult(kr.id) : false}
                                      lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                                      ariaLabel="Edit key result title"
                                      resource={objectiveForHook}
                                      disabled={isSuperuserReadOnly}
                                      className="text-[13px] font-medium text-neutral-900"
                                    />
                                  </div>
                                  {/* Edit button - visible when user can edit */}
                                  {onEditKeyResult && canEditKeyResult && canEditKeyResult(kr.id) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onEditKeyResult(kr.id)
                                      }}
                                      className="opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-violet-100 rounded flex-shrink-0"
                                      aria-label={`Edit all fields for key result: ${kr.title}`}
                                      title="Edit all Key Result fields"
                                    >
                                      <Edit2 className="h-3.5 w-3.5 text-violet-600" />
                                    </button>
                                  )}
                                </div>
                                
                                {/* Badges row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <OkrBadge tone={krStatusBadge.tone}>
                                    {krStatusBadge.label}
                                  </OkrBadge>
                                  {kr.checkInCadence && kr.checkInCadence !== 'NONE' && (
                                    <OkrBadge tone="neutral">
                                      {cadenceLabel}
                                    </OkrBadge>
                                  )}
                                  {kr.isOverdue && (
                                    <OkrBadge tone="bad">
                                      Overdue
                                    </OkrBadge>
                                  )}
                                </div>
                                
                                {/* Progress bar */}
                                {kr.progress !== undefined && (
                                  <div className="w-full h-1 rounded-full bg-neutral-200 overflow-hidden">
                                    <motion.div
                                      className={cn("h-full rounded-full", krProgressBarColor)}
                                      initial={false}
                                      animate={{ width: `${Math.min(100, Math.max(0, kr.progress))}%` }}
                                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                    />
                                  </div>
                                )}
                                
                                {/* Progress label */}
                                <div className="text-[12px] text-neutral-600">
                                  {progressLabel}
                                </div>
                              </div>
                              
                              {/* Chevron */}
                              <motion.div
                                animate={{ rotate: isKrExpanded ? 180 : 0 }}
                                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                className="ml-1 flex-shrink-0"
                              >
                                <ChevronDown className="h-4 w-4 text-neutral-400" />
                              </motion.div>
                            </div>
                          </div>

                          {/* Key Result expanded body */}
                          <AnimatePresence>
                            {isKrExpanded && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="border-t border-neutral-200 bg-violet-50/20"
                              >
                                <div className="p-4 space-y-4">
                                  {/* Metrics Section */}
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600 flex items-center gap-2">
                                        <span className="w-1 h-4 bg-violet-400 rounded-full"></span>
                                        Metrics
                                      </h5>
                                      {onEditKeyResult && canEditKeyResult && canEditKeyResult(kr.id) && (
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2.5 text-[11px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                            onClick={() => onEditKeyResult(kr.id)}
                                            aria-label={`Edit all fields for key result: ${kr.title}`}
                                            title="Edit all Key Result fields"
                                          >
                                            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                            Edit all
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    {(kr.currentValue !== undefined || kr.targetValue !== undefined) && (
                                      <div className="flex items-center gap-2 flex-wrap pl-3">
                                        <InlineNumericEditor
                                          label="Current"
                                          value={kr.currentValue}
                                          onSave={(value) => handleUpdateKeyResultCurrent(kr.id, value)}
                                          canEdit={canEditKeyResult ? canEditKeyResult(kr.id) : false}
                                          lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                                          ariaLabel="Edit key result current value"
                                          resource={objectiveForHook}
                                          disabled={isSuperuserReadOnly}
                                          unit={kr.unit || ''}
                                          allowEmpty={false}
                                        />
                                        <span className="text-[12px] text-neutral-400">/</span>
                                        <InlineNumericEditor
                                          label="Target"
                                          value={kr.targetValue}
                                          onSave={(value) => handleUpdateKeyResultTarget(kr.id, value)}
                                          canEdit={canEditKeyResult ? canEditKeyResult(kr.id) : false}
                                          lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                                          ariaLabel="Edit key result target value"
                                          resource={objectiveForHook}
                                          disabled={isSuperuserReadOnly}
                                          unit={kr.unit || ''}
                                          allowEmpty={false}
                                        />
                                        {kr.progress !== undefined && (
                                          <span className="text-[12px] text-neutral-600 font-medium flex items-center gap-1">
                                            ({Math.round(kr.progress)}%)
                                            {kr.status === 'ON_TRACK' && (
                                              <span className="text-emerald-500" aria-label="On track">↑</span>
                                            )}
                                            {kr.status === 'AT_RISK' && (
                                              <span className="text-amber-500" aria-label="At risk">→</span>
                                            )}
                                            {(kr.status === 'OFF_TRACK' || kr.status === 'BLOCKED') && (
                                              <span className="text-rose-500" aria-label="Blocked or off track">↓</span>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Owner */}
                                    {kr.ownerId && availableUsers.length > 0 && (
                                      <div className="flex items-center gap-1.5 pl-3">
                                        <span className="text-[11px] text-neutral-500">Owner:</span>
                                        <InlineOwnerEditor
                                          currentOwner={availableUsers.find(u => u.id === kr.ownerId) || { id: kr.ownerId, name: 'Unknown' }}
                                          availableUsers={availableUsers}
                                          onSave={(userId) => handleUpdateKeyResultOwner(kr.id, userId)}
                                          canEdit={canEditKeyResult ? canEditKeyResult(kr.id) : false}
                                          lockReason={lockInfo.isLocked ? lockInfo.message : undefined}
                                          ariaLabel="Edit key result owner"
                                          resource={objectiveForHook}
                                          disabled={isSuperuserReadOnly}
                                          size="sm"
                                        />
                                      </div>
                                    )}
                                    
                                    {/* Check-in Information */}
                                    {(kr.checkInCadence && kr.checkInCadence !== 'NONE') && (
                                      <div className="flex flex-col gap-1.5 pl-3">
                                        {kr.lastCheckInDate && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-neutral-500">Last check-in:</span>
                                            <span className={cn(
                                              "text-[11px] font-medium",
                                              formatLastCheckIn(kr.lastCheckInDate)?.isRecent ? "text-emerald-600" : "text-neutral-600"
                                            )}>
                                              {formatLastCheckIn(kr.lastCheckInDate)?.text || 'Never'}
                                            </span>
                                          </div>
                                        )}
                                        {kr.nextCheckInDue && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-neutral-500">Next check-in:</span>
                                            <span className={cn(
                                              "text-[11px] font-medium",
                                              formatNextCheckIn(kr.checkInCadence, kr.lastCheckInDate)?.isOverdue ? "text-rose-600" :
                                              formatNextCheckIn(kr.checkInCadence, kr.lastCheckInDate)?.isDueSoon ? "text-amber-600" :
                                              "text-neutral-600"
                                            )}>
                                              {formatNextCheckIn(kr.checkInCadence, kr.lastCheckInDate)?.text || 'Not scheduled'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Edit all fields link */}
                                    {onEditKeyResult && canEditKeyResult && canEditKeyResult(kr.id) && (
                                      <div className="pl-3 pt-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onEditKeyResult(kr.id)
                                          }}
                                          className="text-xs text-violet-600 hover:text-violet-700 hover:underline font-medium transition-colors"
                                          aria-label={`Edit all fields for key result: ${kr.title}`}
                                        >
                                          Edit all fields...
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Initiatives Section */}
                                  {(() => {
                                    const krInitiatives = initiatives.filter(init => init.keyResultId === kr.id)
                                    const groupedInitiatives = groupInitiativesByStatus(krInitiatives)
                                    const totalInitiatives = krInitiatives.length
                                    
                                    if (totalInitiatives === 0) {
                                      return (
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <h5 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600 flex items-center gap-2">
                                              <span className="w-1 h-4 bg-emerald-400 rounded-full"></span>
                                              Initiatives
                                            </h5>
                                            {onAddInitiativeToKr && canEditKeyResult && canEditKeyResult(kr.id) && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                onClick={() => onAddInitiativeToKr(kr.id)}
                                              >
                                                + Add Initiative
                                              </Button>
                                            )}
                                          </div>
                                          <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-3 text-center pl-3">
                                            <p className="text-[12px] text-neutral-600 mb-1">No initiatives yet</p>
                                            <p className="text-[10px] text-neutral-500">Initiatives are action items that support this key result</p>
                                          </div>
                                        </div>
                                      )
                                    }
                                    
                                    return (
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600 flex items-center gap-2">
                                            <span className="w-1 h-4 bg-emerald-400 rounded-full"></span>
                                            Initiatives ({totalInitiatives})
                                          </h5>
                                          {onAddInitiativeToKr && canEditKeyResult && canEditKeyResult(kr.id) && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                              onClick={() => onAddInitiativeToKr(kr.id)}
                                            >
                                              + Add Initiative
                                            </Button>
                                          )}
                                        </div>
                                        
                                        <div className="space-y-3 pl-3">
                                          {/* In Progress Initiatives */}
                                          {groupedInitiatives.IN_PROGRESS.length > 0 && (
                                            <div className="space-y-2">
                                              {groupedInitiatives.IN_PROGRESS.map((init) => {
                                                const isInitExpanded = expandedInitiatives.has(init.id)
                                                const initStatusBadge = getInitiativeStatusBadge(init.status)
                                                const dueDateInfo = formatDueDate(init.dueDate)
                                                const lastUpdated = formatLastUpdated(init.updatedAt)
                                                
                                                return (
                                                  <div
                                                    key={`init-${init.id}`}
                                                    className="rounded-lg border-l-2 border-emerald-400 border border-neutral-200 bg-emerald-50/40 hover:bg-emerald-50/60 transition-all"
                                                  >
                                                    <div
                                                      className="p-2.5 cursor-pointer"
                                                      onClick={() => handleToggleInitiative(init.id)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                          e.preventDefault()
                                                          handleToggleInitiative(init.id)
                                                        }
                                                      }}
                                                      role="button"
                                                      tabIndex={0}
                                                      aria-label={`${isInitExpanded ? 'Collapse' : 'Expand'} initiative: ${init.title}`}
                                                    >
                                                      <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                          <div className="flex items-center gap-2">
                                                            <div className="text-[12px] text-neutral-900 font-medium">
                                                              {init.title}
                                                            </div>
                                                            <OkrBadge tone={initStatusBadge.tone}>
                                                              {initStatusBadge.label}
                                                            </OkrBadge>
                                                          </div>
                                                          <div className="flex items-center gap-2 flex-wrap">
                                                            {dueDateInfo && (
                                                              <span className={cn(
                                                                "text-[11px]",
                                                                dueDateInfo.isOverdue ? "text-rose-600 font-medium" : "text-neutral-600"
                                                              )}>
                                                                {dueDateInfo.text}
                                                              </span>
                                                            )}
                                                            {lastUpdated && (
                                                              <span className="text-[10px] text-neutral-500">
                                                                Updated {lastUpdated}
                                                              </span>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <motion.div
                                                          animate={{ rotate: isInitExpanded ? 180 : 0 }}
                                                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                                          className="flex-shrink-0"
                                                        >
                                                          <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                                                        </motion.div>
                                                      </div>
                                                    </div>
                                                    
                                                    {/* Expanded Initiative Details */}
                                                    <AnimatePresence>
                                                      {isInitExpanded && (
                                                        <motion.div
                                                          initial={{ opacity: 0, height: 0 }}
                                                          animate={{ opacity: 1, height: 'auto' }}
                                                          exit={{ opacity: 0, height: 0 }}
                                                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                                          className="border-t border-emerald-100 bg-emerald-50/30 overflow-hidden"
                                                        >
                                                          <div className="p-3 pt-2 space-y-2">
                                                            {init.keyResultTitle && (
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-neutral-500">Supporting:</span>
                                                                <span className="text-[11px] text-violet-700 font-medium">
                                                                  {init.keyResultTitle}
                                                                </span>
                                                              </div>
                                                            )}
                                                            {init.description && (
                                                              <div>
                                                                <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Description</div>
                                                                <div className="text-[11px] text-neutral-700 whitespace-pre-wrap">{init.description}</div>
                                                              </div>
                                                            )}
                                                            {init.ownerId && availableUsers.length > 0 && (
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-neutral-500">Owner:</span>
                                                                <span className="text-[11px] text-neutral-700">
                                                                  {availableUsers.find(u => u.id === init.ownerId)?.name || 'Unknown'}
                                                                </span>
                                                              </div>
                                                            )}
                                                            {init.createdAt && (
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-neutral-500">Created:</span>
                                                                <span className="text-[11px] text-neutral-700">
                                                                  {formatLastUpdated(init.createdAt)}
                                                                </span>
                                                              </div>
                                                            )}
                                                            {/* Status Trend Chart */}
                                                            <div className="pt-2 border-t border-emerald-200">
                                                              <InitiativeStatusTrendChart initiativeId={init.id} />
                                                            </div>
                                                          </div>
                                                        </motion.div>
                                                      )}
                                                    </AnimatePresence>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                          
                                          {/* Blocked Initiatives */}
                                          {groupedInitiatives.BLOCKED.length > 0 && (
                                            <div className="space-y-2">
                                              {groupedInitiatives.BLOCKED.map((init) => {
                                                const isInitExpanded = expandedInitiatives.has(init.id)
                                                const initStatusBadge = getInitiativeStatusBadge(init.status)
                                                const dueDateInfo = formatDueDate(init.dueDate)
                                                const lastUpdated = formatLastUpdated(init.updatedAt)
                                                
                                                return (
                                                  <div
                                                    key={`init-${init.id}`}
                                                    className="rounded-lg border-l-2 border-rose-400 border border-neutral-200 bg-rose-50/40 hover:bg-rose-50/60 transition-all"
                                                  >
                                                    <div
                                                      className="p-2.5 cursor-pointer"
                                                      onClick={() => handleToggleInitiative(init.id)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                          e.preventDefault()
                                                          handleToggleInitiative(init.id)
                                                        }
                                                      }}
                                                      role="button"
                                                      tabIndex={0}
                                                      aria-label={`${isInitExpanded ? 'Collapse' : 'Expand'} initiative: ${init.title}`}
                                                    >
                                                      <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                          <div className="flex items-center gap-2">
                                                            <div className="text-[12px] text-neutral-900 font-medium">
                                                              {init.title}
                                                            </div>
                                                            <OkrBadge tone={initStatusBadge.tone}>
                                                              {initStatusBadge.label}
                                                            </OkrBadge>
                                                          </div>
                                                          <div className="flex items-center gap-2 flex-wrap">
                                                            {dueDateInfo && (
                                                              <span className={cn(
                                                                "text-[11px]",
                                                                dueDateInfo.isOverdue ? "text-rose-600 font-medium" : "text-neutral-600"
                                                              )}>
                                                                {dueDateInfo.text}
                                                              </span>
                                                            )}
                                                            {lastUpdated && (
                                                              <span className="text-[10px] text-neutral-500">
                                                                Updated {lastUpdated}
                                                              </span>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <motion.div
                                                          animate={{ rotate: isInitExpanded ? 180 : 0 }}
                                                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                                          className="flex-shrink-0"
                                                        >
                                                          <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                                                        </motion.div>
                                                      </div>
                                                    </div>
                                                    
                                                    <AnimatePresence>
                                                      {isInitExpanded && (
                                                        <motion.div
                                                          initial={{ opacity: 0, height: 0 }}
                                                          animate={{ opacity: 1, height: 'auto' }}
                                                          exit={{ opacity: 0, height: 0 }}
                                                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                                          className="border-t border-rose-100 bg-rose-50/30 overflow-hidden"
                                                        >
                                                          <div className="p-3 pt-2 space-y-2">
                                                            {init.description && (
                                                              <div>
                                                                <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Description</div>
                                                                <div className="text-[11px] text-neutral-700 whitespace-pre-wrap">{init.description}</div>
                                                              </div>
                                                            )}
                                                            {init.ownerId && availableUsers.length > 0 && (
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-neutral-500">Owner:</span>
                                                                <span className="text-[11px] text-neutral-700">
                                                                  {availableUsers.find(u => u.id === init.ownerId)?.name || 'Unknown'}
                                                                </span>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </motion.div>
                                                      )}
                                                    </AnimatePresence>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                          
                                          {/* Not Started Initiatives */}
                                          {groupedInitiatives.NOT_STARTED.length > 0 && (
                                            <div className="space-y-2">
                                              {groupedInitiatives.NOT_STARTED.map((init) => {
                                                const isInitExpanded = expandedInitiatives.has(init.id)
                                                const initStatusBadge = getInitiativeStatusBadge(init.status)
                                                const dueDateInfo = formatDueDate(init.dueDate)
                                                
                                                return (
                                                  <div
                                                    key={`init-${init.id}`}
                                                    className="rounded-lg border-l-2 border-amber-400 border border-neutral-200 bg-amber-50/40 hover:bg-amber-50/60 transition-all"
                                                  >
                                                    <div
                                                      className="p-2.5 cursor-pointer"
                                                      onClick={() => handleToggleInitiative(init.id)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                          e.preventDefault()
                                                          handleToggleInitiative(init.id)
                                                        }
                                                      }}
                                                      role="button"
                                                      tabIndex={0}
                                                      aria-label={`${isInitExpanded ? 'Collapse' : 'Expand'} initiative: ${init.title}`}
                                                    >
                                                      <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                          <div className="flex items-center gap-2">
                                                            <div className="text-[12px] text-neutral-900 font-medium">
                                                              {init.title}
                                                            </div>
                                                            <OkrBadge tone={initStatusBadge.tone}>
                                                              {initStatusBadge.label}
                                                            </OkrBadge>
                                                          </div>
                                                          {dueDateInfo && (
                                                            <span className={cn(
                                                              "text-[11px]",
                                                              dueDateInfo.isOverdue ? "text-rose-600 font-medium" : "text-neutral-600"
                                                            )}>
                                                              {dueDateInfo.text}
                                                            </span>
                                                          )}
                                                        </div>
                                                        <motion.div
                                                          animate={{ rotate: isInitExpanded ? 180 : 0 }}
                                                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                                          className="flex-shrink-0"
                                                        >
                                                          <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                                                        </motion.div>
                                                      </div>
                                                    </div>
                                                    
                                                    <AnimatePresence>
                                                      {isInitExpanded && (
                                                        <motion.div
                                                          initial={{ opacity: 0, height: 0 }}
                                                          animate={{ opacity: 1, height: 'auto' }}
                                                          exit={{ opacity: 0, height: 0 }}
                                                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                                          className="border-t border-amber-100 bg-amber-50/30 overflow-hidden"
                                                        >
                                                          <div className="p-3 pt-2 space-y-2">
                                                            {init.description && (
                                                              <div>
                                                                <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Description</div>
                                                                <div className="text-[11px] text-neutral-700 whitespace-pre-wrap">{init.description}</div>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </motion.div>
                                                      )}
                                                    </AnimatePresence>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                          
                                          {/* Completed Initiatives (collapsed by default, can expand) */}
                                          {groupedInitiatives.COMPLETED.length > 0 && (
                                            <details className="group">
                                              <summary className="cursor-pointer text-[11px] font-medium text-neutral-600 hover:text-neutral-900 mb-2 flex items-center gap-2">
                                                <ChevronDown className="h-3 w-3 text-neutral-400 group-open:rotate-180 transition-transform" />
                                                Completed ({groupedInitiatives.COMPLETED.length})
                                              </summary>
                                              <div className="mt-2 space-y-2">
                                                {groupedInitiatives.COMPLETED.map((init) => {
                                                  const isInitExpanded = expandedInitiatives.has(init.id)
                                                  const initStatusBadge = getInitiativeStatusBadge(init.status)
                                                  
                                                  return (
                                                    <div
                                                      key={`init-${init.id}`}
                                                      className="rounded-lg border-l-2 border-neutral-300 border border-neutral-200 bg-neutral-50/40 hover:bg-neutral-50/60 transition-all opacity-75"
                                                    >
                                                      <div
                                                        className="p-2.5 cursor-pointer"
                                                        onClick={() => handleToggleInitiative(init.id)}
                                                        onKeyDown={(e) => {
                                                          if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault()
                                                            handleToggleInitiative(init.id)
                                                          }
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <div className="text-[12px] text-neutral-700 font-medium line-through">
                                                            {init.title}
                                                          </div>
                                                          <OkrBadge tone={initStatusBadge.tone}>
                                                            {initStatusBadge.label}
                                                          </OkrBadge>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            </details>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  
                                  {/* Trend Charts */}
                                  <div className="pt-3 border-t border-neutral-200 space-y-3">
                                    <KeyResultTrendChart keyResultId={kr.id} />
                                    <KeyResultStatusTrendChart keyResultId={kr.id} />
                                  </div>
                                  
                                  {/* Actions Section */}
                                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                                    {onAddCheckIn && canCheckInOnKeyResult && canCheckInOnKeyResult(kr.id) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-3 text-[11px] font-medium"
                                        onClick={() => onAddCheckIn(kr.id)}
                                      >
                                        Check in
                                      </Button>
                                    )}
                                    {onAddCheckIn && canCheckInOnKeyResult && !canCheckInOnKeyResult(kr.id) && (
                                      <WhyCantIInspector
                                        action="check_in_kr"
                                        resource={{
                                          id: kr.id,
                                          parentObjective: objectiveForHook,
                                        }}
                                        className="text-[10px]"
                                      />
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/30 p-4 text-center">
                    <p className="text-[13px] text-neutral-700 mb-1 font-medium">No Key Results yet</p>
                    <p className="text-[11px] text-neutral-500 mb-3">Key Results define measurable outcomes that support this objective</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-medium"
                      onClick={() => onAddKeyResult(objective.id, objective.title)}
                    >
                      + Add Key Result
                    </Button>
                  </div>
                )}
            </div>

            {/* Initiatives block - only show initiatives NOT linked to any KR (directly linked to Objective) */}
            {(() => {
              const objectiveLevelInitiatives = initiatives.filter(init => !init.keyResultId)
              const groupedInitiatives = groupInitiativesByStatus(objectiveLevelInitiatives)
              const totalInitiatives = objectiveLevelInitiatives.length
              
              if (totalInitiatives === 0 && initiatives.length === 0) {
                return (
                  <div className="mt-4">
                    <h4 className="text-[13px] font-medium text-neutral-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-4 bg-emerald-400 rounded-full"></span>
                      Initiatives
                    </h4>
                    <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-4 text-center">
                      <p className="text-[13px] text-neutral-600 mb-1">No initiatives yet</p>
                      <p className="text-[11px] text-neutral-500 mb-2">Initiatives are action items that support your objectives</p>
                      {canCreateInitiative && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px] font-medium"
                          onClick={() => onAddInitiative(objective.id, objective.title)}
                        >
                          + Add Initiative
                        </Button>
                      )}
                    </div>
                  </div>
                )
              }
              
              if (totalInitiatives === 0) {
                return null
              }
              
              return (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[13px] font-medium text-neutral-700 flex items-center gap-2">
                      <span className="w-1 h-4 bg-emerald-400 rounded-full"></span>
                      Objective-Level Initiatives ({totalInitiatives})
                    </h4>
                    {canCreateInitiative && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => onAddInitiative(objective.id, objective.title)}
                      >
                        + Add Initiative
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {/* In Progress Initiatives */}
                    {groupedInitiatives.IN_PROGRESS.length > 0 && (
                      <div className="space-y-2">
                        {groupedInitiatives.IN_PROGRESS.map((init) => {
                          const isInitExpanded = expandedInitiatives.has(init.id)
                          const initStatusBadge = getInitiativeStatusBadge(init.status)
                          const dueDateInfo = formatDueDate(init.dueDate)
                          const lastUpdated = formatLastUpdated(init.updatedAt)
                          
                          return (
                            <div
                              key={`init-${init.id}`}
                              className="rounded-lg border-l-2 border-emerald-400 border border-neutral-200 bg-emerald-50/40 hover:bg-emerald-50/60 transition-all"
                            >
                              <div
                                className="p-3 cursor-pointer"
                                onClick={() => handleToggleInitiative(init.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    handleToggleInitiative(init.id)
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`${isInitExpanded ? 'Collapse' : 'Expand'} initiative: ${init.title}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="text-[13px] text-neutral-900 font-medium">
                                        {init.title}
                                      </div>
                                      <OkrBadge tone={initStatusBadge.tone}>
                                        {initStatusBadge.label}
                                      </OkrBadge>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {dueDateInfo && (
                                        <span className={cn(
                                          "text-[12px]",
                                          dueDateInfo.isOverdue ? "text-rose-600 font-medium" : "text-neutral-600"
                                        )}>
                                          {dueDateInfo.text}
                                        </span>
                                      )}
                                      {lastUpdated && (
                                        <span className="text-[11px] text-neutral-500">
                                          Updated {lastUpdated}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isInitExpanded ? 180 : 0 }}
                                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                    className="flex-shrink-0"
                                  >
                                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                                  </motion.div>
                                </div>
                              </div>
                              
                              <AnimatePresence>
                                {isInitExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="border-t border-emerald-100 bg-emerald-50/30 overflow-hidden"
                                  >
                                    <div className="p-3 pt-2 space-y-2">
                                      {init.description && (
                                        <div>
                                          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Description</div>
                                          <div className="text-[12px] text-neutral-700 whitespace-pre-wrap">{init.description}</div>
                                        </div>
                                      )}
                                      {init.ownerId && availableUsers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-neutral-500">Owner:</span>
                                          <span className="text-[12px] text-neutral-700">
                                            {availableUsers.find(u => u.id === init.ownerId)?.name || 'Unknown'}
                                          </span>
                                        </div>
                                      )}
                                      {init.createdAt && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-neutral-500">Created:</span>
                                          <span className="text-[12px] text-neutral-700">
                                            {formatLastUpdated(init.createdAt)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    {/* Blocked Initiatives */}
                    {groupedInitiatives.BLOCKED.length > 0 && (
                      <div className="space-y-2">
                        {groupedInitiatives.BLOCKED.map((init) => {
                          const isInitExpanded = expandedInitiatives.has(init.id)
                          const initStatusBadge = getInitiativeStatusBadge(init.status)
                          const dueDateInfo = formatDueDate(init.dueDate)
                          const lastUpdated = formatLastUpdated(init.updatedAt)
                          
                          return (
                            <div
                              key={`init-${init.id}`}
                              className="rounded-lg border-l-2 border-rose-400 border border-neutral-200 bg-rose-50/40 hover:bg-rose-50/60 transition-all"
                            >
                              <div
                                className="p-3 cursor-pointer"
                                onClick={() => handleToggleInitiative(init.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    handleToggleInitiative(init.id)
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`${isInitExpanded ? 'Collapse' : 'Expand'} initiative: ${init.title}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="text-[13px] text-neutral-900 font-medium">
                                        {init.title}
                                      </div>
                                      <OkrBadge tone={initStatusBadge.tone}>
                                        {initStatusBadge.label}
                                      </OkrBadge>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {dueDateInfo && (
                                        <span className={cn(
                                          "text-[12px]",
                                          dueDateInfo.isOverdue ? "text-rose-600 font-medium" : "text-neutral-600"
                                        )}>
                                          {dueDateInfo.text}
                                        </span>
                                      )}
                                      {lastUpdated && (
                                        <span className="text-[11px] text-neutral-500">
                                          Updated {lastUpdated}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isInitExpanded ? 180 : 0 }}
                                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                    className="flex-shrink-0"
                                  >
                                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                                  </motion.div>
                                </div>
                              </div>
                              
                              <AnimatePresence>
                                {isInitExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="border-t border-rose-100 bg-rose-50/30 overflow-hidden"
                                  >
                                    <div className="p-3 pt-2 space-y-2">
                                      {init.description && (
                                        <div>
                                          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Description</div>
                                          <div className="text-[12px] text-neutral-700 whitespace-pre-wrap">{init.description}</div>
                                        </div>
                                      )}
                                      {init.ownerId && availableUsers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-neutral-500">Owner:</span>
                                          <span className="text-[12px] text-neutral-700">
                                            {availableUsers.find(u => u.id === init.ownerId)?.name || 'Unknown'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    {/* Not Started Initiatives */}
                    {groupedInitiatives.NOT_STARTED.length > 0 && (
                      <div className="space-y-2">
                        {groupedInitiatives.NOT_STARTED.map((init) => {
                          const isInitExpanded = expandedInitiatives.has(init.id)
                          const initStatusBadge = getInitiativeStatusBadge(init.status)
                          const dueDateInfo = formatDueDate(init.dueDate)
                          
                          return (
                            <div
                              key={`init-${init.id}`}
                              className="rounded-lg border-l-2 border-amber-400 border border-neutral-200 bg-amber-50/40 hover:bg-amber-50/60 transition-all"
                            >
                              <div
                                className="p-3 cursor-pointer"
                                onClick={() => handleToggleInitiative(init.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    handleToggleInitiative(init.id)
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`${isInitExpanded ? 'Collapse' : 'Expand'} initiative: ${init.title}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="text-[13px] text-neutral-900 font-medium">
                                        {init.title}
                                      </div>
                                      <OkrBadge tone={initStatusBadge.tone}>
                                        {initStatusBadge.label}
                                      </OkrBadge>
                                    </div>
                                    {dueDateInfo && (
                                      <span className={cn(
                                        "text-[12px]",
                                        dueDateInfo.isOverdue ? "text-rose-600 font-medium" : "text-neutral-600"
                                      )}>
                                        {dueDateInfo.text}
                                      </span>
                                    )}
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isInitExpanded ? 180 : 0 }}
                                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                    className="flex-shrink-0"
                                  >
                                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                                  </motion.div>
                                </div>
                              </div>
                              
                              <AnimatePresence>
                                {isInitExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="border-t border-amber-100 bg-amber-50/30 overflow-hidden"
                                  >
                                    <div className="p-3 pt-2 space-y-2">
                                      {init.description && (
                                        <div>
                                          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Description</div>
                                          <div className="text-[12px] text-neutral-700 whitespace-pre-wrap">{init.description}</div>
                                        </div>
                                      )}
                                      {init.ownerId && availableUsers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-neutral-500">Owner:</span>
                                          <span className="text-[12px] text-neutral-700">
                                            {availableUsers.find(u => u.id === init.ownerId)?.name || 'Unknown'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    {/* Completed Initiatives */}
                    {groupedInitiatives.COMPLETED.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer text-[12px] font-medium text-neutral-600 hover:text-neutral-900 mb-2 flex items-center gap-2">
                          <ChevronDown className="h-3.5 w-3.5 text-neutral-400 group-open:rotate-180 transition-transform" />
                          Completed ({groupedInitiatives.COMPLETED.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {groupedInitiatives.COMPLETED.map((init) => {
                            const initStatusBadge = getInitiativeStatusBadge(init.status)
                            
                            return (
                              <div
                                key={`init-${init.id}`}
                                className="rounded-lg border-l-2 border-neutral-300 border border-neutral-200 bg-neutral-50/40 hover:bg-neutral-50/60 transition-all opacity-75"
                              >
                                <div className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="text-[13px] text-neutral-700 font-medium line-through">
                                      {init.title}
                                    </div>
                                    <OkrBadge tone={initStatusBadge.tone}>
                                      {initStatusBadge.label}
                                    </OkrBadge>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
