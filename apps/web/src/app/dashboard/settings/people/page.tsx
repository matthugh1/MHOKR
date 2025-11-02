'use client'

import { useEffect, useState, useMemo } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspace } from '@/contexts/workspace.context'
import { UserCog, X, Plus, Edit2, Key, Building2, Briefcase, Users, UserCheck, Search, Info } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { useToast } from '@/hooks/use-toast'

export default function PeoplePage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PeopleSettings />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function PeopleSettings() {
  const { 
    currentWorkspace: workspace, 
    currentOrganization: organization,
    organizations,
    workspaces,
    isSuperuser,
    refreshContext 
  } = useWorkspace()
  
  const { impersonate, impersonating, user: currentUser } = useAuth()
  const { toast } = useToast()
  
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<any[]>([])
  const [allWorkspaces, setAllWorkspaces] = useState<any[]>([])
  const [allOrganizations, setAllOrganizations] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'workspace' | 'organization'>('workspace')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Selected user for editing in drawer
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // User creation
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUserData, setNewUserData] = useState({ 
    name: '', 
    email: '', 
    password: '',
    organizationId: '',
    workspaceId: '',
    role: 'MEMBER' as 'ORG_ADMIN' | 'MEMBER' | 'VIEWER',
    workspaceRole: 'MEMBER' as 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER'
  })
  
  // Member assignment states
  const [assigningToOrg, setAssigningToOrg] = useState(false)
  const [assigningToWorkspace, setAssigningToWorkspace] = useState(false)
  const [assigningToTeam, setAssigningToTeam] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedRole, setSelectedRole] = useState('MEMBER')
  const [availableWorkspacesForOrg, setAvailableWorkspacesForOrg] = useState<any[]>([])
  
  // Password reset
  const [resettingPassword, setResettingPassword] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadAllData()
  }, [workspace, organization, viewMode])

  const loadAllData = async () => {
    if (isSuperuser) {
      // Load all organizations and workspaces for superuser
      try {
        const [orgsRes, workspacesRes] = await Promise.all([
          api.get('/organizations'),
          organization ? api.get(`/workspaces?organizationId=${organization.id}`) : Promise.resolve({ data: [] })
        ])
        setAllOrganizations(orgsRes.data || [])
        setAllWorkspaces(workspacesRes.data || [])
      } catch (error) {
        console.error('Failed to load superuser data:', error)
      }
    }
    
    if (workspace || organization) {
      loadPeople()
      if (workspace) {
        loadTeams()
      }
    }
  }

  const loadPeople = async () => {
    setLoading(true)
    if (viewMode === 'workspace' && workspace) {
      try {
        const res = await api.get(`/workspaces/${workspace.id}/members`)
        setPeople(res.data)
      } catch (error) {
        console.error('Failed to load people:', error)
      } finally {
        setLoading(false)
      }
    } else if (viewMode === 'organization' && organization) {
      try {
        const res = await api.get(`/organizations/${organization.id}/members`)
        setPeople(res.data)
      } catch (error) {
        console.error('Failed to load organization members:', error)
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }

  const loadTeams = async () => {
    if (!workspace) return
    try {
      const res = await api.get(`/teams?workspaceId=${workspace.id}`)
      setTeams(res.data)
    } catch (error) {
      console.error('Failed to load teams:', error)
    }
  }

  const resetUserForm = () => {
    setNewUserData({ 
      name: '', 
      email: '', 
      password: '',
      organizationId: organization?.id || '',
      workspaceId: workspace?.id || '',
      role: 'MEMBER' as 'ORG_ADMIN' | 'MEMBER' | 'VIEWER',
      workspaceRole: 'MEMBER' as 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER'
    })
  }

  const handleCreateUser = async () => {
    if (!newUserData.name.trim() || !newUserData.email.trim() || !newUserData.password.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please fill in all required fields',
      })
      return
    }

    if (!newUserData.organizationId || !newUserData.workspaceId) {
      toast({
        variant: 'destructive',
        title: 'Missing selection',
        description: 'Please select both organization and workspace',
      })
      return
    }

    setActionLoading(true)
    const userName = newUserData.name
    try {
      await api.post('/users', {
        name: newUserData.name,
        email: newUserData.email,
        password: newUserData.password,
        organizationId: newUserData.organizationId,
        workspaceId: newUserData.workspaceId,
        role: newUserData.role,
        workspaceRole: newUserData.workspaceRole,
      })
      resetUserForm()
      setShowCreateUser(false)
      await loadPeople()
      await refreshContext()
      toast({
        variant: 'success',
        title: 'User added',
        description: `${userName} has been successfully added to the system.`,
      })
    } catch (error: any) {
      console.error('Failed to create user:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create user'
      toast({
        variant: 'destructive',
        title: 'Failed to add user',
        description: errorMessage,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUserClick = (user: any) => {
    setSelectedUser(user)
    setDrawerOpen(true)
  }

  const handleAssignToOrg = async () => {
    if (!selectedUser || !selectedOrgId) return
    setActionLoading(true)
    try {
      await api.post(`/organizations/${selectedOrgId}/members`, {
        userId: selectedUser.id,
        role: selectedRole,
      })
      await loadPeople()
      await refreshContext()
      // Refresh drawer data
      const orgRes = await api.get(`/organizations/${selectedOrgId}/members`)
      const updatedUser = orgRes.data.find((u: any) => u.id === selectedUser.id)
      if (updatedUser) {
        setSelectedUser(updatedUser)
      } else {
        // If not found in org members, try to reload user from workspace
        if (workspace) {
          const wsRes = await api.get(`/workspaces/${workspace.id}/members`)
          const wsUser = wsRes.data.find((u: any) => u.id === selectedUser.id)
          if (wsUser) setSelectedUser(wsUser)
        }
      }
      setAssigningToOrg(false)
      setSelectedOrgId('')
      setSelectedRole('MEMBER')
    } catch (error) {
      console.error('Failed to add to organization:', error)
      alert('Failed to add to organization')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssignToWorkspace = async () => {
    if (!selectedUser || !selectedWorkspaceId) return
    setActionLoading(true)
    try {
      await api.post(`/workspaces/${selectedWorkspaceId}/members`, {
        userId: selectedUser.id,
        role: selectedRole,
      })
      await loadPeople()
      await refreshContext()
      setAssigningToWorkspace(false)
      setSelectedWorkspaceId('')
      setSelectedRole('MEMBER')
      toast({
        variant: 'success',
        title: 'User added',
        description: `${selectedUser?.name} has been added to the workspace.`,
      })
    } catch (error: any) {
      console.error('Failed to add to workspace:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add to workspace'
      toast({
        variant: 'destructive',
        title: 'Failed to add user',
        description: errorMessage,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssignToTeam = async () => {
    if (!selectedUser || !selectedTeamId) return
    setActionLoading(true)
    try {
      await api.post(`/teams/${selectedTeamId}/members`, {
        userId: selectedUser.id,
        role: selectedRole,
      })
      await loadPeople()
      setAssigningToTeam(false)
      setSelectedTeamId('')
      setSelectedRole('MEMBER')
      toast({
        variant: 'success',
        title: 'User added',
        description: `${selectedUser?.name} has been added to the team.`,
      })
    } catch (error: any) {
      console.error('Failed to add to team:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add to team'
      toast({
        variant: 'destructive',
        title: 'Failed to add user',
        description: errorMessage,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveFromOrg = async (orgId: string) => {
    if (!confirm('Remove this user from the organization?')) return
    setActionLoading(true)
    try {
      await api.delete(`/organizations/${orgId}/members/${selectedUser.id}`)
      await loadPeople()
      await refreshContext()
      setSelectedUser(null)
      setDrawerOpen(false)
      toast({
        variant: 'success',
        title: 'User removed',
        description: `${selectedUser?.name} has been removed from the organization.`,
      })
    } catch (error: any) {
      console.error('Failed to remove from organization:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove from organization'
      toast({
        variant: 'destructive',
        title: 'Failed to remove user',
        description: errorMessage,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveFromWorkspace = async (workspaceId: string) => {
    if (!confirm('Remove this user from the workspace?')) return
    setActionLoading(true)
    try {
      await api.delete(`/workspaces/${workspaceId}/members/${selectedUser.id}`)
      await loadPeople()
      await refreshContext()
      toast({
        variant: 'success',
        title: 'User removed',
        description: `${selectedUser?.name} has been removed from the workspace.`,
      })
    } catch (error: any) {
      console.error('Failed to remove from workspace:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove from workspace'
      toast({
        variant: 'destructive',
        title: 'Failed to remove user',
        description: errorMessage,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveFromTeam = async (teamId: string) => {
    if (!confirm('Remove this user from the team?')) return
    setActionLoading(true)
    try {
      await api.delete(`/teams/${teamId}/members/${selectedUser.id}`)
      await loadPeople()
      toast({
        variant: 'success',
        title: 'User removed',
        description: `${selectedUser?.name} has been removed from the team.`,
      })
    } catch (error: any) {
      console.error('Failed to remove from team:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove from team'
      toast({
        variant: 'destructive',
        title: 'Failed to remove user',
        description: errorMessage,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resettingPassword || !newPassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Password required',
        description: 'Please enter a new password',
      })
      return
    }
    if (newPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 8 characters long',
      })
      return
    }
    setActionLoading(true)
    try {
      await api.post(`/users/${resettingPassword.id}/reset-password`, { password: newPassword })
      setResettingPassword(null)
      setNewPassword('')
      toast({
        variant: 'success',
        title: 'Password reset',
        description: `Password has been reset for ${resettingPassword.name}.`,
      })
    } catch (error: any) {
      console.error('Failed to reset password:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reset password'
      toast({
        variant: 'destructive',
        title: 'Failed to reset password',
        description: errorMessage,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    if (role?.includes('ADMIN') || role?.includes('OWNER') || role?.includes('LEAD')) {
      return 'default'
    }
    return 'secondary'
  }

  const getAvailableWorkspaces = async (orgId?: string) => {
    const targetOrgId = orgId || selectedOrgId || organization?.id
    if (isSuperuser && targetOrgId) {
      try {
        const res = await api.get(`/workspaces?organizationId=${targetOrgId}`)
        return res.data || []
      } catch (error) {
        console.error('Failed to load workspaces:', error)
        return []
      }
    }
    return workspaces.filter(w => !organization || w.organizationId === organization.id)
  }

  const getAvailableOrganizations = () => {
    if (isSuperuser) {
      return allOrganizations.length > 0 ? allOrganizations : organizations
    }
    return organizations
  }

  // Filter people based on search query
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people
    
    const query = searchQuery.toLowerCase()
    return people.filter((person) => 
      person.name?.toLowerCase().includes(query) ||
      person.email?.toLowerCase().includes(query) ||
      person.orgRole?.toLowerCase().includes(query) ||
      person.workspaceRole?.toLowerCase().includes(query)
    )
  }, [people, searchQuery])

  // Role descriptions for tooltips
  const roleDescriptions = {
    'ORG_ADMIN': 'Can manage organization settings, members, and all workspaces within the organization.',
    'MEMBER': 'Can view and contribute to organization content. Full access to assigned workspaces.',
    'VIEWER': 'Read-only access. Can view organization content but cannot make changes.',
    'WORKSPACE_OWNER': 'Full control over workspace settings, members, and all OKRs within this workspace.',
    'WORKSPACE_ADMIN': 'Can manage workspace members and settings, create and edit OKRs.',
    'TEAM_LEAD': 'Can manage team members and team-level OKRs.',
  }

  if (!workspace && !organization) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">People</h1>
            <p className="text-slate-600">Please select a workspace or organization to view people.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">People</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              {organization && (
                <>
                  <Building2 className="h-4 w-4" />
                  <span>{organization.name}</span>
                </>
              )}
              {workspace && (
                <>
                  <span>→</span>
                  <Briefcase className="h-4 w-4" />
                  <span>{workspace.name}</span>
                </>
              )}
            </div>
          </div>
          <Button onClick={() => setShowCreateUser(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* View Mode Toggle */}
        {organization && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'workspace' | 'organization')}>
            <TabsList>
              <TabsTrigger value="workspace" disabled={!workspace}>
                Workspace View
              </TabsTrigger>
              <TabsTrigger value="organization">
                Organization View
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Create User Dialog */}
        <Dialog open={showCreateUser} onOpenChange={(open) => {
          setShowCreateUser(open)
          if (!open) {
            // Reset form when dialog closes
            resetUserForm()
          }
        }}>
          <DialogContent className="max-w-2xl" aria-describedby="create-user-description">
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription id="create-user-description">
                Create a new user account and assign them to an organization and workspace
              </DialogDescription>
            </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Enter initial password"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="organization">Organization *</Label>
                    <Select 
                      value={newUserData.organizationId} 
                      onValueChange={async (v) => {
                        setNewUserData({ 
                          ...newUserData, 
                          organizationId: v, 
                          workspaceId: '',
                          workspaceRole: 'MEMBER' // Reset workspace role when organization changes
                        })
                        // Load workspaces for selected organization
                        if (isSuperuser && v) {
                          try {
                            const res = await api.get(`/workspaces?organizationId=${v}`)
                            setAllWorkspaces(res.data || [])
                          } catch (error) {
                            console.error('Failed to load workspaces:', error)
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableOrganizations().map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="workspace">Workspace *</Label>
                    <Select 
                      value={newUserData.workspaceId} 
                      onValueChange={(v) => setNewUserData({ ...newUserData, workspaceId: v })}
                      disabled={!newUserData.organizationId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {(isSuperuser ? allWorkspaces : workspaces)
                          .filter(w => w.organizationId === newUserData.organizationId)
                          .map((ws) => (
                            <SelectItem key={ws.id} value={ws.id}>
                              {ws.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="org-role">Organization Role</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-slate-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{roleDescriptions[newUserData.role as keyof typeof roleDescriptions] || 'Select a role to see description'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select 
                      value={newUserData.role} 
                      onValueChange={(v: any) => setNewUserData({ ...newUserData, role: v })}
                    >
                      <SelectTrigger id="org-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="ORG_ADMIN">Admin</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="workspace-role">Workspace Role</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-slate-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{roleDescriptions[newUserData.workspaceRole as keyof typeof roleDescriptions] || 'Select a role to see description'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select 
                      value={newUserData.workspaceRole} 
                      onValueChange={(v: any) => setNewUserData({ ...newUserData, workspaceRole: v })}
                    >
                      <SelectTrigger id="workspace-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="WORKSPACE_OWNER">Owner</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowCreateUser(false)
                  resetUserForm()
                }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={actionLoading}>
                  {actionLoading ? 'Adding...' : 'Add User'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        {/* People Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              {viewMode === 'workspace' ? 'Workspace Members' : 'Organization Members'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-slate-600 py-8 text-center">Loading...</div>
            ) : filteredPeople.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {searchQuery ? 'No members match your search' : 'No members found'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeople.map((person) => (
                    <TableRow 
                      key={person.id} 
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => handleUserClick(person)}
                    >
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>{person.email}</TableCell>
                      <TableCell>
                        {person.orgRole && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={getRoleBadgeVariant(person.orgRole)}>
                                  {person.orgRole}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{roleDescriptions[person.orgRole as keyof typeof roleDescriptions] || person.orgRole}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        {person.workspaceRole && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={getRoleBadgeVariant(person.workspaceRole)}>
                                  {person.workspaceRole}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{roleDescriptions[person.workspaceRole as keyof typeof roleDescriptions] || person.workspaceRole}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {person.teams?.slice(0, 2).map((team: any) => (
                            <Badge key={team.id} variant="secondary" className="text-xs">
                              {team.name}
                            </Badge>
                          ))}
                          {person.teams?.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{person.teams.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUserClick(person)
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* User Details Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {selectedUser && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                      {selectedUser.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <div>{selectedUser.name}</div>
                      <div className="text-sm font-normal text-slate-500">{selectedUser.email}</div>
                    </div>
                  </SheetTitle>
                  <SheetDescription>
                    Manage user memberships and settings
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">User Information</h3>
                    <div className="space-y-2">
                      <div>
                        <Label>Name</Label>
                        <Input value={selectedUser.name} disabled />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input value={selectedUser.email} disabled />
                      </div>
                      {isSuperuser && !impersonating && selectedUser.id !== currentUser?.id && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Switch to view as ${selectedUser.name}? You will see the application from their perspective.`)) {
                              impersonate(selectedUser.id)
                            }
                          }}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Switch to This User
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResettingPassword(selectedUser)}
                        className="w-full"
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Reset Password
                      </Button>
                    </div>
                  </div>

                  {/* Organization Memberships */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Organizations
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setAssigningToOrg(true)
                          setSelectedOrgId(organization?.id || '')
                          setSelectedRole('MEMBER')
                          // Load workspaces for all organizations if superuser
                          if (isSuperuser) {
                            const orgs = getAvailableOrganizations()
                            // Load workspaces for first org as default
                            if (orgs.length > 0) {
                              const workspaces = await getAvailableWorkspaces(orgs[0].id)
                              setAvailableWorkspacesForOrg(workspaces)
                            }
                          }
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    {selectedUser.orgRole ? (
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant={getRoleBadgeVariant(selectedUser.orgRole)}>
                            {organization?.name || 'Organization'} - {selectedUser.orgRole}
                          </Badge>
                        </div>
                        {organization && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromOrg(organization.id)}
                            disabled={actionLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No organization memberships</p>
                    )}
                  </div>

                  {/* Workspace Memberships */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Workspaces
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setAssigningToWorkspace(true)
                          setSelectedWorkspaceId(workspace?.id || '')
                          setSelectedRole('MEMBER')
                          // Load workspaces for organization if superuser
                          if (isSuperuser && organization) {
                            const workspaces = await getAvailableWorkspaces(organization.id)
                            setAvailableWorkspacesForOrg(workspaces)
                          }
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    {selectedUser.workspaceRole ? (
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant={getRoleBadgeVariant(selectedUser.workspaceRole)}>
                            {workspace?.name || 'Workspace'} - {selectedUser.workspaceRole}
                          </Badge>
                        </div>
                        {workspace && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromWorkspace(workspace.id)}
                            disabled={actionLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No workspace memberships</p>
                    )}
                  </div>

                  {/* Team Memberships */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Teams
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAssigningToTeam(true)
                          setSelectedTeamId('')
                          setSelectedRole('MEMBER')
                        }}
                        disabled={!workspace}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    {selectedUser.teams && selectedUser.teams.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.teams.map((team: any) => (
                          <div key={team.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <Badge variant="secondary">{team.name} - {team.role}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFromTeam(team.id)}
                              disabled={actionLoading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No team memberships</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Assign to Organization Dialog */}
        <Dialog open={assigningToOrg} onOpenChange={setAssigningToOrg}>
          <DialogContent aria-describedby="assign-org-description">
            <DialogHeader>
              <DialogTitle>Add to Organization</DialogTitle>
              <DialogDescription id="assign-org-description">
                Add {selectedUser?.name} to an organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="assign-org-select">Select Organization</Label>
                <Select 
                  value={selectedOrgId} 
                  onValueChange={async (orgId) => {
                    setSelectedOrgId(orgId)
                    // Load workspaces for selected organization
                    if (isSuperuser && orgId) {
                      const workspaces = await getAvailableWorkspaces(orgId)
                      setAvailableWorkspacesForOrg(workspaces)
                    }
                  }}
                >
                  <SelectTrigger id="assign-org-select">
                    <SelectValue placeholder="Choose an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableOrganizations().map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="assign-org-role">Role</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{roleDescriptions[selectedRole as keyof typeof roleDescriptions] || 'Select a role to see description'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="assign-org-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ORG_ADMIN">Admin</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssigningToOrg(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignToOrg} disabled={actionLoading || !selectedOrgId}>
                {actionLoading ? 'Adding...' : 'Add to Organization'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign to Workspace Dialog */}
        <Dialog open={assigningToWorkspace} onOpenChange={setAssigningToWorkspace}>
          <DialogContent aria-describedby="assign-workspace-description">
            <DialogHeader>
              <DialogTitle>Add to Workspace</DialogTitle>
              <DialogDescription id="assign-workspace-description">
                Add {selectedUser?.name} to a workspace
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="assign-workspace-select">Select Workspace</Label>
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger id="assign-workspace-select">
                    <SelectValue placeholder="Choose a workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {(isSuperuser && selectedOrgId 
                      ? availableWorkspacesForOrg 
                      : workspaces.filter(w => !organization || w.organizationId === organization.id)).map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="assign-workspace-role">Role</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{roleDescriptions[selectedRole as keyof typeof roleDescriptions] || 'Select a role to see description'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="assign-workspace-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="WORKSPACE_OWNER">Owner</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssigningToWorkspace(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignToWorkspace} disabled={actionLoading || !selectedWorkspaceId}>
                {actionLoading ? 'Adding...' : 'Add to Workspace'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign to Team Dialog */}
        <Dialog open={assigningToTeam} onOpenChange={setAssigningToTeam}>
          <DialogContent aria-describedby="assign-team-description">
            <DialogHeader>
              <DialogTitle>Add to Team</DialogTitle>
              <DialogDescription id="assign-team-description">
                Add {selectedUser?.name} to a team in this workspace
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
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
              <Button variant="outline" onClick={() => setAssigningToTeam(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignToTeam} disabled={actionLoading || !selectedTeamId}>
                {actionLoading ? 'Adding...' : 'Add to Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={!!resettingPassword} onOpenChange={() => setResettingPassword(null)}>
          <DialogContent aria-describedby="reset-password-description">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription id="reset-password-description">
                Set a new password for {resettingPassword?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResettingPassword(null)}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={actionLoading}>
                {actionLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}