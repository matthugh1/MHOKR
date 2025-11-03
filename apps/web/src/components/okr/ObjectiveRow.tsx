"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { OkrBadge } from "./OkrBadge"
import { AvatarCircle } from "@/components/dashboard/AvatarCircle"
import { Edit2, Trash2, History, Plus, ChevronDown, ChevronUp, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { InlineInsightBar } from "./InlineInsightBar"
import { RbacWhyTooltip } from "@/components/rbac/RbacWhyTooltip"
import { InlineTitleEditor } from "./inline-editors/InlineTitleEditor"
import { InlineOwnerEditor } from "./inline-editors/InlineOwnerEditor"
import { InlineStatusEditor } from "./inline-editors/InlineStatusEditor"
import { InlineNumericEditor } from "./inline-editors/InlineNumericEditor"
import { useAuth } from "@/contexts/auth.context"
import { usePermissions } from "@/hooks/usePermissions"
import { useTenantPermissions } from "@/hooks/useTenantPermissions"
import { useWorkspace } from "@/contexts/workspace.context"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { mapErrorToMessage } from "@/lib/error-mapping"

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
    organizationId?: string | null
    workspaceId?: string | null
    teamId?: string | null
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
    }>
    initiatives?: Array<{
      id: string
      title: string
      status?: string
      dueDate?: string
      keyResultId?: string
      keyResultTitle?: string
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
  
  if (cycleStatus === "DRAFT") {
    return {
      text: cycleLabel,
      className: cn(baseClasses, "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300"),
      activeChip: null,
    }
  }
  if (cycleStatus === "ARCHIVED") {
    return {
      text: cycleLabel,
      className: cn(baseClasses, "bg-neutral-200 text-neutral-600"),
      activeChip: null,
    }
  }
  if (cycleStatus === "ACTIVE") {
    return {
      text: cycleLabel,
      className: cn(baseClasses, "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-300"),
      activeChip: { text: "Active", className: cn(baseClasses, "bg-emerald-500 text-white") },
    }
  }
  return {
    text: cycleLabel,
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
  const publishStateBadge = getPublishStateBadge(optimisticObjective.publishState, optimisticObjective.isPublished)
  const keyResults = optimisticObjective.keyResults || []
  const initiatives = optimisticObjective.initiatives || []
  const overdueCount = optimisticObjective.overdueCountForObjective ?? 0
  
  // Build objective context for permission checks
  const objectiveForHook = {
    id: optimisticObjective.id,
    ownerId: optimisticObjective.owner.id,
    organizationId: optimisticObjective.organizationId,
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
  
  // Mutation handlers
  const handleUpdateObjectiveTitle = async (newTitle: string) => {
    // Optimistic update
    setOptimisticObjective(prev => ({ ...prev, title: newTitle }))
    
    try {
      const response = await api.patch(`/objectives/${optimisticObjective.id}`, { title: newTitle })
      
      console.log('[Telemetry] okr.inline.save.success', {
        kind: 'objective',
        field: 'title',
        objectiveId: optimisticObjective.id,
        timestamp: new Date().toISOString(),
      })
      
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
      
      console.log('[Telemetry] okr.inline.save.error', {
        kind: 'objective',
        field: 'title',
        httpStatus: error.response?.status,
        objectiveId: optimisticObjective.id,
        timestamp: new Date().toISOString(),
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
      
      console.log('[Telemetry] okr.inline.save.success', {
        kind: 'objective',
        field: 'owner',
        objectiveId: optimisticObjective.id,
        timestamp: new Date().toISOString(),
      })
      
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
      
      console.log('[Telemetry] okr.inline.save.error', {
        kind: 'objective',
        field: 'owner',
        httpStatus: error.response?.status,
        objectiveId: optimisticObjective.id,
        timestamp: new Date().toISOString(),
      })
      
      throw error
    }
  }
  
  const handleUpdateObjectiveStatus = async (status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED') => {
    // Optimistic update
    setOptimisticObjective(prev => ({ ...prev, status }))
    
    try {
      const response = await api.patch(`/objectives/${optimisticObjective.id}`, { status })
      
      console.log('[Telemetry] okr.inline.save.success', {
        kind: 'objective',
        field: 'status',
        objectiveId: optimisticObjective.id,
        timestamp: new Date().toISOString(),
      })
      
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
      
      console.log('[Telemetry] okr.inline.save.error', {
        kind: 'objective',
        field: 'status',
        httpStatus: error.response?.status,
        objectiveId: optimisticObjective.id,
        timestamp: new Date().toISOString(),
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
      
      console.log('[Telemetry] okr.inline.save.success', {
        kind: 'kr',
        field: 'title',
        keyResultId: krId,
        timestamp: new Date().toISOString(),
      })
      
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
      
      console.log('[Telemetry] okr.inline.save.error', {
        kind: 'kr',
        field: 'title',
        httpStatus: error.response?.status,
        keyResultId: krId,
        timestamp: new Date().toISOString(),
      })
      
      throw error
    }
  }
  
  const handleUpdateKeyResultOwner = async (krId: string, userId: string) => {
    try {
      const response = await api.patch(`/key-results/${krId}`, { ownerId: userId })
      
      console.log('[Telemetry] okr.inline.save.success', {
        kind: 'kr',
        field: 'owner',
        keyResultId: krId,
        timestamp: new Date().toISOString(),
      })
      
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
      
      console.log('[Telemetry] okr.inline.save.error', {
        kind: 'kr',
        field: 'owner',
        httpStatus: error.response?.status,
        keyResultId: krId,
        timestamp: new Date().toISOString(),
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
      
      console.log('[Telemetry] okr.inline.save.success', {
        kind: 'kr',
        field: 'current',
        keyResultId: krId,
        timestamp: new Date().toISOString(),
      })
      
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
      
      console.log('[Telemetry] okr.inline.save.error', {
        kind: 'kr',
        field: 'current',
        httpStatus: error.response?.status,
        keyResultId: krId,
        timestamp: new Date().toISOString(),
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
      
      console.log('[Telemetry] okr.inline.save.success', {
        kind: 'kr',
        field: 'target',
        keyResultId: krId,
        timestamp: new Date().toISOString(),
      })
      
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
      
      console.log('[Telemetry] okr.inline.save.error', {
        kind: 'kr',
        field: 'target',
        httpStatus: error.response?.status,
        keyResultId: krId,
        timestamp: new Date().toISOString(),
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

  const progressBarColor = getProgressBarColor(objective.status)
  const cyclePill = getCyclePill(
    objective.cycleLabel || objective.cycleName || 'Unassigned',
    objective.cycleStatus || 'ACTIVE'
  )

  return (
    <section 
      className="border border-neutral-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200"
      aria-expanded={isExpanded}
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
          <div className="flex flex-col md:flex-row md:items-center gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            {/* Title - Inline Editor */}
            <div className="flex-1 min-w-0">
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
              
              {/* Publish State chip - Governance state */}
              <OkrBadge tone={publishStateBadge.tone}>
                {publishStateBadge.label}
              </OkrBadge>
              
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
              
              {/* Owner chip - Inline Editor */}
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

          {/* Middle block: Progress bar and micro-metrics (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* Progress bar */}
            <div className="flex-1 h-1 rounded-full bg-neutral-200 overflow-hidden" style={{ height: '4px' }}>
              <motion.div
                className={cn("h-full rounded-full", progressBarColor)}
                initial={false}
                animate={{ width: `${Math.min(100, Math.max(0, objective.progress))}%` }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              />
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
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Story 5: Contextual Add menu (replaces individual + KR and + Initiative buttons) */}
            {(canCreateKeyResult || canCreateInitiative) && (
              <div className="relative" ref={addMenuRef}>
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
            {!canCreateKeyResult && !canCreateInitiative && onAddKeyResult && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[12px] font-medium"
                onClick={() => onAddKeyResult(objective.id, objective.title)}
                aria-label="Add Key Result"
              >
                + KR
              </Button>
            )}
            
            {/* Fallback: Legacy + Initiative button (if contextual menu not available but onAddInitiative provided) */}
            {!canCreateKeyResult && !canCreateInitiative && onAddInitiative && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[12px] font-medium"
                onClick={() => onAddInitiative(objective.id, objective.title)}
                aria-label="Add Initiative"
              >
                + Initiative
              </Button>
            )}
            
            {/* Edit button */}
            {onEdit && (
              canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[12px] font-medium"
                  onClick={() => onEdit(objective.id)}
                  aria-label="Edit objective"
                >
                  Edit
                </Button>
              ) : (
                <RbacWhyTooltip
                  action="edit_okr"
                  resource={objective}
                  allowed={false}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[12px] font-medium opacity-50 cursor-not-allowed"
                    disabled
                    aria-label="Edit objective (not permitted)"
                  >
                    Edit
                  </Button>
                </RbacWhyTooltip>
              )
            )}
            
            {/* Menu button */}
            <div className="relative" ref={menuRef}>
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
                  {onDelete && (
                    canDelete ? (
                      <button
                        className="w-full px-3 py-2 text-left hover:bg-neutral-100 rounded-t-md text-rose-600"
                        onClick={() => {
                          onDelete(objective.id)
                          setMenuOpen(false)
                        }}
                      >
                        Delete Objective
                      </button>
                    ) : (
                      <RbacWhyTooltip
                        action="delete_okr"
                        resource={objective}
                        allowed={false}
                      >
                        <button
                          className="w-full px-3 py-2 text-left text-slate-400 opacity-50 cursor-not-allowed rounded-t-md"
                          disabled
                        >
                          Delete Objective
                        </button>
                      </RbacWhyTooltip>
                    )
                  )}
                  {onOpenHistory ? (
                    <button
                      className={`w-full px-3 py-2 text-left hover:bg-neutral-100 ${(onDelete !== undefined && canDelete) ? '' : 'rounded-t-md'} rounded-b-md`}
                      onClick={() => {
                        onOpenHistory()
                        setMenuOpen(false)
                      }}
                    >
                      View history
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            
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
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="overflow-hidden"
          >
            <div className="bg-neutral-50/80 border-t border-neutral-200 px-4 py-4 rounded-b-xl">
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
                      
                      return (
                        <div
                          key={kr.id}
                          className="rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-2 flex-1 min-w-0">
                              {/* Title - Inline Editor */}
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
                              
                              {/* Progress label with inline editors for current/target */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="text-[12px] text-neutral-600">
                                  {progressLabel}
                                </div>
                                {/* Inline editors for numeric values (only show if KR has numeric values) */}
                                {kr.currentValue !== undefined || kr.targetValue !== undefined ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {kr.currentValue !== undefined || kr.targetValue !== undefined ? (
                                      <>
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
                                      </>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              
                              {/* Owner - Inline Editor (if available) */}
                              {kr.ownerId && availableUsers.length > 0 && (
                                <div className="flex items-center gap-1.5">
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
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              {onAddCheckIn && canCheckInOnKeyResult && canCheckInOnKeyResult(kr.id) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] font-medium"
                                  onClick={() => onAddCheckIn(kr.id)}
                                >
                                  Check in
                                </Button>
                              )}
                              {onAddInitiativeToKr && canEditKeyResult && canEditKeyResult(kr.id) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] font-medium"
                                  onClick={() => onAddInitiativeToKr(kr.id)}
                                >
                                  + Initiative
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-4 text-center">
                    <p className="text-[13px] text-neutral-600 mb-2">No Key Results yet</p>
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

              {/* Initiatives block */}
              <div className="mt-4">
                <h4 className="text-[13px] font-medium text-neutral-700 mb-2">
                  Initiatives
                </h4>
                {initiatives.length > 0 ? (
                  <div className="space-y-3">
                    {initiatives.map((init) => {
                      const initStatusBadge = getInitiativeStatusBadge(init.status)
                      const dueDateInfo = formatDueDate(init.dueDate)
                      
                      return (
                        <div
                          key={init.id}
                          className="rounded-lg border border-neutral-200 bg-white p-3 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              {/* Title */}
                              <div className="text-[13px] text-neutral-900 font-medium">
                                {init.title}
                              </div>
                              
                              {/* Badges row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <OkrBadge tone={initStatusBadge.tone}>
                                  {initStatusBadge.label}
                                </OkrBadge>
                                {dueDateInfo && (
                                  <span className={cn(
                                    "text-[12px]",
                                    dueDateInfo.isOverdue ? "text-rose-600" : "text-neutral-600"
                                  )}>
                                    {dueDateInfo.text}
                                  </span>
                                )}
                              </div>
                              
                              {/* Linked KR indicator */}
                              {init.keyResultId && init.keyResultTitle && (
                                <div className="text-[12px] text-neutral-500">
                                  supports: {init.keyResultTitle}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-4 text-center">
                    <p className="text-[13px] text-neutral-600 mb-2">No initiatives yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-medium"
                      onClick={() => onAddInitiative(objective.id, objective.title)}
                    >
                      + New Initiative
                    </Button>
                  </div>
                )}
                
                {/* Always show + New Initiative button at the end */}
                {initiatives.length > 0 && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-medium"
                      onClick={() => onAddInitiative(objective.id, objective.title)}
                    >
                      + New Initiative
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
