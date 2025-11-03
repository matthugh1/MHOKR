'use client'

import React, { useState, useEffect } from 'react'
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
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface OKRCreationDrawerProps {
  isOpen: boolean
  onClose: () => void
  availableUsers: Array<{ id: string; name: string; email?: string }>
  activeCycles: Array<{ id: string; name: string; status: string }>
  currentOrganization: { id: string } | null
  onSuccess: () => void
}

type Step = 'basics' | 'visibility' | 'key-results' | 'review'

  interface DraftObjective {
    title: string
    description: string
    ownerId: string
    cycleId: string
    parentId?: string
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
  onClose,
  availableUsers,
  activeCycles,
  currentOrganization,
  onSuccess,
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const drawerOpenTimeRef = React.useRef<number | null>(null)

  // Creation context (RBAC-aware options)
  const [allowedVisibilityLevels, setAllowedVisibilityLevels] = useState<string[]>(['PUBLIC_TENANT'])
  const [allowedOwners, setAllowedOwners] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [canAssignOthers, setCanAssignOthers] = useState(false)
  const [availableCyclesForCreation, setAvailableCyclesForCreation] = useState<Array<{ id: string; name: string; status: string }>>([])

  // Track drawer open time for telemetry
  useEffect(() => {
    if (isOpen) {
      drawerOpenTimeRef.current = Date.now()
      // Track drawer opened
      console.log('[Telemetry] okr_drawer_opened', {
        userId: user?.id,
        organizationId: currentOrganization?.id,
        timestamp: new Date().toISOString(),
      })
    } else {
      if (drawerOpenTimeRef.current) {
        const duration = Date.now() - drawerOpenTimeRef.current
        // Track drawer closed/abandoned (if not submitting)
        if (!isSubmitting) {
          console.log('[Telemetry] okr_drawer_abandoned', {
            userId: user?.id,
            organizationId: currentOrganization?.id,
            duration,
            step: currentStep,
            timestamp: new Date().toISOString(),
          })
        }
        drawerOpenTimeRef.current = null
      }
    }
  }, [isOpen, isSubmitting, currentStep, user?.id, currentOrganization?.id])

  // Track step changes
  useEffect(() => {
    if (isOpen && drawerOpenTimeRef.current) {
      console.log('[Telemetry] okr_drawer_step_viewed', {
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
      api.get(`/okr/creation-context?organizationId=${currentOrganization.id}`)
        .then((res) => {
          setAllowedVisibilityLevels(res.data.allowedVisibilityLevels || ['PUBLIC_TENANT'])
          setAllowedOwners(res.data.allowedOwners || [])
          setCanAssignOthers(res.data.canAssignOthers || false)
          setAvailableCyclesForCreation(res.data.availableCycles || [])
          
          // Pre-fill owner if user cannot assign others
          if (!res.data.canAssignOthers && user?.id) {
            setDraftObjective((prev) => ({ ...prev, ownerId: user.id }))
          }
          
          // Pre-fill cycle if available
          if (res.data.availableCycles && res.data.availableCycles.length > 0) {
            setDraftObjective((prev) => ({ ...prev, cycleId: res.data.availableCycles[0].id }))
          }
        })
        .catch((err) => {
          console.error('Failed to fetch creation context', err)
          // Fallback: use provided props
          setAllowedOwners(availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email || '' })))
          setAvailableCyclesForCreation(activeCycles)
        })
    }
  }, [isOpen, currentOrganization?.id, user?.id, availableUsers, activeCycles])

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
      setIsSubmitting(false)
    }
  }, [isOpen, user?.id, activeCycles])

  // Validate Step A
  const canProceedFromBasics = () => {
    if (!draftObjective.title.trim()) return false
    if (!draftObjective.ownerId) return false
    if (!draftObjective.cycleId) return false

    // Check cycle lock
    const selectedCycle = availableCyclesForCreation.find(c => c.id === draftObjective.cycleId)
    if (selectedCycle && (selectedCycle.status === 'LOCKED' || selectedCycle.status === 'ARCHIVED')) {
      // Only allow if user is admin
      if (!permissions.isTenantAdminOrOwner(currentOrganization?.id)) {
        return false
      }
    }

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
  const getCycleLockWarning = () => {
    const selectedCycle = availableCyclesForCreation.find(c => c.id === draftObjective.cycleId)
    if (selectedCycle && (selectedCycle.status === 'LOCKED' || selectedCycle.status === 'ARCHIVED')) {
      if (!permissions.isTenantAdminOrOwner(currentOrganization?.id)) {
        return 'This cycle is locked or archived. Only tenant administrators can create OKRs in locked cycles.'
      }
    }
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
      // Get cycle dates
      const selectedCycle = availableCyclesForCreation.find(c => c.id === draftObjective.cycleId) ||
        activeCycles.find(c => c.id === draftObjective.cycleId)
      
      const startDate = selectedCycle && 'startDate' in selectedCycle && selectedCycle.startDate
        ? new Date(selectedCycle.startDate).toISOString()
        : new Date().toISOString()
      
      const endDate = selectedCycle && 'endDate' in selectedCycle && selectedCycle.endDate
        ? new Date(selectedCycle.endDate).toISOString()
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // Default 90 days

      // Create Objective as draft
      const objectiveRes = await api.post('/objectives', {
        title: draftObjective.title,
        description: draftObjective.description || undefined,
        ownerId: draftObjective.ownerId,
        cycleId: draftObjective.cycleId,
        organizationId: currentOrganization.id,
        visibilityLevel: draftObjective.visibilityLevel,
        parentId: draftObjective.parentId || undefined,
      // W4.M1: period removed - not sent to backend
      startDate,
      endDate,
      status: 'ON_TRACK',
      })
      
      const objectiveId = objectiveRes.data.id
      
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
      toast({
        title: 'Failed to save draft',
        description: err.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
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
    const publishStartTime = Date.now()
    try {
      // Get cycle dates
      const selectedCycle = availableCyclesForCreation.find(c => c.id === draftObjective.cycleId) ||
        activeCycles.find(c => c.id === draftObjective.cycleId)
      
      const startDate = selectedCycle && 'startDate' in selectedCycle && selectedCycle.startDate
        ? new Date(selectedCycle.startDate).toISOString()
        : new Date().toISOString()
      
      const endDate = selectedCycle && 'endDate' in selectedCycle && selectedCycle.endDate
        ? new Date(selectedCycle.endDate).toISOString()
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // Default 90 days

      // Create Objective as published
      console.log('[OKR CREATION] Creating objective with payload:', {
        title: draftObjective.title,
        ownerId: draftObjective.ownerId,
        cycleId: draftObjective.cycleId,
        organizationId: currentOrganization.id,
        startDate,
        endDate,
        period: 'QUARTERLY',
      })
      const objectiveRes = await api.post('/objectives', {
        title: draftObjective.title,
        description: draftObjective.description || undefined,
        ownerId: draftObjective.ownerId,
        cycleId: draftObjective.cycleId,
        organizationId: currentOrganization.id,
        visibilityLevel: draftObjective.visibilityLevel,
        parentId: draftObjective.parentId || undefined,
      // W4.M1: period removed - not sent to backend
      startDate,
      endDate,
      status: 'ON_TRACK',
      })
      console.log('[OKR CREATION] Objective created successfully:', objectiveRes.data)
      
      const objectiveId = objectiveRes.data.id
      
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
        })
      }
      
      toast({
        title: 'OKR published successfully',
        description: `"${draftObjective.title}" has been published with ${draftKRs.length} key result${draftKRs.length !== 1 ? 's' : ''}.`,
      })
      
      // Track publish success
      const publishDuration = Date.now() - publishStartTime
      const totalDuration = drawerOpenTimeRef.current ? Date.now() - drawerOpenTimeRef.current : null
      console.log('[Telemetry] okr_published', {
        userId: user?.id,
        organizationId: currentOrganization?.id,
        publishDuration,
        totalDuration,
        krCount: draftKRs.length,
        timestamp: new Date().toISOString(),
      })
      
      onSuccess()
    } catch (err: any) {
      console.error('Failed to publish OKR', err)
      
      // Track publish failure
      const publishDuration = Date.now() - publishStartTime
      const categorizeError = (error: any): string => {
        if (error.response?.status === 403) return 'permission_denied'
        if (error.response?.status === 400) return 'validation_error'
        if (error.response?.status === 404) return 'not_found'
        return 'unknown_error'
      }
      
      console.log('[Telemetry] okr_publish_failed', {
        userId: user?.id,
        organizationId: currentOrganization?.id,
        error: err.response?.data?.message,
        reason: categorizeError(err),
        publishDuration,
        timestamp: new Date().toISOString(),
      })
      
      if (err.response?.status === 403) {
        toast({
          title: 'Permission denied',
          description: err.response.data.message || 'You do not have permission to create OKRs.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Failed to publish OKR',
          description: err.response?.data?.message || 'Please try again.',
          variant: 'destructive',
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
          <Select
            value={draftObjective.ownerId}
            onValueChange={(value) => setDraftObjective((prev) => ({ ...prev, ownerId: value }))}
            disabled={!canAssignOthers}
          >
            <SelectTrigger id="owner">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {usersForOwner.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email || u.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!canAssignOthers && (
            <p className="text-xs text-muted-foreground">You can only assign yourself as owner.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cycle">
            Cycle <span className="text-red-500">*</span>
          </Label>
          <Select
            value={draftObjective.cycleId}
            onValueChange={(value) => setDraftObjective((prev) => ({ ...prev, cycleId: value }))}
          >
            <SelectTrigger id="cycle">
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
          {cycleWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{cycleWarning}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent">
            Alignment / Parent (Optional)
          </Label>
          <Input
            id="parent"
            disabled
            placeholder="None (top-level objective) - Coming soon"
            className="cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">Link this objective to a strategic pillar or parent objective. (Feature coming soon)</p>
        </div>
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
              <Select
                value={kr.ownerId}
                onValueChange={(value) => updateKeyResult(kr.id, { ownerId: value })}
                disabled={!canAssignOthers}
              >
                <SelectTrigger id={`kr-owner-${kr.id}`}>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {usersForKROwner.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

  return (
    <Sheet open={isOpen} onOpenChange={handleCancel}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Create New Objective</SheetTitle>
          <SheetDescription>
            {currentStep === 'basics' && 'Define the basic details of your objective.'}
            {currentStep === 'visibility' && 'Set who can see this objective.'}
            {currentStep === 'key-results' && 'Add key results to measure progress.'}
            {currentStep === 'review' && 'Review and publish your objective.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6">
          {currentStep === 'basics' && renderStepA()}
          {currentStep === 'visibility' && renderStepB()}
          {currentStep === 'key-results' && renderStepC()}
          {currentStep === 'review' && renderStepD()}
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
            {currentStep === 'visibility' && (
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
            {currentStep === 'key-results' && (
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
            {currentStep === 'review' && (
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
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
