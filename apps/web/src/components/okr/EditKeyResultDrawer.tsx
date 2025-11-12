'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
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
import { TagSelector } from '@/components/okr/TagSelector'
import { ContributorSelector } from '@/components/okr/ContributorSelector'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { AlertCircle, Loader2 } from 'lucide-react'
import { StandardCycleSelector } from '@/components/okr/StandardCycleSelector'
import { trapFocus, returnFocus, getActiveElement } from '@/lib/focus-trap'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type OKRStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED'
type MetricType = 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'PERCENTAGE' | 'CUSTOM'
type CheckInCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'NONE'
type VisibilityLevel = 'PUBLIC_TENANT' | 'PRIVATE'

export interface EditKeyResultDrawerProps {
  isOpen: boolean
  keyResultId: string | null
  keyResultData: {
    id: string
    title: string
    description?: string
    ownerId: string
    tenantId: string
    metricType: MetricType
    startValue: number
    targetValue: number
    currentValue: number
    unit?: string
    status: OKRStatus
    checkInCadence?: CheckInCadence
    cycleId?: string
    startDate?: string
    endDate?: string
    visibilityLevel: VisibilityLevel
    tags?: Array<{ id: string; name: string; color?: string | null }>
    contributors?: Array<{ id: string; user: { id: string; name: string; email?: string; avatar?: string | null }; role: string }>
    weight?: number
    objectiveIds?: string[]
  } | null
  availableUsers: Array<{ id: string; name: string; email?: string }>
  activeCycles: Array<{ id: string; name: string; status: string }>
  currentOrganization: { id: string } | null
  onClose: () => void
  onSuccess: () => void
}

export function EditKeyResultDrawer({
  isOpen,
  keyResultId,
  keyResultData,
  availableUsers,
  activeCycles,
  currentOrganization,
  onClose,
  onSuccess,
}: EditKeyResultDrawerProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [metricType, setMetricType] = useState<MetricType>('INCREASE')
  const [startValue, setStartValue] = useState<number>(0)
  const [targetValue, setTargetValue] = useState<number>(100)
  const [currentValue, setCurrentValue] = useState<number>(0)
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState<OKRStatus>('ON_TRACK')
  const [checkInCadence, setCheckInCadence] = useState<CheckInCadence>('NONE')
  const [cycleId, setCycleId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>('PUBLIC_TENANT')
  const [selectedTags, setSelectedTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedContributors, setSelectedContributors] = useState<Array<{ id: string; user: { id: string; name: string; email?: string; avatar?: string | null }; role: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('basic')

  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()
  const sheetContentRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Focus management: store previous focus and return on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = getActiveElement()
    } else {
      // Return focus to opener when drawer closes
      if (previousFocusRef.current) {
        returnFocus(previousFocusRef.current)
        previousFocusRef.current = null
      }
    }
  }, [isOpen])

  // Focus trap when drawer opens
  useEffect(() => {
    if (isOpen && sheetContentRef.current) {
      const cleanup = trapFocus(sheetContentRef.current)
      return cleanup
    }
  }, [isOpen])

  // Handle Esc key to close drawer
  useEffect(() => {
    if (!isOpen || isSubmitting) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSubmitting && !isLoading) {
          setError(null)
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, isSubmitting, isLoading, onClose])

  // Load KR data when drawer opens
  useEffect(() => {
    if (isOpen && keyResultId && !keyResultData) {
      loadKeyResultData()
    } else if (isOpen && keyResultData) {
      setLoadedKrData(keyResultData)
      populateForm(keyResultData)
    }
    
    // Reset loaded data when drawer closes
    if (!isOpen) {
      setLoadedKrData(null)
    }
  }, [isOpen, keyResultId, keyResultData])

  const loadKeyResultData = async () => {
    if (!keyResultId) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get(`/key-results/${keyResultId}`)
      const kr = response.data
      
      // Load tags and contributors
      const tagsResponse = await api.get(`/key-results/${keyResultId}/tags`).catch(() => ({ data: [] }))
      const contributorsResponse = await api.get(`/key-results/${keyResultId}/contributors`).catch(() => ({ data: [] }))
      
      const fullData = {
        ...kr,
        tags: tagsResponse.data || [],
        contributors: contributorsResponse.data || [],
      }
      
      // Store loaded data for permission checks
      setLoadedKrData(fullData)
      populateForm(fullData)
    } catch (err: any) {
      console.error('Failed to load key result:', err)
      setError(err.response?.data?.message || 'Failed to load key result')
      toast({
        title: 'Error',
        description: 'Failed to load key result data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const populateForm = (data: EditKeyResultDrawerProps['keyResultData']) => {
    if (!data) return

    setTitle(data.title || '')
    setDescription(data.description || '')
    setOwnerId(data.ownerId || '')
    setMetricType(data.metricType || 'INCREASE')
    setStartValue(data.startValue ?? 0)
    setTargetValue(data.targetValue ?? 100)
    setCurrentValue(data.currentValue ?? 0)
    setUnit(data.unit || '')
    setStatus(data.status || 'ON_TRACK')
    setCheckInCadence(data.checkInCadence || 'NONE')
    setCycleId(data.cycleId || '')
    setStartDate(data.startDate ? data.startDate.split('T')[0] : '')
    setEndDate(data.endDate ? data.endDate.split('T')[0] : '')
    setVisibilityLevel(data.visibilityLevel || 'PUBLIC_TENANT')
    setSelectedTags(data.tags || [])
    setSelectedContributors(data.contributors || [])
  }

  // Track loaded data separately for permission checks
  const [loadedKrData, setLoadedKrData] = useState<EditKeyResultDrawerProps['keyResultData']>(null)

  const canEdit = useMemo(() => {
    // Use loaded data if available, otherwise fall back to keyResultData prop
    const dataToCheck = loadedKrData || keyResultData
    
    // If we have keyResultId but no data yet, allow editing while loading (will be checked again after load)
    if (keyResultId && !dataToCheck) {
      if (isLoading) {
        return true // Allow editing while loading
      }
      return false // No data and not loading = can't edit
    }
    
    if (!dataToCheck || !keyResultId) return false
    
    // Get context from data - check if objectives are included
    const firstObjective = (dataToCheck as any)?.objectives?.[0]?.objective || 
                          (dataToCheck as any)?.objectives?.[0] ||
                          null
    
    return tenantPermissions.canEditKeyResult({
      id: keyResultId,
      ownerId: dataToCheck.ownerId,
      tenantId: dataToCheck.tenantId,
      organizationId: dataToCheck.tenantId, // tenantId is organizationId
      workspaceId: firstObjective?.workspaceId || dataToCheck.workspaceId || null,
      teamId: firstObjective?.teamId || dataToCheck.teamId || null,
      parentObjective: firstObjective ? {
        id: firstObjective.id,
        ownerId: firstObjective.ownerId,
        organizationId: firstObjective.tenantId,
        workspaceId: firstObjective.workspaceId,
        teamId: firstObjective.teamId,
        isPublished: firstObjective.isPublished,
        visibilityLevel: firstObjective.visibilityLevel,
        cycle: firstObjective.cycleId ? { id: firstObjective.cycleId, status: firstObjective.cycle?.status } : null,
        cycleStatus: firstObjective.cycle?.status,
      } : null,
    })
  }, [keyResultId, keyResultData, loadedKrData, tenantPermissions, isLoading])

  const lockInfo = useMemo(() => {
    const dataToCheck = loadedKrData || keyResultData
    if (!dataToCheck) return { isLocked: false, message: '' }
    return tenantPermissions.getLockInfoForKeyResult?.(dataToCheck) || { isLocked: false, message: '' }
  }, [keyResultData, loadedKrData, tenantPermissions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!keyResultId) return

    // Validation
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title is required',
        variant: 'destructive',
      })
      return
    }

    if (lockInfo.isLocked) {
      toast({
        title: 'Cannot Edit',
        description: lockInfo.message || 'This key result is locked and cannot be edited',
        variant: 'destructive',
      })
      return
    }
    
    if (!canEdit) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to edit this key result',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Update basic fields
      const updateData: any = {
        title: title.trim(),
        description: description.trim() || null,
        ownerId,
        metricType,
        startValue,
        targetValue,
        currentValue,
        unit: unit.trim() || null,
        status,
        checkInCadence: checkInCadence === 'NONE' ? null : checkInCadence,
        cycleId: cycleId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        visibilityLevel,
      }

      await api.patch(`/key-results/${keyResultId}`, updateData)

      // Tags and contributors are managed separately via their own endpoints
      // They're already updated via TagSelector and ContributorSelector components

      toast({
        title: 'Success',
        description: 'Key result updated successfully',
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to update key result:', err)
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update key result'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting && !isLoading) {
      setError(null)
      onClose()
    }
  }

  if (isLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Key Result</SheetTitle>
            <SheetDescription>
              Loading key result data...
            </SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent ref={sheetContentRef} className="w-full sm:max-w-2xl flex flex-col p-0">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-shrink-0 px-6 pt-6 pb-4">
            <SheetHeader>
              <SheetTitle>Edit Key Result</SheetTitle>
              <SheetDescription>
                Update the Key Result details and settings.
              </SheetDescription>
            </SheetHeader>

            {lockInfo.isLocked && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">{lockInfo.message || 'This key result is locked and cannot be edited.'}</p>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">{error}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>

            {/* Basic Tab - Title, Description, Owner, Status */}
            <TabsContent value="basic" className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1 pb-2">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kr-title">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="kr-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter key result title"
                    required
                    disabled={lockInfo.isLocked || !canEdit}
                    autoFocus
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kr-description">Description</Label>
                  <Textarea
                    id="kr-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter key result description (optional)"
                    rows={2}
                    disabled={lockInfo.isLocked || !canEdit}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kr-owner">
                    Owner <span className="text-red-500">*</span>
                  </Label>
                  <SearchableUserSelect
                    value={ownerId}
                    onValueChange={setOwnerId}
                    availableUsers={availableUsers}
                    placeholder="Select owner"
                    id="kr-owner"
                    required
                    disabled={lockInfo.isLocked || !canEdit}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kr-status">
                    Status <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as OKRStatus)}
                    disabled={lockInfo.isLocked || !canEdit}
                    required
                  >
                    <SelectTrigger id="kr-status" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ON_TRACK">On Track</SelectItem>
                      <SelectItem value="AT_RISK">At Risk</SelectItem>
                      <SelectItem value="OFF_TRACK">Off Track</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Metrics Tab - Values, Metric Type, Unit */}
            <TabsContent value="metrics" className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1 pb-2">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-start">Start Value</Label>
                    <Input
                      id="kr-start"
                      type="number"
                      step="any"
                      value={startValue}
                      onChange={(e) => setStartValue(parseFloat(e.target.value) || 0)}
                      disabled={lockInfo.isLocked || !canEdit}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-current">Current Value</Label>
                    <Input
                      id="kr-current"
                      type="number"
                      step="any"
                      value={currentValue}
                      onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
                      disabled={lockInfo.isLocked || !canEdit}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-target">
                      Target Value <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="kr-target"
                      type="number"
                      step="any"
                      value={targetValue}
                      onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                      required
                      disabled={lockInfo.isLocked || !canEdit}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-metric">Metric Type</Label>
                    <Select
                      value={metricType}
                      onValueChange={(value) => setMetricType(value as MetricType)}
                      disabled={lockInfo.isLocked || !canEdit}
                    >
                      <SelectTrigger id="kr-metric" className="h-9">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-unit">Unit</Label>
                    <Input
                      id="kr-unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g., users, hours, %"
                      disabled={lockInfo.isLocked || !canEdit}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab - Cadence, Cycle, Dates, Visibility */}
            <TabsContent value="settings" className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1 pb-2">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kr-cadence">Check-in Cadence</Label>
                  <Select
                    value={checkInCadence}
                    onValueChange={(value) => setCheckInCadence(value as CheckInCadence)}
                    disabled={lockInfo.isLocked || !canEdit}
                  >
                    <SelectTrigger id="kr-cadence" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeCycles.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-cycle">Cycle</Label>
                    <StandardCycleSelector
                      value={cycleId}
                      onValueChange={setCycleId}
                      availableCycles={activeCycles}
                      disabled={lockInfo.isLocked || !canEdit}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-start-date">Start Date</Label>
                    <Input
                      id="kr-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={lockInfo.isLocked || !canEdit}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kr-end-date">End Date</Label>
                    <Input
                      id="kr-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={lockInfo.isLocked || !canEdit}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kr-visibility">
                    Visibility <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={visibilityLevel}
                    onValueChange={(value) => setVisibilityLevel(value as VisibilityLevel)}
                    disabled={lockInfo.isLocked || !canEdit}
                    required
                  >
                    <SelectTrigger id="kr-visibility" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC_TENANT">Public (Tenant)</SelectItem>
                      <SelectItem value="PRIVATE">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Metadata Tab - Tags, Contributors */}
            <TabsContent value="metadata" className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1 pb-2">
              {keyResultId ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Tags</Label>
                    <TagSelector
                      entityType="key-result"
                      entityId={keyResultId}
                      selectedTags={selectedTags}
                      onTagsChange={setSelectedTags}
                      currentOrganizationId={currentOrganization?.id || null}
                      canEdit={canEdit && !lockInfo.isLocked}
                      disabled={lockInfo.isLocked || !canEdit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Contributors</Label>
                    <ContributorSelector
                      entityType="key-result"
                      entityId={keyResultId}
                      selectedContributors={selectedContributors}
                      onContributorsChange={setSelectedContributors}
                      availableUsers={availableUsers.map(u => ({ id: u.id, name: u.name || '', email: u.email, avatar: null }))}
                      currentOrganizationId={currentOrganization?.id || null}
                      canEdit={canEdit && !lockInfo.isLocked}
                      disabled={lockInfo.isLocked || !canEdit}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4">
                  Save the Key Result first to add tags and contributors.
                </div>
              )}
            </TabsContent>
          </Tabs>

            <SheetFooter className="flex-shrink-0 mt-4 pt-4 pb-6 border-t px-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId || lockInfo.isLocked || !canEdit}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </SheetFooter>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

