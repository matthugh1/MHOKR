'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { Building2, Users, Briefcase, Edit2, Shield, Plus } from 'lucide-react'
import api from '@/lib/api'

export default function OrganizationSettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <OrganizationSettings />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function OrganizationSettings() {
  const { currentOrganization: organization, refreshContext } = useWorkspace()
  const { user } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [allOrganizations, setAllOrganizations] = useState<any[]>([])
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Private whitelist settings
  const [privateWhitelist, setPrivateWhitelist] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [savingWhitelist, setSavingWhitelist] = useState(false)

  useEffect(() => {
    checkSuperuserStatus()
  }, [user])

  useEffect(() => {
    loadOrganizationData()
  }, [organization, isSuperuser])
  
  useEffect(() => {
    loadUsers()
  }, [])
  
  useEffect(() => {
    if (organization) {
      // Load private whitelist from organization metadata
      const org = organization as any
      const metadata = org.metadata
      const whitelist = org.privateWhitelist || metadata?.privateWhitelist || org.execOnlyWhitelist || metadata?.execOnlyWhitelist || []
      setPrivateWhitelist(Array.isArray(whitelist) ? whitelist : [])
    }
  }, [organization])
  
  const loadUsers = async () => {
    try {
      const response = await api.get('/users')
      setAllUsers(response.data || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }
  
  const handleSavePrivateWhitelist = async () => {
    if (!organization) return
    try {
      setSavingWhitelist(true)
      // Update organization with privateWhitelist in metadata
      const org = organization as any
      await api.patch(`/organizations/${organization.id}`, {
        metadata: {
          ...(org.metadata || {}),
          privateWhitelist: privateWhitelist,
        },
        // Also update execOnlyWhitelist for backward compatibility
        execOnlyWhitelist: privateWhitelist,
      })
      await refreshContext()
      // Show success message
      alert('Private OKR whitelist updated successfully')
    } catch (error) {
      console.error('Failed to save whitelist:', error)
      alert('Failed to save whitelist. Please try again.')
    } finally {
      setSavingWhitelist(false)
    }
  }
  
  const toggleUserInWhitelist = (userId: string) => {
    if (privateWhitelist.includes(userId)) {
      setPrivateWhitelist(privateWhitelist.filter(id => id !== userId))
    } else {
      setPrivateWhitelist([...privateWhitelist, userId])
    }
  }

  const checkSuperuserStatus = async () => {
    if (!user) {
      setIsSuperuser(false)
      return
    }

    // Check if user object has isSuperuser flag
    if (user.isSuperuser) {
      setIsSuperuser(true)
      return
    }

    // Also check via API endpoint
    try {
      const response = await api.get('/superuser/check')
      setIsSuperuser(response.data.isSuperuser || false)
    } catch (error) {
      setIsSuperuser(false)
    }
  }

  const loadOrganizationData = async () => {
    if (isSuperuser) {
      // Load all organizations for superuser
      try {
        // Try superuser endpoint first, fallback to regular endpoint
        let orgsRes
        try {
          orgsRes = await api.get('/superuser/organizations')
        } catch (superuserError) {
          // Fallback to regular organizations endpoint (which now respects superuser status)
          console.warn('Superuser endpoint failed, trying regular endpoint:', superuserError)
          orgsRes = await api.get('/organizations')
        }
        
        const organizations = orgsRes.data || []
        setAllOrganizations(organizations)
        
        // If no organization selected, use first one or show all
        if (!organization && organizations.length > 0) {
          // Load data for first organization
          const firstOrg = organizations[0]
          try {
            const [membersRes, workspacesRes] = await Promise.all([
              api.get(`/organizations/${firstOrg.id}/members`),
              api.get(`/workspaces?organizationId=${firstOrg.id}`),
            ])
            console.log('Loaded workspaces for first organization:', firstOrg.id, workspacesRes.data)
            setMembers(membersRes.data || [])
            // Ensure workspaces is always an array
            const workspacesData = Array.isArray(workspacesRes.data) ? workspacesRes.data : []
            console.log('Setting workspaces:', workspacesData)
            setWorkspaces(workspacesData)
          } catch (error: any) {
            console.error('Failed to load data for first organization:', firstOrg.id, error)
            console.error('Error response:', error.response?.data)
            setMembers([])
            setWorkspaces([])
          }
        } else if (organization) {
          // Load data for selected organization
          try {
            const [membersRes, workspacesRes] = await Promise.all([
              api.get(`/organizations/${organization.id}/members`),
              api.get(`/workspaces?organizationId=${organization.id}`),
            ])
            console.log('Loaded workspaces for organization:', organization.id, workspacesRes.data)
            setMembers(membersRes.data || [])
            // Ensure workspaces is always an array
            const workspacesData = Array.isArray(workspacesRes.data) ? workspacesRes.data : []
            console.log('Setting workspaces:', workspacesData)
            setWorkspaces(workspacesData)
          } catch (error: any) {
            console.error('Failed to load data for organization:', organization.id, error)
            console.error('Error response:', error.response?.data)
            setMembers([])
            setWorkspaces([])
          }
        }
      } catch (error: any) {
        console.error('Failed to load superuser organization data:', error)
        console.error('Error details:', error.response?.data || error.message)
        // Still set loading to false so UI doesn't hang
      } finally {
        setLoading(false)
      }
    } else {
      // Regular user flow
      if (!organization) {
        setLoading(false)
        return
      }

      try {
        const [membersRes, workspacesRes] = await Promise.all([
          api.get(`/organizations/${organization.id}/members`),
          api.get(`/workspaces?organizationId=${organization.id}`),
        ])
        setMembers(membersRes.data)
        setWorkspaces(workspacesRes.data)
      } catch (error) {
        console.error('Failed to load organization data:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleEditOrganization = () => {
    if (!organization) return
    setEditName(organization.name)
    setEditSlug(organization.slug)
    setShowEditDialog(true)
  }

  const handleSaveOrganization = async () => {
    if (!organization || !editName.trim() || !editSlug.trim()) return

    setSaving(true)
    try {
      await api.patch(`/organizations/${organization.id}`, {
        name: editName,
        slug: editSlug,
      })
      setShowEditDialog(false)
      await refreshContext()
      await loadOrganizationData()
    } catch (error) {
      console.error('Failed to update organization:', error)
      alert('Failed to update organization')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateOrganization = async () => {
    if (!createName.trim() || !createSlug.trim()) {
      alert('Please fill in both name and slug')
      return
    }

    // Validate slug format (lowercase, alphanumeric, hyphens)
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(createSlug)) {
      alert('Slug must be lowercase, alphanumeric, and can contain hyphens')
      return
    }

    setCreating(true)
    try {
      await api.post('/superuser/organizations', {
        name: createName.trim(),
        slug: createSlug.trim().toLowerCase(),
      })
      setShowCreateDialog(false)
      setCreateName('')
      setCreateSlug('')
      await refreshContext()
      await loadOrganizationData()
    } catch (error: any) {
      console.error('Failed to create organization:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create organization'
      alert(errorMessage)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Organization Settings</h1>
          <div className="text-slate-600">Loading...</div>
        </div>
      </div>
    )
  }

  // Superuser view - show all organizations
  if (isSuperuser && allOrganizations.length > 0) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
              <Badge className="bg-purple-600 text-white flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Superuser
              </Badge>
            </div>
            <p className="text-slate-600 mt-1">System-wide organization management</p>
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-900">
                <strong>Superuser Mode:</strong> You have access to all organizations in the system.
              </p>
            </div>
          </div>

          {/* All Organizations List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  All Organizations ({allOrganizations.length})
                </CardTitle>
                <Button onClick={() => setShowCreateDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Organization
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allOrganizations.map((org) => (
                  <div key={org.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <div className="font-medium">{org.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {org.slug}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <div className="text-slate-500">Workspaces</div>
                        <div className="font-semibold">{org.workspaces?.length || 0}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Members</div>
                        <div className="font-semibold">{org.members?.length || 0}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Organization ID</div>
                        <div className="font-mono text-xs">{org.id}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Create Organization Dialog */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Create a new organization. The slug will be used as a unique identifier.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name-orgs">Organization Name</Label>
                  <Input
                    id="create-name-orgs"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div>
                  <Label htmlFor="create-slug-orgs">Organization Slug</Label>
                  <Input
                    id="create-slug-orgs"
                    value={createSlug}
                    onChange={(e) => setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="acme-corp"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Lowercase, alphanumeric, and hyphens only. Used as a unique identifier.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowCreateDialog(false)
                  setCreateName('')
                  setCreateSlug('')
                }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateOrganization} disabled={creating || !createName.trim() || !createSlug.trim()}>
                  {creating ? 'Creating...' : 'Create Organization'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  // Regular user - no organization
  if (!organization && !isSuperuser) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Organization Settings</h1>
          <Card>
            <CardContent className="p-6">
              <div className="text-slate-600">
                You are not a member of any organization yet. Please contact your administrator.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Regular user - has organization OR superuser viewing specific org
  if (!organization && isSuperuser && allOrganizations.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
            <Badge className="bg-purple-600 text-white flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Superuser
            </Badge>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="text-slate-600">
                  No organizations exist yet. Create your first organization to get started.
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Organization
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Create Organization Dialog */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Create a new organization. The slug will be used as a unique identifier.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name-empty">Organization Name</Label>
                  <Input
                    id="create-name-empty"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div>
                  <Label htmlFor="create-slug-empty">Organization Slug</Label>
                  <Input
                    id="create-slug-empty"
                    value={createSlug}
                    onChange={(e) => setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="acme-corp"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Lowercase, alphanumeric, and hyphens only. Used as a unique identifier.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowCreateDialog(false)
                  setCreateName('')
                  setCreateSlug('')
                }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateOrganization} disabled={creating || !createName.trim() || !createSlug.trim()}>
                  {creating ? 'Creating...' : 'Create Organization'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
            {isSuperuser && (
              <Badge className="bg-purple-600 text-white flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Superuser
              </Badge>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            {isSuperuser ? 'System-wide organization management' : 'Your company-wide settings and structure'}
          </p>
          {isSuperuser && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-900">
                <strong>Superuser Mode:</strong> You have system-wide access to all organizations.
              </p>
            </div>
          )}
          {!isSuperuser && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Hierarchy:</strong> Organization → Workspaces → Teams → People
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Your organization contains multiple workspaces (departments). Each workspace has teams, and each team has members.
              </p>
            </div>
          )}
        </div>

        {/* Organization Overview */}
        {organization && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {organization.name}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleEditOrganization}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-slate-500">Organization ID</div>
                <div className="text-sm font-mono mt-1">{organization.slug}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Workspaces</div>
                <div className="text-2xl font-semibold mt-1">{workspaces.length}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Members</div>
                <div className="text-2xl font-semibold mt-1">{members.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Edit Organization Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
              <DialogDescription>
                Update your organization details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Organization Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label htmlFor="edit-slug">Organization Slug</Label>
                <Input
                  id="edit-slug"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  placeholder="acme-corp"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveOrganization} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Workspaces */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Workspaces (Departments)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workspaces.length === 0 ? (
                <p className="text-sm text-slate-500">No workspaces yet. Create one in the Workspaces section.</p>
              ) : (
                workspaces.map((workspace) => (
                  <div key={workspace.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-slate-500" />
                        <div className="font-medium">{workspace.name}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {workspace.teams?.length || 0} teams
                      </Badge>
                    </div>
                    {workspace.teams && workspace.teams.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {workspace.teams.map((team: any) => (
                          <div key={team.id} className="flex items-center gap-2 text-sm text-slate-600">
                            <Users className="h-3 w-3" />
                            <span>{team.name}</span>
                            <span className="text-xs text-slate-400">
                              ({team.members?.length || 0} members)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Organization Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                      {member.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-slate-500">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {member.teams.map((team: any) => (
                      <Badge key={team.id} variant="secondary">
                        {team.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Private OKR Whitelist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Private OKR Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>Private OKRs:</strong> Users listed here can view OKRs marked as "Private" (HR, Legal, M&A confidential).
                </p>
                <p className="text-xs text-blue-700">
                  The OKR owner and tenant owner can always view private OKRs. This whitelist grants additional users access.
                </p>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {allUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">Loading users...</p>
                ) : (
                  allUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privateWhitelist.includes(u.id)}
                        onChange={() => toggleUserInWhitelist(u.id)}
                        className="rounded border-slate-300"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{u.name || u.email}</div>
                        {u.email && u.name && (
                          <div className="text-xs text-slate-500">{u.email}</div>
                        )}
                      </div>
                      {privateWhitelist.includes(u.id) && (
                        <Badge variant="secondary" className="text-xs">Can view private OKRs</Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-slate-600">
                  {privateWhitelist.length} user{privateWhitelist.length !== 1 ? 's' : ''} selected
                </div>
                <Button 
                  onClick={handleSavePrivateWhitelist} 
                  disabled={savingWhitelist}
                  size="sm"
                >
                  {savingWhitelist ? 'Saving...' : 'Save Whitelist'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

