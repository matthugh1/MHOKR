'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Archive, CheckCircle2, Edit2, Trash2, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { useToast } from '@/hooks/use-toast'
import { trapFocus, returnFocus, getActiveElement } from '@/lib/focus-trap'
import { mapErrorToMessage } from '@/lib/error-mapping'
import { track } from '@/lib/analytics'

interface Cycle {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED'
  organizationId: string
}

interface CycleManagementDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentOrganizationId: string | null
  onCyclesUpdated: () => void
}

export function CycleManagementDrawer({
  isOpen,
  onClose,
  currentOrganizationId,
  onCyclesUpdated,
}: CycleManagementDrawerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    startDate: string
    endDate: string
    status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED'
  }>({
    name: '',
    startDate: '',
    endDate: '',
    status: 'DRAFT',
  })
  const sheetContentRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = getActiveElement()
      track('cycle_drawer_opened', {
        userId: user?.id,
        organizationId: currentOrganizationId,
        timestamp: new Date().toISOString(),
      })
      loadCycles()
    } else {
      setCycles([])
      setIsCreating(false)
      setEditingCycleId(null)
      setFormData({
        name: '',
        startDate: '',
        endDate: '',
        status: 'DRAFT',
      })
      if (previousFocusRef.current) {
        returnFocus(previousFocusRef.current)
        previousFocusRef.current = null
      }
    }
  }, [isOpen, currentOrganizationId, user?.id])

  useEffect(() => {
    if (isOpen && sheetContentRef.current) {
      const cleanup = trapFocus(sheetContentRef.current)
      return cleanup
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const loadCycles = async () => {
    if (!currentOrganizationId) return

    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/okr/cycles')
      setCycles(response.data || [])
    } catch (err: any) {
      const errorInfo = mapErrorToMessage(err)
      setError(errorInfo.message)
      console.error('[Cycle Management] Error loading cycles:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingCycleId(null)
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      status: 'DRAFT',
    })
  }

  const handleEdit = (cycle: Cycle) => {
    setEditingCycleId(cycle.id)
    setIsCreating(false)
    setFormData({
      name: cycle.name,
      startDate: cycle.startDate.split('T')[0],
      endDate: cycle.endDate.split('T')[0],
      status: cycle.status,
    })
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingCycleId(null)
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      status: 'DRAFT',
    })
  }

  const handleSubmit = async () => {
    if (!currentOrganizationId) return

    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      })
      return
    }

    const startDate = new Date(formData.startDate)
    const endDate = new Date(formData.endDate)

    if (startDate >= endDate) {
      toast({
        title: 'Validation error',
        description: 'Start date must be before end date.',
        variant: 'destructive',
      })
      return
    }

    try {
      if (isCreating) {
        await api.post('/okr/cycles', {
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
        })
        track('cycle_created', {
          userId: user?.id,
          organizationId: currentOrganizationId,
          cycleName: formData.name,
          status: formData.status,
          timestamp: new Date().toISOString(),
        })
        toast({
          title: 'Cycle created',
          description: `"${formData.name}" has been created.`,
        })
      } else if (editingCycleId) {
        await api.patch(`/okr/cycles/${editingCycleId}`, {
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
        })
        toast({
          title: 'Cycle updated',
          description: `"${formData.name}" has been updated.`,
        })
      }

      setIsCreating(false)
      setEditingCycleId(null)
      setFormData({
        name: '',
        startDate: '',
        endDate: '',
        status: 'DRAFT',
      })
      loadCycles()
      onCyclesUpdated()
    } catch (err: any) {
      const errorInfo = mapErrorToMessage(err)
      toast({
        title: isCreating ? 'Failed to create cycle' : 'Failed to update cycle',
        description: errorInfo.message,
        variant: 'destructive',
      })
      console.error('[Cycle Management] Error:', err)
    }
  }

  const handleSetActive = async (cycleId: string) => {
    if (!currentOrganizationId) return

    try {
      await api.patch(`/okr/cycles/${cycleId}/status`, {
        status: 'ACTIVE',
      })
      track('cycle_set_active', {
        userId: user?.id,
        organizationId: currentOrganizationId,
        cycleId,
        timestamp: new Date().toISOString(),
      })
      toast({
        title: 'Cycle activated',
        description: 'Cycle has been set as active.',
      })
      loadCycles()
      onCyclesUpdated()
    } catch (err: any) {
      const errorInfo = mapErrorToMessage(err)
      toast({
        title: 'Failed to activate cycle',
        description: errorInfo.message,
        variant: 'destructive',
      })
      console.error('[Cycle Management] Error:', err)
    }
  }

  const handleArchive = async (cycleId: string) => {
    if (!currentOrganizationId) return

    try {
      await api.patch(`/okr/cycles/${cycleId}/status`, {
        status: 'ARCHIVED',
      })
      track('cycle_archived', {
        userId: user?.id,
        organizationId: currentOrganizationId,
        cycleId,
        timestamp: new Date().toISOString(),
      })
      toast({
        title: 'Cycle archived',
        description: 'Cycle has been archived.',
      })
      loadCycles()
      onCyclesUpdated()
    } catch (err: any) {
      const errorInfo = mapErrorToMessage(err)
      toast({
        title: 'Failed to archive cycle',
        description: errorInfo.message,
        variant: 'destructive',
      })
      console.error('[Cycle Management] Error:', err)
    }
  }

  const handleDelete = async (cycleId: string) => {
    if (!currentOrganizationId) return

    if (!confirm('Are you sure you want to delete this cycle? This cannot be undone if there are linked OKRs.')) {
      return
    }

    try {
      await api.delete(`/okr/cycles/${cycleId}`)
      toast({
        title: 'Cycle deleted',
        description: 'Cycle has been deleted.',
      })
      loadCycles()
      onCyclesUpdated()
    } catch (err: any) {
      const errorInfo = mapErrorToMessage(err)
      toast({
        title: 'Failed to delete cycle',
        description: errorInfo.message,
        variant: 'destructive',
      })
      console.error('[Cycle Management] Error:', err)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'LOCKED':
        return <Badge variant="default" className="bg-amber-100 text-amber-800">Locked</Badge>
      case 'ARCHIVED':
        return <Badge variant="secondary">Archived</Badge>
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
        ref={sheetContentRef}
        aria-labelledby="cycle-management-drawer-title"
        aria-describedby="cycle-management-drawer-description"
      >
        <SheetHeader>
          <SheetTitle id="cycle-management-drawer-title">Manage Cycles</SheetTitle>
          <SheetDescription id="cycle-management-drawer-description">
            Create, edit, and manage OKR cycles for your organisation.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6" aria-busy={loading}>
          {loading && (
            <div className="text-center text-sm text-muted-foreground py-8" role="status">
              Loading cycles...
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-destructive py-8" role="alert">
              {error}
            </div>
          )}

          {/* Create/Edit Form */}
          {(isCreating || editingCycleId) && (
            <div className="border rounded-lg p-4 space-y-4 bg-neutral-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {isCreating ? 'New Cycle' : 'Edit Cycle'}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  aria-label="Cancel"
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="cycle-name">Name</Label>
                  <Input
                    id="cycle-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Q1 2025"
                    aria-label="Cycle name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cycle-start-date">Start Date</Label>
                    <Input
                      id="cycle-start-date"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      aria-label="Cycle start date"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cycle-end-date">End Date</Label>
                    <Input
                      id="cycle-end-date"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      aria-label="Cycle end date"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="cycle-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger id="cycle-status" aria-label="Cycle status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="LOCKED">Locked</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSubmit} className="flex-1" aria-label={isCreating ? 'Create cycle' : 'Update cycle'}>
                    {isCreating ? 'Create' : 'Update'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} aria-label="Cancel">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Cycles List */}
          {!isCreating && !editingCycleId && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Cycles</h3>
                <Button onClick={handleCreate} size="sm" aria-label="Create new cycle">
                  <Plus className="h-4 w-4 mr-2" />
                  New Cycle
                </Button>
              </div>

              <div className="space-y-2">
                {cycles.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8" role="status">
                    No cycles found. Create your first cycle to get started.
                  </div>
                ) : (
                  cycles.map((cycle) => (
                    <div
                      key={cycle.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{cycle.name}</h4>
                            {getStatusBadge(cycle.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {cycle.status !== 'ACTIVE' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActive(cycle.id)}
                            aria-label={`Set ${cycle.name} as active`}
                            className="text-xs"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Set Active
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(cycle)}
                          aria-label={`Edit ${cycle.name}`}
                          className="text-xs"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        {cycle.status !== 'ARCHIVED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchive(cycle.id)}
                            aria-label={`Archive ${cycle.name}`}
                            className="text-xs"
                          >
                            <Archive className="h-3 w-3 mr-1" />
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(cycle.id)}
                          aria-label={`Delete ${cycle.name}`}
                          className="text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

