'use client'

import React, { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, User } from 'lucide-react'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'
import { SearchableUserSelect } from '@/components/okr/SearchableUserSelect'

interface Pillar {
  id: string
  name: string
  description: string | null
  color: string | null
  ownerId: string | null
  owner: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  createdAt: string
  updatedAt: string
}

interface PillarRollup {
  pillarId: string
  pillarName: string
  pillarColor: string | null
  objectiveCount: number
  byState: Record<string, number>
  avgProgress: number | null
  avgConfidence: number | null
  atRiskCount: number
}

export default function PillarsPage() {
  const { user } = useAuth()
  const permissions = usePermissions()
  const { toast } = useToast()

  const [pillars, setPillars] = useState<Pillar[]>([])
  const [rollup, setRollup] = useState<PillarRollup[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null)
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email?: string; avatar?: string | null }>>([])

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formColor, setFormColor] = useState('')
  const [formOwnerId, setFormOwnerId] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canEdit = permissions.hasPermission('edit_okr')

  useEffect(() => {
    loadPillars()
    loadRollup()
    loadUsers()
  }, [])

  const loadPillars = async () => {
    try {
      setLoading(true)
      const response = await api.get('/pillars')
      setPillars(response.data || [])
    } catch (error: any) {
      console.error('Failed to load pillars:', error)
      toast({
        title: 'Error',
        description: 'Failed to load pillars. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadRollup = async () => {
    try {
      const response = await api.get('/reports/pillars/rollup')
      setRollup(response.data || [])
    } catch (error) {
      console.error('Failed to load pillar rollup:', error)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await api.get('/users')
      setAvailableUsers(response.data || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormColor('')
    setFormOwnerId(null)
    setFormErrors({})
  }

  const handleCreate = () => {
    resetForm()
    setSelectedPillar(null)
    setIsCreateDialogOpen(true)
  }

  const handleEdit = (pillar: Pillar) => {
    setFormName(pillar.name)
    setFormDescription(pillar.description || '')
    setFormColor(pillar.color || '')
    setFormOwnerId(pillar.ownerId)
    setSelectedPillar(pillar)
    setFormErrors({})
    setIsEditDialogOpen(true)
  }

  const handleDelete = (pillar: Pillar) => {
    setSelectedPillar(pillar)
    setIsDeleteDialogOpen(true)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formName.trim()) {
      errors.name = 'Name is required'
    } else if (formName.length > 100) {
      errors.name = 'Name must be <= 100 characters'
    }

    if (formColor && !/^#([0-9A-F]{3}){1,2}$/i.test(formColor)) {
      errors.color = 'Color must be a valid hex color (e.g., #FF5733)'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      await api.post('/pillars', {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        color: formColor.trim() || undefined,
        ownerId: formOwnerId || undefined,
      })

      toast({
        title: 'Success',
        description: 'Pillar created successfully',
      })

      setIsCreateDialogOpen(false)
      resetForm()
      loadPillars()
      loadRollup()
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create pillar'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!selectedPillar || !validateForm()) return

    setIsSubmitting(true)
    try {
      await api.patch(`/pillars/${selectedPillar.id}`, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        color: formColor.trim() || undefined,
        ownerId: formOwnerId,
      })

      toast({
        title: 'Success',
        description: 'Pillar updated successfully',
      })

      setIsEditDialogOpen(false)
      resetForm()
      setSelectedPillar(null)
      loadPillars()
      loadRollup()
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update pillar'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedPillar) return

    setIsSubmitting(true)
    try {
      await api.delete(`/pillars/${selectedPillar.id}`)

      toast({
        title: 'Success',
        description: 'Pillar deleted successfully',
      })

      setIsDeleteDialogOpen(false)
      setSelectedPillar(null)
      loadPillars()
      loadRollup()
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete pillar'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRollupForPillar = (pillarId: string): PillarRollup | undefined => {
    return rollup.find(r => r.pillarId === pillarId)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer>
          <PageHeader
            title="Strategic Pillars"
            description="Manage strategic pillars that group your OKRs"
          >
            {canEdit && (
              <Button onClick={handleCreate} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Pillar
              </Button>
            )}
          </PageHeader>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading pillars...</div>
          ) : pillars.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No pillars yet — create your first pillar to group strategic outcomes.</p>
              {canEdit && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Pillar
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Objectives</TableHead>
                    <TableHead>Avg Progress</TableHead>
                    <TableHead>At Risk</TableHead>
                    <TableHead>Updated</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pillars.map((pillar) => {
                    const stats = getRollupForPillar(pillar.id)
                    return (
                      <TableRow key={pillar.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {pillar.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: pillar.color }}
                              />
                            )}
                            <span className="font-medium">{pillar.name}</span>
                          </div>
                          {pillar.description && (
                            <p className="text-sm text-muted-foreground mt-1">{pillar.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {pillar.owner ? (
                            <div className="flex items-center gap-2">
                              <AvatarCircle
                                name={pillar.owner.name || pillar.owner.email}
                                size="sm"
                              />
                              <span className="text-sm">{pillar.owner.name || pillar.owner.email}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{stats?.objectiveCount || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          {stats?.avgProgress !== null && stats?.avgProgress !== undefined ? (
                            <span className="text-sm">{Math.round(stats.avgProgress)}%</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {stats && stats.atRiskCount > 0 ? (
                            <Badge variant="destructive">{stats.atRiskCount}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(pillar.updatedAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(pillar)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(pillar)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Create Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Strategic Pillar</DialogTitle>
                <DialogDescription>
                  Create a new strategic pillar to group related OKRs.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name">Name *</Label>
                  <Input
                    id="create-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Customer Experience"
                    maxLength={100}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="create-description">Description</Label>
                  <Textarea
                    id="create-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="create-color">Color (Hex)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="create-color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      placeholder="#FF5733"
                      maxLength={7}
                    />
                    {formColor && /^#([0-9A-F]{3}){1,2}$/i.test(formColor) && (
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: formColor }}
                      />
                    )}
                  </div>
                  {formErrors.color && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.color}</p>
                  )}
                </div>
                <div>
                  <Label>Owner</Label>
                  <SearchableUserSelect
                    selectedUserId={formOwnerId}
                    onUserSelect={setFormOwnerId}
                    availableUsers={availableUsers}
                    placeholder="Select owner (optional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Strategic Pillar</DialogTitle>
                <DialogDescription>
                  Update pillar details.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Customer Experience"
                    maxLength={100}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-color">Color (Hex)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      placeholder="#FF5733"
                      maxLength={7}
                    />
                    {formColor && /^#([0-9A-F]{3}){1,2}$/i.test(formColor) && (
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: formColor }}
                      />
                    )}
                  </div>
                  {formErrors.color && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.color}</p>
                  )}
                </div>
                <div>
                  <Label>Owner</Label>
                  <SearchableUserSelect
                    selectedUserId={formOwnerId}
                    onUserSelect={setFormOwnerId}
                    availableUsers={availableUsers}
                    placeholder="Select owner (optional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Pillar</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{selectedPillar?.name}"? This will not delete the associated objectives, but they will no longer be linked to this pillar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  disabled={isSubmitting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

