'use client'

/**
 * Role Management Component
 * 
 * Admin UI for managing user roles at tenant, workspace, and team levels.
 */

import { useState, useEffect } from 'react'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Building2, 
  Briefcase, 
  Users, 
  UserPlus, 
  Trash2,
} from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

type Role = 
  | 'TENANT_OWNER' | 'TENANT_ADMIN' | 'TENANT_VIEWER'
  | 'WORKSPACE_LEAD' | 'WORKSPACE_ADMIN' | 'WORKSPACE_MEMBER'
  | 'TEAM_LEAD' | 'TEAM_CONTRIBUTOR' | 'TEAM_VIEWER'

type ScopeType = 'TENANT' | 'WORKSPACE' | 'TEAM'

interface RoleAssignment {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: Role
  scopeType: ScopeType
  scopeId: string
  scopeName: string
}

export function RoleManagement() {
  const { currentOrganization, currentWorkspace, workspaces, teams } = useWorkspace()
  const { toast } = useToast()
  
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScope, setSelectedScope] = useState<ScopeType>('TENANT')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [newAssignment, setNewAssignment] = useState({
    userEmail: '',
    role: '' as Role | '',
    scopeId: '',
  })

  useEffect(() => {
    loadRoleAssignments()
  }, [currentOrganization?.id, selectedScope])

  const loadRoleAssignments = async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      // Load role assignments based on selected scope
      const scopeId = selectedScope === 'TENANT' 
        ? currentOrganization.id
        : selectedScope === 'WORKSPACE'
        ? currentWorkspace?.id || ''
        : ''

      if (!scopeId && selectedScope !== 'TENANT') {
        setLoading(false)
        return
      }

      const response = await api.get(`/rbac/assignments?scopeType=${selectedScope}&scopeId=${scopeId}`)
      setRoleAssignments(response.data)
    } catch (error) {
      console.error('Failed to load role assignments:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load role assignments',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAssignRole = async () => {
    if (!newAssignment.userEmail || !newAssignment.role || !newAssignment.scopeId) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please fill in all fields',
      })
      return
    }

    try {
      await api.post('/rbac/assignments/assign', {
        userEmail: newAssignment.userEmail,
        role: newAssignment.role,
        scopeType: selectedScope,
        scopeId: newAssignment.scopeId,
      })

      toast({
        title: 'Success',
        description: 'Role assigned successfully',
      })

      setAssignDialogOpen(false)
      setNewAssignment({ userEmail: '', role: '', scopeId: '' })
      loadRoleAssignments()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to assign role',
      })
    }
  }

  const handleRevokeRole = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to revoke this role?')) {
      return
    }

    try {
      await api.delete(`/rbac/assignments/${assignmentId}`)

      toast({
        title: 'Success',
        description: 'Role revoked successfully',
      })

      loadRoleAssignments()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Failed to revoke role',
      })
    }
  }

  const getRoleBadgeVariant = (role: Role) => {
    if (role.includes('OWNER') || role.includes('LEAD')) {
      return 'default'
    }
    if (role.includes('ADMIN')) {
      return 'secondary'
    }
    return 'outline'
  }

  const getScopeOptions = () => {
    switch (selectedScope) {
      case 'TENANT':
        return [{ id: currentOrganization?.id || '', name: currentOrganization?.name || '' }]
      case 'WORKSPACE':
        return workspaces.map(ws => ({ id: ws.id, name: ws.name }))
      case 'TEAM':
        return teams.map(team => ({ id: team.id, name: team.name }))
      default:
        return []
    }
  }

  const getAvailableRoles = (): Role[] => {
    switch (selectedScope) {
      case 'TENANT':
        return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_VIEWER']
      case 'WORKSPACE':
        return ['WORKSPACE_LEAD', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER']
      case 'TEAM':
        return ['TEAM_LEAD', 'TEAM_CONTRIBUTOR', 'TEAM_VIEWER']
      default:
        return []
    }
  }

  if (!currentOrganization) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">No organization selected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Role Management</CardTitle>
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Role</DialogTitle>
                  <DialogDescription>
                    Assign a role to a user at the {selectedScope.toLowerCase()} level
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Scope Type</Label>
                    <Select
                      value={selectedScope}
                      onValueChange={(value) => {
                        setSelectedScope(value as ScopeType)
                        setNewAssignment({ ...newAssignment, scopeId: '' })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TENANT">Tenant</SelectItem>
                        <SelectItem value="WORKSPACE">Workspace</SelectItem>
                        <SelectItem value="TEAM">Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Scope</Label>
                    <Select
                      value={newAssignment.scopeId}
                      onValueChange={(value) => setNewAssignment({ ...newAssignment, scopeId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        {getScopeOptions().map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>User Email</Label>
                    <Input
                      type="email"
                      value={newAssignment.userEmail}
                      onChange={(e) => setNewAssignment({ ...newAssignment, userEmail: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <Label>Role</Label>
                    <Select
                      value={newAssignment.role}
                      onValueChange={(value) => setNewAssignment({ ...newAssignment, role: value as Role })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableRoles().map(role => (
                          <SelectItem key={role} value={role}>
                            {role.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleAssignRole} className="w-full">
                    Assign Role
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={selectedScope === 'TENANT' ? 'default' : 'outline'}
                onClick={() => setSelectedScope('TENANT')}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Tenant
              </Button>
              <Button
                variant={selectedScope === 'WORKSPACE' ? 'default' : 'outline'}
                onClick={() => setSelectedScope('WORKSPACE')}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Workspace
              </Button>
              <Button
                variant={selectedScope === 'TEAM' ? 'default' : 'outline'}
                onClick={() => setSelectedScope('TEAM')}
              >
                <Users className="h-4 w-4 mr-2" />
                Team
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : roleAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No role assignments found</p>
            ) : (
              <div className="space-y-2">
                {roleAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">{assignment.userName}</div>
                        <div className="text-sm text-muted-foreground">{assignment.userEmail}</div>
                      </div>
                      <Badge variant={getRoleBadgeVariant(assignment.role)}>
                        {assignment.role.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        @ {assignment.scopeName}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeRole(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

