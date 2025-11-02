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
import { useWorkspace } from '@/contexts/workspace.context'
import { Users, Plus, Edit2, Trash2, UserPlus, X, Building2, Briefcase } from 'lucide-react'
import api from '@/lib/api'

export default function TeamsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TeamsSettings />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function TeamsSettings() {
  const { currentWorkspace: workspace, teams: contextTeams, refreshContext, currentOrganization: organization } = useWorkspace()
  const [teams, setTeams] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingTeam, setEditingTeam] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [deletingTeam, setDeletingTeam] = useState<any>(null)
  const [addingMemberToTeam, setAddingMemberToTeam] = useState<any>(null)
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('MEMBER')

  useEffect(() => {
    if (workspace) {
      loadTeams()
    }
  }, [workspace])

  const loadTeams = async () => {
    if (!workspace) {
      console.log('No workspace available for loading teams')
      return
    }

    try {
      console.log('Loading teams for workspace:', workspace.id)
      const res = await api.get(`/teams?workspaceId=${workspace.id}`)
      console.log('Teams loaded:', res.data)
      setTeams(res.data)
    } catch (error) {
      console.error('Failed to load teams:', error)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !workspace) return

    setLoading(true)
    try {
      await api.post('/teams', {
        name: newTeamName,
        workspaceId: workspace.id,
      })
      setNewTeamName('')
      setShowCreate(false)
      await loadTeams()
      await refreshContext()
    } catch (error) {
      console.error('Failed to create team:', error)
      alert('Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  const handleEditTeam = (team: any) => {
    setEditingTeam(team)
    setEditName(team.name)
  }

  const handleSaveEdit = async () => {
    if (!editingTeam || !editName.trim()) return

    setLoading(true)
    try {
      await api.patch(`/teams/${editingTeam.id}`, {
        name: editName,
      })
      setEditingTeam(null)
      await loadTeams()
      await refreshContext()
    } catch (error) {
      console.error('Failed to update team:', error)
      alert('Failed to update team')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!deletingTeam) return

    setLoading(true)
    try {
      await api.delete(`/teams/${deletingTeam.id}`)
      setDeletingTeam(null)
      await loadTeams()
      await refreshContext()
    } catch (error) {
      console.error('Failed to delete team:', error)
      alert('Failed to delete team')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAddMember = async (team: any) => {
    setAddingMemberToTeam(team)
    setSelectedUserId('')
    setSelectedRole('MEMBER')
    
    // Load available users from organization
    if (organization) {
      try {
        const res = await api.get(`/organizations/${organization.id}/members`)
        setAvailableUsers(res.data)
      } catch (error) {
        console.error('Failed to load users:', error)
      }
    }
  }

  const handleAddMember = async () => {
    if (!addingMemberToTeam || !selectedUserId) return

    setLoading(true)
    try {
      await api.post(`/teams/${addingMemberToTeam.id}/members`, {
        userId: selectedUserId,
        role: selectedRole,
      })
      setAddingMemberToTeam(null)
      await loadTeams()
      await refreshContext()
    } catch (error) {
      console.error('Failed to add member:', error)
      alert('Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!confirm('Remove this member from the team?')) return

    setLoading(true)
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`)
      await loadTeams()
      await refreshContext()
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert('Failed to remove member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
            <p className="text-slate-600 mt-1">
              Small groups within the <strong>{workspace?.name}</strong> workspace
            </p>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              <span>{organization?.name}</span>
              <span>→</span>
              <Briefcase className="h-3 w-3" />
              <span>{workspace?.name}</span>
              <span>→</span>
              <Users className="h-3 w-3" />
              <span className="font-medium">Teams</span>
            </div>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} disabled={!workspace}>
            <Plus className="h-4 w-4 mr-2" />
            New Team
          </Button>
        </div>

        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle>Create Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Team Name</Label>
                <Input
                  id="name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Frontend, Backend, Design"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTeam} disabled={loading}>
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
          {!workspace ? (
            <Card>
              <CardContent className="p-6 text-center text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>Please select a workspace first</p>
                <p className="text-sm mt-1">Use the workspace selector at the top of the sidebar.</p>
              </CardContent>
            </Card>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No teams in this workspace yet.</p>
                <p className="text-sm mt-1">Create your first team to organize people and OKRs.</p>
              </CardContent>
            </Card>
          ) : (
            teams.map((team) => (
              <Card key={team.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {team.name}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">
                        In {workspace.name} workspace
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAddMember(team)}
                        title="Add member"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTeam(team)}
                        title="Edit team"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingTeam(team)}
                        title="Delete team"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-slate-600">
                      {(team as any).members?.length || 0} members
                    </div>
                    {(team as any).members && (team as any).members.length > 0 && (
                      <div className="space-y-2">
                        {(team as any).members.map((member: any) => (
                          <div key={member.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                                {member.user.name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{member.user.name}</div>
                                <div className="text-xs text-slate-500">{member.role}</div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(team.id, member.userId)}
                              title="Remove from team"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team</DialogTitle>
              <DialogDescription>
                Update the team name
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Team Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Frontend, Backend, Design"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTeam(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Member Dialog */}
        <Dialog open={!!addingMemberToTeam} onOpenChange={() => setAddingMemberToTeam(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add a person to {addingMemberToTeam?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user">Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="TEAM_LEAD">Team Lead</SelectItem>
                    <SelectItem value="WORKSPACE_ADMIN">Workspace Admin</SelectItem>
                    <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddingMemberToTeam(null)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember} disabled={loading || !selectedUserId}>
                {loading ? 'Adding...' : 'Add Member'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingTeam} onOpenChange={() => setDeletingTeam(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Team</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingTeam?.name}</strong>?
                This will remove all members and unassign any OKRs. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTeam}
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

