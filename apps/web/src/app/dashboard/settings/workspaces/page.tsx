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
import { useWorkspace } from '@/contexts/workspace.context'
import { Building2, Plus, Edit2, Trash2, Users, Briefcase } from 'lucide-react'
import api from '@/lib/api'

export default function WorkspacesPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <WorkspacesSettings />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function WorkspacesSettings() {
  const { organization, workspaces: contextWorkspaces, refreshContext } = useWorkspace()
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [deletingWorkspace, setDeletingWorkspace] = useState<any>(null)

  useEffect(() => {
    if (contextWorkspaces) {
      setWorkspaces(contextWorkspaces)
    }
  }, [contextWorkspaces])

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || !organization) return

    setLoading(true)
    try {
      await api.post('/workspaces', {
        name: newWorkspaceName,
        organizationId: organization.id,
      })
      setNewWorkspaceName('')
      setShowCreate(false)
      await refreshContext()
    } catch (error) {
      console.error('Failed to create workspace:', error)
      alert('Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleEditWorkspace = (workspace: any) => {
    setEditingWorkspace(workspace)
    setEditName(workspace.name)
  }

  const handleSaveEdit = async () => {
    if (!editingWorkspace || !editName.trim()) return

    setLoading(true)
    try {
      await api.patch(`/workspaces/${editingWorkspace.id}`, {
        name: editName,
      })
      setEditingWorkspace(null)
      await refreshContext()
    } catch (error) {
      console.error('Failed to update workspace:', error)
      alert('Failed to update workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!deletingWorkspace) return

    setLoading(true)
    try {
      await api.delete(`/workspaces/${deletingWorkspace.id}`)
      setDeletingWorkspace(null)
      await refreshContext()
    } catch (error) {
      console.error('Failed to delete workspace:', error)
      alert('Failed to delete workspace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workspaces</h1>
            <p className="text-slate-600 mt-1">
              Workspaces are major departments or divisions in <strong>{organization?.name}</strong>
            </p>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              <span>{organization?.name}</span>
              <span>→</span>
              <Briefcase className="h-3 w-3" />
              <span className="font-medium">Workspaces</span>
              <span>→</span>
              <Users className="h-3 w-3" />
              <span>Teams</span>
            </div>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </Button>
        </div>

        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle>Create Workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g., Engineering, Sales, Marketing"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateWorkspace} disabled={loading}>
                  {loading ? 'Creating...' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {workspaces.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-slate-500">
                <Briefcase className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No workspaces yet.</p>
                <p className="text-sm mt-1">Create your first workspace to organize teams and OKRs.</p>
              </CardContent>
            </Card>
          ) : (
            workspaces.map((workspace) => (
              <Card key={workspace.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        {workspace.name}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">
                        Part of {organization?.name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditWorkspace(workspace)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingWorkspace(workspace)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="h-4 w-4" />
                      <span>{workspace.teams?.length || 0} teams</span>
                    </div>
                    <div className="text-slate-400">•</div>
                    <div className="text-xs text-slate-500">
                      ID: <span className="font-mono">{workspace.id.substring(0, 8)}...</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingWorkspace} onOpenChange={() => setEditingWorkspace(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Workspace</DialogTitle>
              <DialogDescription>
                Update the workspace name
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Workspace Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Engineering, Sales, Marketing"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingWorkspace(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingWorkspace} onOpenChange={() => setDeletingWorkspace(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingWorkspace?.name}</strong>?
                This will also delete all teams and OKRs within this workspace. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteWorkspace}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

