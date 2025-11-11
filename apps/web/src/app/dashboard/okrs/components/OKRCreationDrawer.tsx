'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableUserSelect } from '@/components/okr/SearchableUserSelect'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { StandardCycleSelector } from '@/components/okr/StandardCycleSelector'
import { Badge } from '@/components/ui/badge'
import { TagSelector } from '@/components/okr/TagSelector'
import { ContributorSelector } from '@/components/okr/ContributorSelector'
import { SponsorSelector } from '@/components/okr/SponsorSelector'
import { trapFocus, returnFocus, getActiveElement } from '@/lib/focus-trap'
import { mapErrorToMessage } from '@/lib/error-mapping'
import { useUxTiming } from '@/hooks/useUxTiming'
import { DrawerFormSkeleton } from '@/components/ui/skeletons'

interface OKRCreationDrawerProps {
  isOpen: boolean
  mode?: 'objective' | 'kr' | 'initiative'
  onClose: () => void
  availableUsers: Array<{ id: string; name: string; email?: string }>
  activeCycles: Array<{ id: string; name: string; status: string }>
  currentOrganization: { id: string } | null
  onSuccess: () => void
  // Optional: preselect parent for KR or Initiative
  preselectedObjectiveId?: string | null
  preselectedKeyResultId?: string | null
  // Story 5: Parent context for contextual creation from row
  parentContext?: {
    type: 'objective' | 'kr'
    id: string
    title: string
  }
}

type Step = 'basics' | 'visibility' | 'key-results' | 'review'

  interface DraftObjective {
    title: string
    description: string
    ownerId: string
    cycleId: string
    parentId?: string
    pillarId?: string
    visibilityLevel: 'PUBLIC_TENANT' | 'PRIVATE' // W4.M1: EXEC_ONLY removed
    whitelist?: string[]
  }

interface DraftKeyResult {
  id: string
  title: string
  targetValue: number
  startValue: number
  metricType: 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'PERCENTAGE' | 'CUSTOM'
  unit: string
  ownerId: string
}

export function OKRCreationDrawer({
  isOpen,
  mode = 'objective',
  onClose,
  availableUsers,
  activeCycles,
  currentOrganization,
  onSuccess,
  preselectedObjectiveId = null,
  preselectedKeyResultId = null,
  parentContext,
}: OKRCreationDrawerProps) {
  const { user } = useAuth()
  const permissions = usePermissions()
  const { toast } = useToast()

  const [currentStep, setCurrentStep] = useState<Step>('basics')
  const [draftObjective, setDraftObjective] = useState<DraftObjective>({
    title: '',
    description: '',
    ownerId: user?.id || '',
    cycleId: activeCycles.length > 0 ? activeCycles[0].id : '',
    visibilityLevel: 'PUBLIC_TENANT',
  })
  const [draftKRs, setDraftKRs] = useState<DraftKeyResult[]>([])
  const [alignmentError, setAlignmentError] = useState<{ code?: string; message?: string } | null>(null)
  const [draftTags, setDraftTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [draftContributors, setDraftContributors] = useState<Array<{ id: string; user: { id: string; name: string; email?: string; avatar?: string | null }; role: string }>>([])
  const [draftSponsorId, setDraftSponsorId] = useState<string | null>(null)
  const [createdEntityId, setCreatedEntityId] = useState<string | null>(null)
  // Story 5: Determine parent from parentContext or preselectedObjectiveId
  const effectiveParentObjectiveId = useMemo(() => {
    if (mode === 'kr' && parentContext?.type === 'objective') {
      return parentContext.id
    }
    return preselectedObjectiveId || ''
  }, [mode, parentContext, preselectedObjectiveId])

  // Story 5: Determine parent for Initiative
  const effectiveParentForInitiative = useMemo(() => {
    if (mode === 'initiative') {
      if (parentContext?.type === 'objective') {
        return { objectiveId: parentContext.id, keyResultId: null }
      }
      if (parentContext?.type === 'kr') {
        return { objectiveId: null, keyResultId: parentContext.id }
      }
    }
    return { objectiveId: preselectedObjectiveId || null, keyResultId: preselectedKeyResultId || null }
  }, [mode, parentContext, preselectedObjectiveId, preselectedKeyResultId])

  // KR mode state
  const [krData, setKrData] = useState<{
    title: string
    objectiveId: string
    ownerId: string
    cycleId: string
    targetValue: number
    startValue: number
    unit: string
    metricType: 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'PERCENTAGE' | 'CUSTOM'
    weight?: number
  }>({
    title: '',
    objectiveId: effectiveParentObjectiveId,
    ownerId: user?.id || '',
    cycleId: activeCycles.length > 0 ? activeCycles[0].id : '',
    targetValue: 100,
    startValue: 0,
    unit: 'units',
    metricType: 'INCREASE',
    weight: 1.0,
  })
  // Initiative mode state
  const [initiativeData, setInitiativeData] = useState<{
    title: string
    objectiveId: string | null
    keyResultId: string | null
    ownerId: string
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
    dueDate: string
  }>({
    title: '',
    objectiveId: effectiveParentForInitiative.objectiveId,
    keyResultId: effectiveParentForInitiative.keyResultId,
    ownerId: user?.id || '',
    status: 'NOT_STARTED',
    dueDate: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const drawerOpenTimeRef = React.useRef<number | null>(null)
  const sheetContentRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [showSkeleton, setShowSkeleton] = useState(true)
  const publishTiming = useUxTiming('okr.create.publish')

  // Creation context (RBAC-aware options)
  const [allowedVisibilityLevels, setAllowedVisibilityLevels] = useState<string[]>(['PUBLIC_TENANT'])
  const [allowedOwners, setAllowedOwners] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [canAssignOthers, setCanAssignOthers] = useState(false)
  const [availableCyclesForCreation, setAvailableCyclesForCreation] = useState<Array<{ id: string; name: string; status: string }>>([])
  const [availablePillars, setAvailablePillars] = useState<Array<{ id: string; name: string; color: string | null }>>([])
  // Objectives and Key Results for parent selection (KR/Initiative modes)
  const [availableObjectives, setAvailableObjectives] = useState<Array<{ id: string; title: string }>>([])
  const [availableKeyResults, setAvailableKeyResults] = useState<Array<{ id: string; title: string; objectiveId: string }>>([])

  // Track drawer open time for telemetry
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = getActiveElement()
      drawerOpenTimeRef.current = Date.now()
      setShowSkeleton(true)
      
      // Hide skeleton after initial render
      setTimeout(() => setShowSkeleton(false), 50)
      
      // Track drawer opened
      console.log('[Telemetry] okr.create.open', {
        userId: user?.id,
        organizationId: currentOrganization?.id,
        timestamp: new Date().toISOString(),
      })
    } else {
      if (drawerOpenTimeRef.current) {
        const duration = Date.now() - drawerOpenTimeRef.current
        // Track drawer closed/abandoned (if not submitting)
        if (!isSubmitting) {
          console.log('[Telemetry] okr.create.abandon', {
            userId: user?.id,
            organizationId: currentOrganization?.id,
            duration,
            step: currentStep,
            timestamp: new Date().toISOString(),
          })
        }
        drawerOpenTimeRef.current = null
      }
      
      // Return focus to opener
      if (previousFocusRef.current) {
        returnFocus(previousFocusRef.current)
        previousFocusRef.current = null
      }
    }
  }, [isOpen, isSubmitting, currentStep, user?.id, currentOrganization?.id])

  // Focus trap when drawer opens
  useEffect(() => {
    if (isOpen && sheetContentRef.current) {
      const cleanup = trapFocus(sheetContentRef.current)
      return cleanup
    }
  }, [isOpen])

  // Handle Esc key
  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSubmitting) {
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, isSubmitting, onClose])

  // Track step changes
  useEffect(() => {
    if (isOpen && drawerOpenTimeRef.current) {
      console.log('[Telemetry] okr.create.step_viewed', {
        userId: user?.id,
        organizationId: currentOrganization?.id,
        step: currentStep,
        timestamp: new Date().toISOString(),
      })
    }
  }, [currentStep, isOpen, user?.id, currentOrganization?.id])

  // Fetch creation context when drawer opens
  useEffect(() => {
    if (isOpen && currentOrganization?.id) {
      api.get(`/okr/creation-context?tenantId=${currentOrganization.id}`)
        .then((res) => {
          setAllowedVisibilityLevels(res.data.allowedVisibilityLevels || ['PUBLIC_TENANT'])
          setAllowedOwners(res.data.allowedOwners || [])
          setCanAssignOthers(res.data.canAssignOthers || false)
          setAvailableCyclesForCreation(res.data.availableCycles || [])
          
          // Pre-fill owner if user cannot assign others
          if (!res.data.canAssignOthers && user?.id) {
            setDraftObjective((prev) => ({ ...prev, ownerId: user.id }))
          }
          
          // Note: Cycle selection is now handled by StandardCycleSelector component
          // No need to pre-fill cycle here
        })
        .catch((err) => {
          console.error('Failed to fetch creation context', err)
          // Fallback: use provided props
          setAllowedOwners(availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email || '' })))
          setAvailableCyclesForCreation(activeCycles)
        })

      // Load objectives for parent selection (objective mode) or KR/Initiative parent selection
      if (mode === 'objective' || mode === 'kr' || mode === 'initiative') {
        api.get(`/okr/overview?tenantId=${currentOrganization.id}&pageSize=50`)
          .then((res) => {
            const objectives = res.data?.objectives || []
            setAvailableObjectives(objectives.map((obj: any) => ({
              id: obj.id || obj.objectiveId,
              title: obj.title,
            })))
          })
          .catch((err) => {
            console.error('Failed to fetch objectives for parent selection', err)
          })
      }
    }
  }, [isOpen, currentOrganization?.id, user?.id, availableUsers, activeCycles, mode])


  // Story 5: Sync KR data when parentContext changes
  useEffect(() => {
    if (mode === 'kr' && effectiveParentObjectiveId) {
      setKrData(prev => ({
        ...prev,
        objectiveId: effectiveParentObjectiveId,
      }))
    }
  }, [mode, effectiveParentObjectiveId])

  // Story 5: Sync Initiative data when parentContext changes
  useEffect(() => {
    if (mode === 'initiative') {
      setInitiativeData(prev => ({
        ...prev,
        objectiveId: effectiveParentForInitiative.objectiveId,
        keyResultId: effectiveParentForInitiative.keyResultId,
      }))
    }
  }, [mode, effectiveParentForInitiative])

  // Reset form when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('basics')
      setDraftObjective({
        title: '',
        description: '',
        ownerId: user?.id || '',
        cycleId: activeCycles.length > 0 ? activeCycles[0].id : '',
        visibilityLevel: 'PUBLIC_TENANT',
      })
      setDraftKRs([])
      setKrData({
        title: '',
        objectiveId: effectiveParentObjectiveId,
        ownerId: user?.id || '',
        cycleId: activeCycles.length > 0 ? activeCycles[0].id : '',
        targetValue: 100,
        startValue: 0,
        unit: 'units',
        metricType: 'INCREASE',
      })
      setInitiativeData({
        title: '',
        objectiveId: effectiveParentForInitiative.objectiveId,
        keyResultId: effectiveParentForInitiative.keyResultId,
        ownerId: user?.id || '',
        status: 'NOT_STARTED',
        dueDate: '',
      })
      setDraftTags([])
      setDraftContributors([])
      setDraftSponsorId(null)
      setCreatedEntityId(null)
      setIsSubmitting(false)
    }
  }, [isOpen, user?.id, activeCycles, effectiveParentObjectiveId, effectiveParentForInitiative])

  // Validate Step A
  const canProceedFromBasics = () => {
    if (!draftObjective.title.trim()) return false
    if (!draftObjective.ownerId) return false
    if (!draftObjective.cycleId) return false

    // Cycle validation - cycle lock check will be handled when cycle is selected
    // Standard cycles are created on-demand, so we can't check status here
    // This validation passes as long as a cycleId is set

    return true
  }

  // Validate Step B
  const canProceedFromVisibility = () => {
    if (draftObjective.visibilityLevel === 'PRIVATE') {
      // If PRIVATE, whitelist should have at least owner
      return true // Owner is automatically included
    }
    return true
  }

  // Validate Step C
  const canProceedFromKeyResults = () => {
    return draftKRs.length >= 1 && draftKRs.every(kr => 
      kr.title.trim() && kr.ownerId && kr.targetValue !== undefined
    )
  }

  // Get cycle lock warning
  // Note: With StandardCycleSelector creating cycles on-demand, we can't check lock status here
  // Lock checks should be handled server-side when creating OKRs
  const getCycleLockWarning = () => {
    return null
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  const addKeyResult = () => {
    const newKR: DraftKeyResult = {
      id: `temp-${Date.now()}`,
      title: '',
      targetValue: 100,
      startValue: 0,
      metricType: 'INCREASE',
      unit: 'units',
      ownerId: draftObjective.ownerId, // Default to Objective owner
    }
    setDraftKRs([...draftKRs, newKR])
  }

  const removeKeyResult = (id: string) => {
    setDraftKRs(draftKRs.filter(kr => kr.id !== id))
  }

  const updateKeyResult = (id: string, updates: Partial<DraftKeyResult>) => {
    setDraftKRs(draftKRs.map(kr => kr.id === id ? { ...kr, ...updates } : kr))
  }

  const handleSaveDraft = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: 'Error',
        description: 'Organization not found.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Validate cycleId is set and is a valid format (not a route path)
      if (!draftObjective.cycleId || draftObjective.cycleId.includes('/') || draftObjective.cycleId.includes('get-or-create')) {
        toast({
          title: 'Validation Error',
          description: 'Please select a valid cycle (month, quarter, or year)',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      // Get cycle dates - try to fetch cycle details if not in local lists
      let selectedCycle = availableCyclesForCreation.find(c => c.id === draftObjective.cycleId) ||
        activeCycles.find(c => c.id === draftObjective.cycleId)
      
      // If cycle not found locally, fetch it (cycle was created on-demand)
      if (!selectedCycle && draftObjective.cycleId) {
        try {
          const cycleRes = await api.get(`/okr/cycles/${draftObjective.cycleId}`)
          selectedCycle = cycleRes.data
        } catch (error: any) {
          console.error('Failed to fetch cycle details:', error)
          // Continue with default dates if cycle fetch fails
        }
      }
      
      const startDate = selectedCycle && 'startDate' in selectedCycle && selectedCycle.startDate && typeof selectedCycle.startDate === 'string'
        ? new Date(selectedCycle.startDate).toISOString()
        : new Date().toISOString()
      
      const endDate = selectedCycle && 'endDate' in selectedCycle && selectedCycle.endDate && typeof selectedCycle.endDate === 'string'
        ? new Date(selectedCycle.endDate).toISOString()
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // Default 90 days

      // Create Objective as draft
      const objectiveRes = await api.post('/objectives', {
        title: draftObjective.title,
        description: draftObjective.description || undefined,
        ownerId: draftObjective.ownerId,
        cycleId: draftObjective.cycleId,
        tenantId: currentOrganization.id,
        visibilityLevel: draftObjective.visibilityLevel,
        parentId: draftObjective.parentId || undefined,
        pillarId: draftObjective.pillarId || undefined,
      // W4.M1: period removed - not sent to backend
      startDate,
      endDate,
      status: 'ON_TRACK',
      })
      
      const objectiveId = objectiveRes.data.id
      setCreatedEntityId(objectiveId)
      
      // Apply tags, contributors, and sponsor after creation
      if (mode === 'objective') {
        // Apply tags
        for (const tag of draftTags) {
          try {
            await api.post(`/objectives/${objectiveId}/tags`, { tagId: tag.id })
          } catch (error: any) {
            console.error('Failed to add tag after creation:', error)
            // Don't fail the whole operation
          }
        }
        
        // Apply contributors
        for (const contributor of draftContributors) {
          try {
            await api.post(`/objectives/${objectiveId}/contributors`, { userId: contributor.user.id })
          } catch (error: any) {
            console.error('Failed to add contributor after creation:', error)
            // Don't fail the whole operation
          }
        }
        
        // Apply sponsor
        if (draftSponsorId) {
          try {
            await api.patch(`/objectives/${objectiveId}/sponsor`, { sponsorId: draftSponsorId })
          } catch (error: any) {
            console.error('Failed to set sponsor after creation:', error)
            // Don't fail the whole operation
          }
        }
      }
      
      // Create Key Results sequentially
      for (const kr of draftKRs) {
        await api.post('/key-results', {
          title: kr.title,
          objectiveId: objectiveId,
          ownerId: kr.ownerId,
          targetValue: kr.targetValue,
          startValue: kr.startValue,
          metricType: kr.metricType,
          unit: kr.unit,
          tenantId: currentOrganization.id,
        })
      }
      
      toast({
        title: 'Draft saved',
        description: 'Your OKR has been saved as a draft. You can publish it later.',
      })
      
      // Track draft saved
      if (drawerOpenTimeRef.current) {
        const duration = Date.now() - drawerOpenTimeRef.current
        console.log('[Telemetry] okr_draft_saved', {
          userId: user?.id,
          organizationId: currentOrganization?.id,
          duration,
          krCount: draftKRs.length,
          timestamp: new Date().toISOString(),
        })
      }
      
      onSuccess()
    } catch (err: any) {
      console.error('Failed to save draft', err)
      
      // Extract alignment error codes for inline display
      const errorCode = err.response?.data?.code
      const errorMessage = err.response?.data?.message
      if (errorCode === 'ALIGNMENT_DATE_OUT_OF_RANGE' || errorCode === 'ALIGNMENT_CYCLE_MISMATCH') {
        setAlignmentError({ code: errorCode, message: errorMessage })
      } else {
        setAlignmentError(null)
        toast({
          title: 'Failed to save draft',
          description: err.response?.data?.message || 'Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePublish = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: 'Error',
        description: 'Organization not found.',
        variant: 'destructive',
      })
      return
    }

    if (draftKRs.length === 0) {
      toast({
        title: 'Key Results required',
        description: 'Please add at least one Key Result before publishing.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    publishTiming.start()
    
    try {
      // W5.M1: Use composite endpoint for atomic creation
      const payload = {
        objective: {
          title: draftObjective.title,
          description: draftObjective.description || undefined,
          ownerUserId: draftObjective.ownerId,
          cycleId: draftObjective.cycleId,
          visibilityLevel: draftObjective.visibilityLevel as 'PUBLIC_TENANT' | 'PRIVATE',
          whitelistUserIds: draftObjective.visibilityLevel === 'PRIVATE' 
            ? (draftObjective.whitelist || [])
            : undefined,
          parentId: draftObjective.parentId || undefined,
          pillarId: draftObjective.pillarId || undefined,
        },
        keyResults: draftKRs.map(kr => ({
          title: kr.title,
          metricType: kr.metricType as 'NUMERIC' | 'PERCENT' | 'BOOLEAN' | 'CUSTOM',
          targetValue: kr.targetValue,
          ownerUserId: kr.ownerId,
          startValue: kr.startValue,
          unit: kr.unit,
        })),
      }

      console.log('[OKR CREATION] Creating OKR via composite endpoint:', payload)
      
      const response = await api.post('/okr/create-composite', payload)
      
      console.log('[OKR CREATION] OKR created successfully:', response.data)
      
      const objectiveId = response.data.objectiveId
      setCreatedEntityId(objectiveId)
      
      // Apply tags, contributors, and sponsor after publish
      if (objectiveId) {
        // Apply tags
        for (const tag of draftTags) {
          try {
            await api.post(`/objectives/${objectiveId}/tags`, { tagId: tag.id })
          } catch (error: any) {
            console.error('Failed to add tag after publish:', error)
            // Don't fail the whole operation
          }
        }
        
        // Apply contributors
        for (const contributor of draftContributors) {
          try {
            await api.post(`/objectives/${objectiveId}/contributors`, { userId: contributor.user.id })
          } catch (error: any) {
            console.error('Failed to add contributor after publish:', error)
            // Don't fail the whole operation
          }
        }
        
        // Apply sponsor
        if (draftSponsorId) {
          try {
            await api.patch(`/objectives/${objectiveId}/sponsor`, { sponsorId: draftSponsorId })
          } catch (error: any) {
            console.error('Failed to set sponsor after publish:', error)
            // Don't fail the whole operation
          }
        }
      }
      
      const publishDurationMs = publishTiming.end()
      
      toast({
        title: 'OKR published successfully',
        description: `"${draftObjective.title}" has been published with ${draftKRs.length} key result${draftKRs.length !== 1 ? 's' : ''}.`,
      })
      
      // Track publish success
      const totalDuration = drawerOpenTimeRef.current ? Date.now() - drawerOpenTimeRef.current : null
      console.log('[Telemetry] okr.create.publish.success', {
        userId: user?.id,
        organizationId: currentOrganization?.id,
        publishDurationMs,
        totalDuration,
        krCount: draftKRs.length,
        objectiveId: objectiveId,
        timestamp: new Date().toISOString(),
      })
      
      onSuccess()
    } catch (err: any) {
      console.error('Failed to publish OKR', err)
      
      // Extract alignment error codes for inline display
      const errorCode = err.response?.data?.code
      const errorMessage = err.response?.data?.message
      if (errorCode === 'ALIGNMENT_DATE_OUT_OF_RANGE' || errorCode === 'ALIGNMENT_CYCLE_MISMATCH') {
        setAlignmentError({ code: errorCode, message: errorMessage })
      } else {
        setAlignmentError(null)
      }
      
      const errorInfo = mapErrorToMessage(err)
      
      // Track publish failure
      const publishDurationMs = publishTiming.end()
      const categorizeError = (error: any): string => {
        if (error.response?.status === 403) return 'permission_denied'
        if (error.response?.status === 400) return 'validation_error'
        if (error.response?.status === 404) return 'not_found'
        if (error.response?.status === 429) return 'rate_limit'
        return 'unknown_error'
      }
      
      const errorReason = categorizeError(err)
      
      console.log('[Telemetry] okr.create.publish.forbidden', {
        userId: user?.id,
        organizationId: currentOrganization?.id,
        error: err.response?.data?.message,
        reason: errorReason,
        publishDurationMs,
        timestamp: new Date().toISOString(),
      })
      
      // Only show toast for non-alignment errors (alignment errors shown inline)
      if (errorCode !== 'ALIGNMENT_DATE_OUT_OF_RANGE' && errorCode !== 'ALIGNMENT_CYCLE_MISMATCH') {
        toast({
          title: errorInfo.variant === 'warning' ? 'Cannot publish' : 'Failed to publish OKR',
          description: errorInfo.message,
          variant: errorInfo.variant === 'warning' ? 'default' : (errorInfo.variant || 'destructive'),
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepA = () => {
    const cycleWarning = getCycleLockWarning()
    const usersForOwner = allowedOwners.length > 0 ? allowedOwners : availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email || '' }))
    const cyclesForSelection = availableCyclesForCreation.length > 0 ? availableCyclesForCreation : activeCycles

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">
            Objective Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={draftObjective.title}
            onChange={(e) => setDraftObjective((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Enter objective title"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">Required. Maximum 200 characters.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Description / Intent
          </Label>
          <Textarea
            id="description"
            value={draftObjective.description}
            onChange={(e) => setDraftObjective((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what you're trying to achieve and why"
            rows={4}
            maxLength={5000}
          />
          <p className="text-xs text-muted-foreground">Optional but encouraged. Maximum 5000 characters.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner">
            Owner <span className="text-red-500">*</span>
          </Label>
          <SearchableUserSelect
            value={draftObjective.ownerId}
            onValueChange={(value) => setDraftObjective((prev) => ({ ...prev, ownerId: value }))}
            availableUsers={usersForOwner}
            placeholder="Select owner"
            disabled={!canAssignOthers}
            id="owner"
            required
          />
          {!canAssignOthers && (
            <p className="text-xs text-muted-foreground">You can only assign yourself as owner.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cycle">
            Cycle <span className="text-red-500">*</span>
          </Label>
          <StandardCycleSelector
            value={draftObjective.cycleId}
            onValueChange={(cycleId) => {
              setDraftObjective((prev) => ({ ...prev, cycleId }))
              // Clear alignment error when cycle changes
              if (alignmentError?.code === 'ALIGNMENT_CYCLE_MISMATCH') {
                setAlignmentError(null)
              }
            }}
            currentOrganizationId={currentOrganization?.id}
            disabled={isSubmitting}
          />
          {cycleWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{cycleWarning}</p>
            </div>
          )}
          {alignmentError?.code === 'ALIGNMENT_CYCLE_MISMATCH' && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{alignmentError.message || 'Cycle must match the parent objective cycle.'}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent">
            Alignment / Parent (Optional)
          </Label>
          <Select
            value={draftObjective.parentId || '__none__'}
            onValueChange={(value: string) => {
              setDraftObjective((prev) => ({ ...prev, parentId: value === '__none__' ? undefined : value }))
              // Clear alignment errors when parent changes
              setAlignmentError(null)
            }}
          >
            <SelectTrigger id="parent">
              <SelectValue placeholder="None (top-level objective)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (top-level objective)</SelectItem>
              {availableObjectives.map((obj) => (
                <SelectItem key={obj.id} value={obj.id}>
                  {obj.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Link this objective to a parent objective to create a hierarchy.</p>
          {alignmentError?.code === 'ALIGNMENT_DATE_OUT_OF_RANGE' && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{alignmentError.message || 'Dates must be within the parent objective\'s date range.'}</p>
            </div>
          )}
        </div>

        {/* Tags, Contributors, and Sponsor for Objectives */}
        {mode === 'objective' && (
          <>
            <div className="space-y-2">
              <Label>Tags</Label>
              {createdEntityId ? (
                <TagSelector
                  entityType="objective"
                  entityId={createdEntityId}
                  selectedTags={draftTags}
                  onTagsChange={setDraftTags}
                  currentOrganizationId={currentOrganization?.id || null}
                  canEdit={true}
                  disabled={isSubmitting}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Tags can be added after the objective is created.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Contributors</Label>
              {createdEntityId ? (
                <ContributorSelector
                  entityType="objective"
                  entityId={createdEntityId}
                  selectedContributors={draftContributors}
                  onContributorsChange={setDraftContributors}
                  availableUsers={availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email, avatar: null }))}
                  currentOrganizationId={currentOrganization?.id || null}
                  canEdit={true}
                  disabled={isSubmitting}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Contributors can be added after the objective is created.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Sponsor</Label>
              {createdEntityId ? (
                <SponsorSelector
                  objectiveId={createdEntityId}
                  sponsorId={draftSponsorId}
                  onSponsorChange={setDraftSponsorId}
                  availableUsers={availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email }))}
                  currentOrganizationId={currentOrganization?.id || null}
                  canEdit={true}
                  disabled={isSubmitting}
                />
              ) : (
                <SearchableUserSelect
                  value={draftSponsorId || ''}
                  onValueChange={(value: string) => setDraftSponsorId(value || null)}
                  availableUsers={availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email }))}
                  placeholder="Select sponsor (optional)"
                  disabled={isSubmitting}
                />
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  const renderStepB = () => {
    const usersForWhitelist = allowedOwners.length > 0 ? allowedOwners : availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email || '' }))
    const whitelist = draftObjective.whitelist || []

    const getVisibilityPreview = () => {
      switch (draftObjective.visibilityLevel) {
        case 'PUBLIC_TENANT':
          return 'All users in your organization'
        case 'PRIVATE':
          return `Only you, tenant admins${whitelist.length > 0 ? `, and ${whitelist.length} selected user${whitelist.length !== 1 ? 's' : ''}` : ''}`
        default:
          return ''
      }
    }

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="visibility">
            Visibility Level <span className="text-red-500">*</span>
          </Label>
          <Select
            value={draftObjective.visibilityLevel}
            onValueChange={(value: 'PUBLIC_TENANT' | 'PRIVATE') => 
              setDraftObjective((prev) => ({ ...prev, visibilityLevel: value, whitelist: value === 'PUBLIC_TENANT' ? undefined : prev.whitelist }))
            }
          >
            <SelectTrigger id="visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedVisibilityLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  {level === 'PUBLIC_TENANT' && 'Public (Tenant)'}
                  {level === 'PRIVATE' && 'Private'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{getVisibilityPreview()}</p>
        </div>

        {draftObjective.visibilityLevel === 'PRIVATE' && (
          <div className="space-y-2">
            <Label>
              Whitelist Users (Optional)
            </Label>
            <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
              {usersForWhitelist
                .filter(u => u.id !== draftObjective.ownerId) // Don't show owner (they're automatically included)
                .map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`whitelist-${u.id}`}
                      checked={whitelist.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDraftObjective((prev) => ({
                            ...prev,
                            whitelist: [...(prev.whitelist || []), u.id],
                          }))
                        } else {
                          setDraftObjective((prev) => ({
                            ...prev,
                            whitelist: (prev.whitelist || []).filter(id => id !== u.id),
                          }))
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor={`whitelist-${u.id}`} className="cursor-pointer flex-1">
                      {u.name || u.email || u.id}
                    </Label>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">Select users who can view this OKR.</p>
          </div>
        )}
      </div>
    )
  }

  const renderStepC = () => {
    const usersForKROwner = allowedOwners.length > 0 ? allowedOwners : availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email || '' }))

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Label>Key Results</Label>
          <Button type="button" variant="outline" size="sm" onClick={addKeyResult}>
            <Plus className="h-4 w-4 mr-1" />
            Add Key Result
          </Button>
        </div>

        {draftKRs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border rounded-md">
            <p>No key results yet. Add at least one key result to measure progress.</p>
          </div>
        )}

        {draftKRs.map((kr, index) => (
          <div key={kr.id} className="border rounded-lg p-4 space-y-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Key Result {index + 1}</Badge>
              {draftKRs.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeKeyResult(kr.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`kr-title-${kr.id}`}>
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id={`kr-title-${kr.id}`}
                value={kr.title}
                onChange={(e) => updateKeyResult(kr.id, { title: e.target.value })}
                placeholder="Enter key result title"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`kr-start-${kr.id}`}>Start Value</Label>
                <Input
                  id={`kr-start-${kr.id}`}
                  type="number"
                  value={kr.startValue}
                  onChange={(e) => updateKeyResult(kr.id, { startValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`kr-target-${kr.id}`}>
                  Target Value <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`kr-target-${kr.id}`}
                  type="number"
                  value={kr.targetValue}
                  onChange={(e) => updateKeyResult(kr.id, { targetValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`kr-metric-${kr.id}`}>Metric Type</Label>
                <Select
                  value={kr.metricType}
                  onValueChange={(value: DraftKeyResult['metricType']) => updateKeyResult(kr.id, { metricType: value })}
                >
                  <SelectTrigger id={`kr-metric-${kr.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCREASE">Increase</SelectItem>
                    <SelectItem value="DECREASE">Decrease</SelectItem>
                    <SelectItem value="MAINTAIN">Maintain</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`kr-unit-${kr.id}`}>Unit</Label>
                <Input
                  id={`kr-unit-${kr.id}`}
                  value={kr.unit}
                  onChange={(e) => updateKeyResult(kr.id, { unit: e.target.value })}
                  placeholder="e.g., users, hours, %"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`kr-owner-${kr.id}`}>
                KR Owner <span className="text-red-500">*</span>
              </Label>
              <SearchableUserSelect
                value={kr.ownerId}
                onValueChange={(value) => updateKeyResult(kr.id, { ownerId: value })}
                availableUsers={usersForKROwner}
                placeholder="Select owner"
                disabled={!canAssignOthers}
                id={`kr-owner-${kr.id}`}
                required
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderStepD = () => {
    const selectedCycle = availableCyclesForCreation.find(c => c.id === draftObjective.cycleId) ||
      activeCycles.find(c => c.id === draftObjective.cycleId)
    const owner = allowedOwners.find(u => u.id === draftObjective.ownerId) ||
      availableUsers.find(u => u.id === draftObjective.ownerId)

    const cycleWarning = getCycleLockWarning()
    const isSuperuser = user && permissions.isSuperuser

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Objective Summary</h3>
            <div className="bg-slate-50 rounded-md p-4 space-y-2">
              <div><strong>Title:</strong> {draftObjective.title}</div>
              {draftObjective.description && (
                <div><strong>Description:</strong> {draftObjective.description}</div>
              )}
              <div><strong>Owner:</strong> {owner?.name || owner?.email || 'Unassigned'}</div>
              <div>
                <strong>Cycle:</strong> {selectedCycle?.name || 'Unknown'}
                {selectedCycle?.status && selectedCycle.status !== 'ACTIVE' && selectedCycle.status !== 'DRAFT' && (
                  <Badge variant="secondary" className="ml-2">{selectedCycle.status}</Badge>
                )}
              </div>
              {draftObjective.parentId && (
                <div>
                  <strong>Parent Objective:</strong> {availableObjectives.find(obj => obj.id === draftObjective.parentId)?.title || 'Unknown'}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Visibility Summary</h3>
            <div className="bg-slate-50 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge>
                  {draftObjective.visibilityLevel === 'PUBLIC_TENANT' && 'Public (Tenant)'}
                  {draftObjective.visibilityLevel === 'PRIVATE' && 'Private'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {draftObjective.visibilityLevel === 'PUBLIC_TENANT' && 'All users in your organization'}
                {draftObjective.visibilityLevel === 'PRIVATE' && (
                  `Only you, tenant admins${(draftObjective.whitelist?.length || 0) > 0 ? `, and ${draftObjective.whitelist?.length} selected user${draftObjective.whitelist?.length !== 1 ? 's' : ''}` : ''}`
                )}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Key Results Summary</h3>
            <div className="bg-slate-50 rounded-md p-4">
              <div className="mb-2">
                <strong>{draftKRs.length} Key Result{draftKRs.length !== 1 ? 's' : ''}</strong>
              </div>
              <ul className="space-y-1 text-sm">
                {draftKRs.map((kr, idx) => (
                  <li key={kr.id}>{idx + 1}. {kr.title || 'Untitled'}</li>
                ))}
              </ul>
            </div>
          </div>

          {(cycleWarning || isSuperuser) && (
            <div>
              <h3 className="font-semibold mb-2">Governance Warnings</h3>
              <div className="space-y-2">
                {cycleWarning && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>{cycleWarning}</p>
                  </div>
                )}
                {isSuperuser && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>SUPERUSER accounts are read-only. This action will be blocked.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Key Result submit handler
  const canSubmitKR = () => {
    // Story 5: Check parentContext.id if available, otherwise use krData.objectiveId
    const objectiveIdToCheck = (mode === 'kr' && parentContext?.type === 'objective')
      ? parentContext.id
      : krData.objectiveId
    
    return krData.title.trim() !== '' && 
           objectiveIdToCheck !== '' && 
           krData.ownerId !== '' &&
           krData.cycleId !== ''
  }

  const handleSubmitKR = async () => {
      if (!currentOrganization?.id || !canSubmitKR()) return

      setIsSubmitting(true)
      try {
        // Story 5: Use parentContext.id if available, otherwise use krData.objectiveId
        const objectiveIdToUse = (mode === 'kr' && parentContext?.type === 'objective') 
          ? parentContext.id 
          : krData.objectiveId
        
        const response = await api.post('/key-results', {
          title: krData.title,
          objectiveId: objectiveIdToUse,
          ownerId: krData.ownerId,
          cycleId: krData.cycleId,
          targetValue: krData.targetValue,
          startValue: krData.startValue,
          unit: krData.unit,
          metricType: krData.metricType,
          tenantId: currentOrganization?.id,
        })

        // Update weight if it's not the default (1.0) and KR is linked to an Objective
        const weightToSet = krData.weight ?? 1.0
        if (objectiveIdToUse && weightToSet !== 1.0) {
          try {
            await api.patch(`/objectives/${objectiveIdToUse}/key-results/${response.data.id}/weight`, {
              weight: weightToSet,
            })
          } catch (weightError: any) {
            console.error('Failed to set weight after KR creation:', weightError)
            // Don't fail the whole creation - weight can be set later
            toast({
              title: 'Key Result created',
              description: `"${krData.title}" was created, but weight update failed. You can set it later.`,
              variant: 'default',
            })
            onSuccess()
            return
          }
        }

        toast({
          title: 'Key Result created',
          description: `"${krData.title}" has been created successfully.`,
        })

        console.log('[Telemetry] okr.create.key_result.success', {
          userId: user?.id,
          organizationId: currentOrganization?.id,
          keyResultId: response.data.id,
          timestamp: new Date().toISOString(),
        })

        onSuccess()
      } catch (err: any) {
        console.error('Failed to create key result', err)
        
        if (err.response?.status === 403) {
          console.log('[Telemetry] okr.create.kr.forbidden', {
            userId: user?.id,
            organizationId: currentOrganization?.id,
            timestamp: new Date().toISOString(),
          })
        }

        toast({
          title: 'Failed to create Key Result',
          description: err.response?.data?.message || 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsSubmitting(false)
      }
  }

  // Render Key Result form (mode === 'kr')
  const renderKeyResultForm = () => {
    const usersForOwner = allowedOwners.length > 0 ? allowedOwners : availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email || '' }))
    const cyclesForSelection = availableCyclesForCreation.length > 0 ? availableCyclesForCreation : activeCycles

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="kr-title">
            Key Result Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="kr-title"
            value={krData.title}
            onChange={(e) => setKrData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter key result title"
            maxLength={200}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kr-objective">
            Parent Objective <span className="text-red-500">*</span>
          </Label>
          {/* Story 5: If parentContext provided, show disabled input with parent title */}
          {parentContext && parentContext.type === 'objective' ? (
            <>
              <Input
                id="kr-objective"
                value={parentContext.title}
                disabled
                readOnly
                className="cursor-not-allowed bg-neutral-50"
                aria-label={`Parent objective: ${parentContext.title}`}
              />
              <p className="text-xs text-muted-foreground">Parent objective is pre-selected from row context.</p>
            </>
          ) : (
            <>
              <Select
                value={krData.objectiveId}
                onValueChange={(value: string) => setKrData(prev => ({ ...prev, objectiveId: value }))}
              >
                <SelectTrigger id="kr-objective">
                  <SelectValue placeholder="Select objective" />
                </SelectTrigger>
                <SelectContent>
                  {availableObjectives.map((obj) => (
                    <SelectItem key={obj.id} value={obj.id}>
                      {obj.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select the objective this key result measures.</p>
            </>
          )}
        </div>

        {/* Weight input - only show when parent Objective is selected */}
        {(krData.objectiveId || (parentContext && parentContext.type === 'objective')) && (
          <div className="space-y-2">
            <Label htmlFor="kr-weight">
              Weight
            </Label>
            <Input
              id="kr-weight"
              type="number"
              min="0"
              max="3"
              step="0.1"
              value={krData.weight ?? 1.0}
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                setKrData(prev => ({ ...prev, weight: isNaN(value) ? 1.0 : value }))
              }}
              aria-label={`Weight for ${krData.title || 'this key result'}`}
            />
            <p className="text-xs text-muted-foreground">
              Influence of this KR on objective progress (0.0–3.0). Default 1.0.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="kr-owner">
            Owner <span className="text-red-500">*</span>
          </Label>
          <SearchableUserSelect
            value={krData.ownerId}
            onValueChange={(value) => setKrData(prev => ({ ...prev, ownerId: value }))}
            availableUsers={usersForOwner}
            placeholder="Select owner"
            disabled={!canAssignOthers}
            id="kr-owner"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kr-cycle">
            Cycle <span className="text-red-500">*</span>
          </Label>
          <Select
            value={krData.cycleId}
            onValueChange={(value: string) => setKrData(prev => ({ ...prev, cycleId: value }))}
          >
            <SelectTrigger id="kr-cycle">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {cyclesForSelection.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  {cycle.name} {cycle.status !== 'ACTIVE' && cycle.status !== 'DRAFT' ? `(${cycle.status})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="kr-start">Start Value</Label>
            <Input
              id="kr-start"
              type="number"
              value={krData.startValue}
              onChange={(e) => setKrData(prev => ({ ...prev, startValue: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kr-target">
              Target Value <span className="text-red-500">*</span>
            </Label>
            <Input
              id="kr-target"
              type="number"
              value={krData.targetValue}
              onChange={(e) => setKrData(prev => ({ ...prev, targetValue: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="kr-metric">Metric Type</Label>
            <Select
              value={krData.metricType}
              onValueChange={(value: typeof krData.metricType) => setKrData(prev => ({ ...prev, metricType: value }))}
            >
              <SelectTrigger id="kr-metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INCREASE">Increase</SelectItem>
                <SelectItem value="DECREASE">Decrease</SelectItem>
                <SelectItem value="MAINTAIN">Maintain</SelectItem>
                <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kr-unit">Unit</Label>
            <Input
              id="kr-unit"
              value={krData.unit}
              onChange={(e) => setKrData(prev => ({ ...prev, unit: e.target.value }))}
              placeholder="e.g., users, hours, %"
            />
          </div>
        </div>
      </div>
    )
  }

  // Initiative submit handler
  const canSubmitInitiative = () => {
    // Story 5: Check parentContext.id if available, otherwise use initiativeData
    const hasParent = (mode === 'initiative' && parentContext) ||
      (initiativeData.objectiveId !== null || initiativeData.keyResultId !== null)
    
    return initiativeData.title.trim() !== '' && 
           initiativeData.ownerId !== '' &&
           hasParent
  }

  const handleSubmitInitiative = async () => {
      if (!currentOrganization?.id || !canSubmitInitiative()) return

      setIsSubmitting(true)
      try {
        // Story 5: Use parentContext.id if available, otherwise use initiativeData
        const objectiveIdToUse = (mode === 'initiative' && parentContext?.type === 'objective')
          ? parentContext.id
          : initiativeData.objectiveId
        const keyResultIdToUse = (mode === 'initiative' && parentContext?.type === 'kr')
          ? parentContext.id
          : initiativeData.keyResultId
        
        const payload: any = {
          title: initiativeData.title,
          ownerId: initiativeData.ownerId,
          status: initiativeData.status,
          tenantId: currentOrganization?.id,
        }
        if (objectiveIdToUse) payload.objectiveId = objectiveIdToUse
        if (keyResultIdToUse) payload.keyResultId = keyResultIdToUse
        if (initiativeData.dueDate) {
          // Convert date string to ISO-8601 DateTime format
          // If it's already a full ISO string, use it; otherwise convert date-only to ISO DateTime
          if (typeof initiativeData.dueDate === 'string' && initiativeData.dueDate.includes('T')) {
            payload.dueDate = initiativeData.dueDate
          } else {
            // Convert YYYY-MM-DD to ISO-8601 DateTime (start of day in UTC)
            payload.dueDate = new Date(initiativeData.dueDate + 'T00:00:00.000Z').toISOString()
          }
        }

        const response = await api.post('/initiatives', payload)

        toast({
          title: 'Initiative created',
          description: `"${initiativeData.title}" has been created successfully.`,
        })

        console.log('[Telemetry] okr.create.initiative.success', {
          userId: user?.id,
          organizationId: currentOrganization?.id,
          initiativeId: response.data.id,
          timestamp: new Date().toISOString(),
        })

        onSuccess()
      } catch (err: any) {
        console.error('Failed to create initiative', err)
        
        if (err.response?.status === 403) {
          console.log('[Telemetry] okr.create.initiative.forbidden', {
            userId: user?.id,
            organizationId: currentOrganization?.id,
            timestamp: new Date().toISOString(),
          })
        }

        toast({
          title: 'Failed to create Initiative',
          description: err.response?.data?.message || 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsSubmitting(false)
      }
  }

  // Render Initiative form (mode === 'initiative')
  const renderInitiativeForm = () => {
    const usersForOwner = allowedOwners.length > 0 ? allowedOwners : availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email || '' }))
    // Key Results are loaded when an objective is selected (could be enhanced in future)

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="init-title">
            Initiative Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="init-title"
            value={initiativeData.title}
            onChange={(e) => setInitiativeData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter initiative title"
            maxLength={200}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="init-parent">
            Parent (Objective or Key Result) <span className="text-red-500">*</span>
          </Label>
          {/* Story 5: If parentContext provided, show disabled input with parent title */}
          {parentContext ? (
            <>
              <Input
                id="init-parent"
                value={
                  parentContext.type === 'objective'
                    ? `Objective: ${parentContext.title}`
                    : `Key Result: ${parentContext.title}`
                }
                disabled
                readOnly
                className="cursor-not-allowed bg-neutral-50"
                aria-label={`Parent: ${parentContext.type === 'objective' ? 'Objective' : 'Key Result'} - ${parentContext.title}`}
              />
              <p className="text-xs text-muted-foreground">Parent is pre-selected from row context.</p>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <Select
                  value={initiativeData.objectiveId || '__none__'}
                  onValueChange={(value: string) => setInitiativeData(prev => ({ ...prev, objectiveId: value === '__none__' ? null : value, keyResultId: null }))}
                >
                  <SelectTrigger id="init-parent">
                    <SelectValue placeholder="Select objective (or key result below)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (select key result below)</SelectItem>
                    {availableObjectives.map((obj) => (
                      <SelectItem key={obj.id} value={obj.id}>
                        Objective: {obj.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={initiativeData.keyResultId || '__none__'}
                  onValueChange={(value: string) => setInitiativeData(prev => ({ ...prev, keyResultId: value === '__none__' ? null : value, objectiveId: null }))}
                >
                  <SelectTrigger id="init-kr">
                    <SelectValue placeholder="Or select key result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (select objective above)</SelectItem>
                    {availableKeyResults.map((kr) => (
                      <SelectItem key={kr.id} value={kr.id}>
                        Key Result: {kr.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Link this initiative to an objective or key result.</p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="init-owner">
            Owner <span className="text-red-500">*</span>
          </Label>
          <SearchableUserSelect
            value={initiativeData.ownerId}
            onValueChange={(value) => setInitiativeData(prev => ({ ...prev, ownerId: value }))}
            availableUsers={usersForOwner}
            placeholder="Select owner"
            disabled={!canAssignOthers}
            id="init-owner"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="init-status">Status</Label>
          <Select
            value={initiativeData.status}
            onValueChange={(value: typeof initiativeData.status) => setInitiativeData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger id="init-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="init-due-date">Due Date (Optional)</Label>
          <Input
            id="init-due-date"
            type="date"
            value={initiativeData.dueDate}
            onChange={(e) => setInitiativeData(prev => ({ ...prev, dueDate: e.target.value }))}
          />
        </div>
      </div>
    )
  }

  // Get title text - memoized to ensure stable reference
  const titleText = useMemo(() => {
    if (mode === 'objective') return 'New Objective'
    if (mode === 'kr') return parentContext ? `New Key Result for '${parentContext.title}'` : 'New Key Result'
    if (mode === 'initiative') return parentContext ? `New Initiative for '${parentContext.title}'` : 'New Initiative'
    return 'Create'
  }, [mode, parentContext])

  // Get description text - memoized to ensure stable reference
  const descriptionText = useMemo(() => {
    if (mode === 'objective') {
      if (currentStep === 'basics') return 'Define the basic details of your objective.'
      if (currentStep === 'visibility') return 'Set who can see this objective.'
      if (currentStep === 'key-results') return 'Add key results to measure progress.'
      if (currentStep === 'review') return 'Review and publish your objective.'
      return 'Create a new objective.'
    }
    if (mode === 'kr') return 'Create a measurable key result for tracking progress.'
    if (mode === 'initiative') return 'Create an initiative to support your objectives and key results.'
    return 'Create a new item.'
  }, [mode, currentStep])

  return (
    <Sheet open={isOpen} onOpenChange={handleCancel}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg flex flex-col"
      >
        <div ref={sheetContentRef} className="flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>
            {titleText}
          </SheetTitle>
          <SheetDescription>
            {descriptionText}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6" aria-busy={isSubmitting}>
          {showSkeleton && <DrawerFormSkeleton />}
          {!showSkeleton && (
            <>
              {mode === 'objective' && (
                <>
                  {currentStep === 'basics' && renderStepA()}
                  {currentStep === 'visibility' && renderStepB()}
                  {currentStep === 'key-results' && renderStepC()}
                  {currentStep === 'review' && renderStepD()}
                </>
              )}
              {mode === 'kr' && renderKeyResultForm()}
              {mode === 'initiative' && renderInitiativeForm()}
            </>
          )}
        </div>

        <SheetFooter className="flex-row justify-between gap-2 border-t pt-4">
          {currentStep === 'basics' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <div className="flex flex-col items-end gap-2">
                <Button
                  type="button"
                  onClick={() => setCurrentStep('visibility')}
                  disabled={!canProceedFromBasics() || isSubmitting}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  Publishing arrives in W5.M1
                </p>
              </div>
            </>
            )}
          {mode === 'objective' && currentStep === 'visibility' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep('basics')}
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep('key-results')}
                  disabled={!canProceedFromVisibility() || isSubmitting}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          {mode === 'objective' && currentStep === 'key-results' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep('visibility')}
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep('review')}
                  disabled={!canProceedFromKeyResults() || isSubmitting}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          {mode === 'objective' && currentStep === 'review' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep('key-results')}
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting || draftKRs.length === 0}
                  >
                    Save as Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={isSubmitting || draftKRs.length === 0}
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish'}
                  </Button>
                </div>
              </>
            )}
          {mode === 'kr' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitKR}
                disabled={isSubmitting || !canSubmitKR()}
              >
                {isSubmitting ? 'Creating...' : 'Create Key Result'}
              </Button>
            </>
          )}
          {mode === 'initiative' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitInitiative}
                disabled={isSubmitting || !canSubmitInitiative()}
              >
                {isSubmitting ? 'Creating...' : 'Create Initiative'}
              </Button>
            </>
          )}
        </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
