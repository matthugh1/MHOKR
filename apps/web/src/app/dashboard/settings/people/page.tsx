'use client'

import { useEffect, useState, useMemo } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
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
import { UserCog, X, Plus, Edit2, Key, Building2, Briefcase, Users, UserCheck, Search, Info, Shield, Lock, Eye } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { useToast } from '@/hooks/use-toast'
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions'
import { usePermissions } from '@/hooks/usePermissions'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

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
  const [showEditRightsOnly, setShowEditRightsOnly] = useState(false)
  
  // Selected user for editing in drawer
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // Effective permissions for selected user
  const { data: effectivePermissions, loading: permissionsLoading } = useEffectivePermissions(
    selectedUser?.id,
    organization?.id,
    workspace?.id,
  )
  
  const permissions = usePermissions()
  const featureFlags = useFeatureFlags()
  
  // RBAC Inspector toggle state
  const [inspectorEnabled, setInspectorEnabled] = useState<boolean | null>(null)
  const [togglingInspector, setTogglingInspector] = useState(false)
  
  // User creation
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [devInspectorMode, setDevInspectorMode] = useState(false)
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
      organizationId: organization?.id || '', // Always set to current context for SUPERUSER
      workspaceId: workspace?.id || '',
      role: 'MEMBER' as 'ORG_ADMIN' | 'MEMBER' | 'VIEWER',
      workspaceRole: 'MEMBER' as 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER'
    })
    setDevInspectorMode(false)
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

    // Validate tenant context or explicit selection
    if (!organization && !newUserData.organizationId && !devInspectorMode) {
      toast({
        variant: 'destructive',
        title: 'Missing tenant context',
        description: 'No active tenant context available. Please select an organisation.',
      })
      return
    }

    // For dev inspector mode, require explicit organisation
    if (devInspectorMode && !newUserData.organizationId) {
      toast({
        variant: 'destructive',
        title: 'Missing organisation',
        description: 'Developer mode requires an organisation to be selected.',
      })
      return
    }

    setActionLoading(true)
    const userName = newUserData.name
    try {
      // Build payload - only include organisationId if dev inspector mode or explicitly set
      const payload: any = {
        name: newUserData.name,
        email: newUserData.email,
        password: newUserData.password,
        role: newUserData.role,
      }

      // SUPERUSER always needs to send organisationId (backend has no tenant context)
      // For regular users, only send if dev inspector mode or no context
      if (isSuperuser) {
        // SUPERUSER: Always send organizationId from form or current context
        const orgId = newUserData.organizationId || organization?.id
        if (!orgId) {
          toast({
            variant: 'destructive',
            title: 'Missing organisation',
            description: 'Please select an organisation to create the user in.',
          })
          setActionLoading(false)
          return
        }
        payload.organizationId = orgId
      } else if (devInspectorMode || !organization) {
        // Regular user: Send only if dev inspector mode or no context
        const orgId = newUserData.organizationId || organization?.id
        if (orgId) {
          payload.organizationId = orgId
        }
      }
      // Otherwise, backend will auto-inject from req.user.organizationId
      // Only send workspaceId if provided
      if (newUserData.workspaceId) {
        payload.workspaceId = newUserData.workspaceId
        payload.workspaceRole = newUserData.workspaceRole
      }

      await api.post('/users', payload)
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

  const handleUserClick = async (user: any) => {
    setSelectedUser(user)
    setDrawerOpen(true)
    // Fetch user's inspector setting if caller has manage_users
    if (permissions.canInviteMembers({ organizationId: organization?.id })) {
      try {
        const res = await api.get(`/users/${user.id}`)
        const settings = res.data?.settings as any
        setInspectorEnabled(settings?.debug?.rbacInspectorEnabled === true)
      } catch (error) {
        console.error('Failed to fetch inspector state:', error)
        setInspectorEnabled(false)
      }
    } else {
      setInspectorEnabled(false)
    }
  }

  const handleToggleInspector = async () => {
    if (!selectedUser || togglingInspector) return
    
    setTogglingInspector(true)
    try {
      const newState = !inspectorEnabled
      await api.post('/rbac/inspector/enable', {
        userId: selectedUser.id,
        enabled: newState,
      })
      setInspectorEnabled(newState)
      toast({
        variant: 'success',
        title: 'RBAC Inspector updated',
        description: `RBAC Inspector ${newState ? 'enabled' : 'disabled'} for ${selectedUser.name}.`,
      })
    } catch (error: any) {
      console.error('Failed to toggle inspector:', error)
      toast({
        variant: 'destructive',
        title: 'Failed to update',
        description: error.response?.data?.message || 'Failed to toggle RBAC Inspector',
      })
    } finally {
      setTogglingInspector(false)
    }
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

  // Helper to get governance status for a user
  const getGovernanceStatus = useMemo(() => {
    return (user: any, perms?: typeof effectivePermissions): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
      if (user?.isSuperuser || perms?.isSuperuser) {
        return { label: 'Read-only (Superuser)', variant: 'secondary' }
      }
      // Check for locked cycles (if we had that data, we'd show count here)
      // For now, just show "Normal" vs "Read-only (Superuser)"
      return { label: 'Normal', variant: 'default' }
    }
  }, [])

  // Filter people based on search query and edit rights filter
  const filteredPeople = useMemo(() => {
    let filtered = people
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((person) => 
        person.name?.toLowerCase().includes(query) ||
        person.email?.toLowerCase().includes(query) ||
        person.orgRole?.toLowerCase().includes(query) ||
        person.workspaceRole?.toLowerCase().includes(query)
      )
    }
    
    // Apply edit rights filter (if enabled)
    if (showEditRightsOnly) {
      // This would ideally check effective permissions, but for now we use role-based heuristics
      filtered = filtered.filter((person) => {
        const hasEditRole = person.orgRole?.includes('ADMIN') || 
                           person.orgRole?.includes('OWNER') ||
                           person.workspaceRole?.includes('LEAD') ||
                           person.workspaceRole?.includes('ADMIN') ||
                           person.workspaceRole?.includes('OWNER')
        return hasEditRole && !person.isSuperuser
      })
    }
    
    return filtered
  }, [people, searchQuery, showEditRightsOnly])

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
      <PageContainer variant="form">
        <PageHeader
          title="People"
          subtitle="Manage users and their roles"
        />
        <div className="text-center py-12">
          <p className="text-slate-600">Please select a workspace or organization to view people.</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer variant="form">
      <PageHeader
        title="People"
        subtitle={workspace ? `Manage users in ${workspace.name}` : organization ? `Manage users in ${organization.name}` : 'Manage users and their roles'}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Button onClick={() => setShowCreateUser(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Search Bar and Quick Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editRightsFilter"
              checked={showEditRightsOnly}
              onChange={(e) => setShowEditRightsOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label htmlFor="editRightsFilter" className="cursor-pointer text-sm">
              Show users with edit rights
            </Label>
          </div>
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
          if (open) {
            // Initialize form with current context when dialog opens
            setNewUserData({ 
              name: '', 
              email: '', 
              password: '',
              organizationId: organization?.id || '',
              workspaceId: workspace?.id || '',
              role: 'MEMBER' as 'ORG_ADMIN' | 'MEMBER' | 'VIEWER',
              workspaceRole: 'MEMBER' as 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER'
            })
            setDevInspectorMode(false)
          } else {
            // Reset form when dialog closes
            resetUserForm()
          }
        }}>
          <DialogContent className="max-w-2xl" aria-describedby="create-user-description">
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription id="create-user-description">
                Create a new user account. An invitation will be sent to this address if required by your configuration.
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
                    <p className="text-xs text-slate-500 mt-1">
                      An invitation will be sent to this address if required by your configuration.
                    </p>
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

                {/* Tenant Context - Auto-detected or Manual Selection */}
                {organization && !devInspectorMode && !isSuperuser ? (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-600" />
                      <div>
                        <Label className="text-xs text-slate-600">Tenant (auto-detected)</Label>
                        <p className="text-sm font-medium text-slate-900">{organization.name}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!organization && !devInspectorMode && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-900">
                          No active tenant context — please select a tenant.
                        </p>
                      </div>
                    )}
                    {organization && !devInspectorMode && isSuperuser && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-900">
                          Using current organisation: <strong>{organization.name}</strong>
                        </p>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="organization">Organisation *</Label>
                      <Select 
                        value={newUserData.organizationId || organization?.id || ''} 
                        onValueChange={async (v) => {
                          setNewUserData({ 
                            ...newUserData, 
                            organizationId: v, 
                            workspaceId: '',
                            workspaceRole: 'MEMBER'
                          })
                          // Load workspaces for selected organisation
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
                        <SelectTrigger id="organization">
                          <SelectValue placeholder="Select organisation" />
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
                  </div>
                )}

                {/* Developer Inspector Toggle - Only for SUPERUSER with rbacInspector enabled */}
                {isSuperuser && currentUser?.features?.rbacInspector && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="dev-inspector-toggle" className="font-normal cursor-pointer">
                          Developer mode: cross-tenant creation
                        </Label>
                        <p className="text-xs text-purple-700 mt-1">
                          Enable to create users in different tenants (requires Developer Inspector).
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        id="dev-inspector-toggle"
                        checked={devInspectorMode}
                        onChange={(e) => {
                          setDevInspectorMode(e.target.checked)
                          if (!e.target.checked) {
                            // Reset to auto-context when disabling
                            setNewUserData({ ...newUserData, organizationId: organization?.id || '' })
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </div>
                  </div>
                )}

                {/* Workspace Selection - Optional and Hidden if None */}
                {(() => {
                  const availableWorkspacesForTenant = isSuperuser 
                    ? allWorkspaces.filter(w => w.organizationId === (devInspectorMode ? newUserData.organizationId : organization?.id))
                    : workspaces.filter(w => w.organizationId === organization?.id)
                  
                  if (availableWorkspacesForTenant.length === 0) {
                    return null // Hide workspace selector when none exist
                  }
                  
                  return (
                    <div>
                      <Label htmlFor="workspace">Workspace (optional)</Label>
                      <Select 
                        value={newUserData.workspaceId} 
                        onValueChange={(v) => setNewUserData({ ...newUserData, workspaceId: v })}
                        disabled={!organization && !devInspectorMode ? !newUserData.organizationId : false}
                      >
                        <SelectTrigger id="workspace">
                          <SelectValue placeholder="Select workspace (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableWorkspacesForTenant.map((ws) => (
                            <SelectItem key={ws.id} value={ws.id}>
                              {ws.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })()}
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
                  {newUserData.workspaceId && (
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
                  )}
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
                    <TableHead>Roles</TableHead>
                    <TableHead>Effective Permissions</TableHead>
                    <TableHead>Governance</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeople.map((person) => {
                    // Get user's roles grouped by scope (from RBAC assignments)
                    const userRoles = person.rbacRoles || {
                      tenant: person.orgRole ? [{ organizationId: organization?.id || '', roles: [person.orgRole] }] : [],
                      workspace: person.workspaceRole ? [{ workspaceId: workspace?.id || '', roles: [person.workspaceRole] }] : [],
                      team: person.teams?.map((t: any) => ({ teamId: t.id, roles: [t.role || 'MEMBER'] })) || [],
                    }
                    
                    // Calculate effective permissions count (heuristic based on roles)
                    // Full count would require fetching effective permissions for each user
                    let effectiveCount = 0
                    if (person.orgRole?.includes('OWNER')) effectiveCount += 14
                    else if (person.orgRole?.includes('ADMIN')) effectiveCount += 12
                    else if (person.workspaceRole?.includes('LEAD')) effectiveCount += 8
                    else if (person.workspaceRole?.includes('ADMIN')) effectiveCount += 6
                    else effectiveCount += 3
                    
                    const govStatus = getGovernanceStatus(person)
                    
                    return (
                      <TableRow 
                        key={person.id} 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => handleUserClick(person)}
                      >
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell>{person.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {userRoles.tenant.map((t: any, idx: number) => (
                              <TooltipProvider key={`tenant-${idx}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant={getRoleBadgeVariant(t.roles[0])} className="text-xs">
                                      {t.roles[0]}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Tenant: {t.roles.join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                            {userRoles.workspace.map((w: any, idx: number) => (
                              <TooltipProvider key={`workspace-${idx}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant={getRoleBadgeVariant(w.roles[0])} className="text-xs">
                                      {w.roles[0]}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Workspace: {w.roles.join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                            {userRoles.team.slice(0, 2).map((t: any, idx: number) => (
                              <TooltipProvider key={`team-${idx}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="secondary" className="text-xs">
                                      {t.roles[0]}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Team: {t.roles.join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                            {userRoles.team.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{userRoles.team.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {effectiveCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={govStatus.variant}>
                            {govStatus.label}
                          </Badge>
                        </TableCell>
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
                    )
                  })}
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

                  {/* RBAC Insights */}
                  {effectivePermissions && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Roles & Effective Permissions
                      </h3>
                      
                      {/* Roles by Scope */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-medium text-slate-600">Roles by Scope</h4>
                          {permissions.canInviteMembers({ organizationId: organization?.id, workspaceId: workspace?.id }) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // TODO: Open role assignment dialog
                                toast({
                                  variant: 'default',
                                  title: 'Role Assignment',
                                  description: 'Role assignment UI coming soon. Use the existing assignment controls below.',
                                })
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Assign Role
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {effectivePermissions.scopes.map((scope, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium">
                                  {scope.tenantId && (
                                    <span>
                                      Tenant: {scope.tenantId.substring(0, 8)}...
                                      {scope.workspaceId && ` • Workspace: ${scope.workspaceId.substring(0, 8)}...`}
                                      {scope.teamId && ` • Team: ${scope.teamId.substring(0, 8)}...`}
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {scope.effectiveRoles.map((role, rIdx) => (
                                  <Badge key={rIdx} variant={getRoleBadgeVariant(role)} className="text-xs">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                              <div className="text-xs text-slate-600">
                                <span className="font-medium">{scope.actionsAllowed.length}</span> allowed,{' '}
                                <span className="font-medium">{scope.actionsDenied.length}</span> denied
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Effective Actions Grouped by Category */}
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-slate-600 mb-2">Effective Actions</h4>
                        {effectivePermissions.scopes.length > 0 && (
                          <div className="space-y-3">
                            {/* OKR Actions */}
                            <div>
                              <h5 className="text-xs font-medium text-slate-500 mb-1">OKR</h5>
                              <div className="flex flex-wrap gap-1">
                                {['create_okr', 'edit_okr', 'delete_okr', 'publish_okr', 'view_okr', 'view_all_okrs'].map((action) => {
                                  const isAllowed = effectivePermissions.scopes.some(s => s.actionsAllowed.includes(action))
                                  return (
                                    <Badge
                                      key={action}
                                      variant={isAllowed ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {action.replace(/_/g, ' ')}
                                    </Badge>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Governance Actions */}
                            <div>
                              <h5 className="text-xs font-medium text-slate-500 mb-1">Governance</h5>
                              <div className="flex flex-wrap gap-1">
                                {['request_checkin'].map((action) => {
                                  const isAllowed = effectivePermissions.scopes.some(s => s.actionsAllowed.includes(action))
                                  return (
                                    <Badge
                                      key={action}
                                      variant={isAllowed ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {action.replace(/_/g, ' ')}
                                    </Badge>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Admin Actions */}
                            <div>
                              <h5 className="text-xs font-medium text-slate-500 mb-1">Admin</h5>
                              <div className="flex flex-wrap gap-1">
                                {['manage_users', 'manage_workspaces', 'manage_teams', 'manage_tenant_settings', 'export_data', 'manage_billing'].map((action) => {
                                  const isAllowed = effectivePermissions.scopes.some(s => s.actionsAllowed.includes(action))
                                  return (
                                    <Badge
                                      key={action}
                                      variant={isAllowed ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {action.replace(/_/g, ' ')}
                                    </Badge>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Governance Overlays */}
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-slate-600 mb-2">Governance Status</h4>
                        <div className="space-y-2">
                          {effectivePermissions.isSuperuser && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                              <div className="flex items-center gap-2">
                                <Lock className="h-3 w-3 text-amber-600" />
                                <span className="font-medium">Platform Superuser is read-only for OKR content.</span>
                              </div>
                            </div>
                          )}
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                            <div className="flex items-center gap-2">
                              <Info className="h-3 w-3 text-slate-600" />
                              <span>Publish lock applies to published OKRs: only Tenant Owner/Admin can edit or delete.</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Visibility Note */}
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-start gap-2">
                          <Eye className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="text-xs text-blue-900">
                            <p className="font-medium mb-1">Visibility Policy</p>
                            <p>Only PRIVATE OKRs are access-restricted; all other visibility levels (PUBLIC_TENANT, EXEC_ONLY, WORKSPACE_ONLY, etc.) are treated as tenant-visible.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {permissionsLoading && (
                    <div className="text-center py-4 text-sm text-slate-500">
                      Loading permissions...
                    </div>
                  )}

                  {/* Troubleshooting Section - RBAC Inspector Toggle */}
                  {permissions.canInviteMembers({ organizationId: organization?.id }) && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Troubleshooting
                      </h3>
                      <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label htmlFor="rbac-inspector-toggle" className="font-normal cursor-pointer">
                              Enable RBAC Inspector for this user
                            </Label>
                            <p className="text-xs text-slate-500 mt-1">
                              Shows permission reasoning tooltips in production for this user.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            id="rbac-inspector-toggle"
                            checked={inspectorEnabled === true}
                            onChange={handleToggleInspector}
                            disabled={togglingInspector || inspectorEnabled === null}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

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
    </PageContainer>
  )
}