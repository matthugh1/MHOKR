'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/contexts/workspace.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Plus, Edit2, Lock, Archive, Trash2, X } from 'lucide-react'
import api from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Cycle {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED'
  isStandard?: boolean
  createdAt: string
  updatedAt: string
}

interface CycleSummary {
  cycleId: string
  objectivesCount: number
  publishedCount: number
  draftCount: number
}

export default function CyclesPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <CyclesManagement />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function CyclesManagement() {
  const { currentOrganization } = useWorkspace()
  const permissions = usePermissions()
  const { toast } = useToast()
  const router = useRouter()

  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [summaries, setSummaries] = useState<Record<string, CycleSummary>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null)
  const [lockCycle, setLockCycle] = useState<Cycle | null>(null)
  const [archiveCycle, setArchiveCycle] = useState<Cycle | null>(null)
  const [deletingCycle, setDeletingCycle] = useState<Cycle | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED'>('DRAFT')

  // Check permissions - require tenant admin/owner role
  const canManageCycles = permissions.isTenantAdminOrOwner(currentOrganization?.id)

  useEffect(() => {
    // Wait for permissions to load before checking
    if (permissions.loading) {
      return
    }

    // Debug logging
    console.log('[CYCLES PAGE] Permission check', {
      loading: permissions.loading,
      canManageCycles,
      currentOrganizationId: currentOrganization?.id,
      isSuperuser: permissions.isSuperuser,
    })

    // Redirect if no permission
    if (!canManageCycles) {
      console.log('[CYCLES PAGE] Access denied, redirecting', {
        canManageCycles,
        currentOrganizationId: currentOrganization?.id,
      })
      toast({
        title: 'Access Denied',
        description: 'Cycle management requires administrator rights.',
        variant: 'destructive',
      })
      router.push('/dashboard')
      return
    }

    if (currentOrganization) {
      loadCycles()
    }
  }, [currentOrganization, canManageCycles, permissions.loading])

  const loadCycles = async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      const res = await api.get('/okr/cycles')
      // Only show custom cycles (filter out standard cycles)
      const customCycles = (res.data || []).filter((cycle: any) => !cycle.isStandard)
      setCycles(customCycles as Cycle[])

      // Load summaries for each cycle
      const summaryPromises = res.data.map((cycle: Cycle) =>
        api.get(`/okr/cycles/${cycle.id}/summary`).catch(() => null)
      )
      const summaryResults = await Promise.all(summaryPromises)
      const summaryMap: Record<string, CycleSummary> = {}
      summaryResults.forEach((result, idx) => {
        if (result?.data) {
          summaryMap[res.data[idx].id] = result.data
        }
      })
      setSummaries(summaryMap)
    } catch (error: any) {
      console.error('Failed to load cycles:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load cycles',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCycle = async () => {
    if (!formName.trim() || !formStartDate || !formEndDate || !currentOrganization) return

    setLoading(true)
    try {
      await api.post('/okr/cycles', {
        name: formName.trim(),
        startDate: formStartDate,
        endDate: formEndDate,
        status: formStatus,
      })
      toast({
        title: 'Success',
        description: 'Cycle created successfully',
      })
      setShowCreate(false)
      resetForm()
      await loadCycles()
    } catch (error: any) {
      console.error('Failed to create cycle:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create cycle',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditCycle = (cycle: Cycle) => {
    setEditingCycle(cycle)
    setFormName(cycle.name)
    setFormStartDate(cycle.startDate.split('T')[0])
    setFormEndDate(cycle.endDate.split('T')[0])
    setFormStatus(cycle.status)
  }

  const handleSaveEdit = async () => {
    if (!editingCycle || !formName.trim()) return

    setLoading(true)
    try {
      await api.patch(`/okr/cycles/${editingCycle.id}`, {
        name: formName.trim(),
        startDate: formStartDate,
        endDate: formEndDate,
        status: formStatus,
      })
      toast({
        title: 'Success',
        description: 'Cycle updated successfully',
      })
      setEditingCycle(null)
      resetForm()
      await loadCycles()
    } catch (error: any) {
      console.error('Failed to update cycle:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update cycle',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLockCycle = async () => {
    if (!lockCycle) return

    setLoading(true)
    try {
      await api.patch(`/okr/cycles/${lockCycle.id}/status`, {
        status: 'LOCKED',
      })
      toast({
        title: 'Success',
        description: 'Cycle locked successfully',
      })
      setLockCycle(null)
      await loadCycles()
    } catch (error: any) {
      console.error('Failed to lock cycle:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to lock cycle',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleArchiveCycle = async () => {
    if (!archiveCycle) return

    setLoading(true)
    try {
      await api.patch(`/okr/cycles/${archiveCycle.id}/status`, {
        status: 'ARCHIVED',
      })
      toast({
        title: 'Success',
        description: 'Cycle archived successfully',
      })
      setArchiveCycle(null)
      await loadCycles()
    } catch (error: any) {
      console.error('Failed to archive cycle:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to archive cycle',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCycle = async () => {
    if (!deletingCycle) return

    setLoading(true)
    try {
      await api.delete(`/okr/cycles/${deletingCycle.id}`)
      toast({
        title: 'Success',
        description: 'Cycle deleted successfully',
      })
      setDeletingCycle(null)
      await loadCycles()
    } catch (error: any) {
      console.error('Failed to delete cycle:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete cycle',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormName('')
    setFormStartDate('')
    setFormEndDate('')
    setFormStatus('DRAFT')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'outline'
      case 'ACTIVE':
        return 'default'
      case 'LOCKED':
        return 'destructive'
      case 'ARCHIVED':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  // Show loading state while permissions are being fetched
  if (permissions.loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-slate-500">Loading permissions...</div>
        </div>
      </div>
    )
  }

  if (!canManageCycles) {
    return null
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cycle Management</h1>
            <p className="text-slate-600 mt-1">
              Manage custom cycles for special periods (sprints, programs, etc.). Standard cycles (months, quarters, years) are created automatically when selecting them in OKR forms.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Cycle
            </Button>
          </div>
        </div>

        {loading && cycles.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-slate-500">
              Loading cycles...
            </CardContent>
          </Card>
        ) : cycles.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No custom cycles yet.</p>
              <p className="text-sm mt-1">Create a custom cycle for special periods (sprints, programs, etc.).</p>
              <p className="text-xs mt-2 text-slate-400">Standard cycles (months, quarters, years) are managed automatically when creating OKRs.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Cycles</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Objectives</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((cycle) => {
                    const summary = summaries[cycle.id]
                    return (
                      <TableRow key={cycle.id}>
                        <TableCell className="font-medium">{cycle.name}</TableCell>
                        <TableCell>{formatDate(cycle.startDate)}</TableCell>
                        <TableCell>{formatDate(cycle.endDate)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(cycle.status)}>
                            {cycle.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {summary ? (
                            <span className="text-sm text-slate-600">
                              {summary.objectivesCount} total
                              {summary.publishedCount > 0 && (
                                <span className="text-slate-400 ml-1">
                                  ({summary.publishedCount} published)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCycle(cycle)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {cycle.status !== 'LOCKED' && cycle.status !== 'ARCHIVED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLockCycle(cycle)}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                            {cycle.status !== 'ARCHIVED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setArchiveCycle(cycle)}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingCycle(cycle)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Create Cycle Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Cycle</DialogTitle>
              <DialogDescription>
                Create a new cycle for OKR tracking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Q1 2026"
                />
              </div>
              <div>
                <Label htmlFor="create-start">Start Date</Label>
                <Input
                  id="create-start"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="create-end">End Date</Label>
                <Input
                  id="create-end"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="create-status">Status</Label>
                <Select value={formStatus} onValueChange={(v: string) => setFormStatus(v as 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED')}>
                  <SelectTrigger id="create-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm() }}>
                Cancel
              </Button>
              <Button onClick={handleCreateCycle} disabled={loading || !formName.trim() || !formStartDate || !formEndDate}>
                {loading ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Cycle Dialog */}
        <Dialog open={!!editingCycle} onOpenChange={(open: boolean) => { if (!open) { setEditingCycle(null); resetForm() } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Cycle</DialogTitle>
              <DialogDescription>
                Update cycle details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Q1 2026"
                />
              </div>
              <div>
                <Label htmlFor="edit-start">Start Date</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-end">End Date</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formStatus} onValueChange={(v: string) => setFormStatus(v as 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED')}>
                  <SelectTrigger id="edit-status">
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingCycle(null); resetForm() }}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading || !formName.trim()}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lock Cycle Confirmation */}
        <AlertDialog open={!!lockCycle} onOpenChange={(open: boolean) => { if (!open) setLockCycle(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Lock Cycle</AlertDialogTitle>
              <AlertDialogDescription>
                Locking a cycle prevents further OKR edits. Only tenant administrators will be able to modify OKRs in this cycle. Are you sure you want to lock &quot;{lockCycle?.name}&quot;?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLockCycle} disabled={loading}>
                {loading ? 'Locking...' : 'Lock Cycle'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Archive Cycle Confirmation */}
        <AlertDialog open={!!archiveCycle} onOpenChange={(open: boolean) => { if (!open) setArchiveCycle(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Cycle</AlertDialogTitle>
              <AlertDialogDescription>
                Archiving a cycle removes it from selection menus and marks it as read-only. Are you sure you want to archive &quot;{archiveCycle?.name}&quot;?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchiveCycle} disabled={loading}>
                {loading ? 'Archiving...' : 'Archive Cycle'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Cycle Confirmation */}
        <AlertDialog open={!!deletingCycle} onOpenChange={(open: boolean) => { if (!open) setDeletingCycle(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Cycle</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{deletingCycle?.name}&quot;. This action can only be performed if no OKRs are linked to this cycle. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCycle} disabled={loading} className="bg-red-600 hover:bg-red-700">
                {loading ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

