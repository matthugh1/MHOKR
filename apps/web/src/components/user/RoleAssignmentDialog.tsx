'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { Info } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface RoleAssignmentDialogProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userName: string
  scopeType: 'TENANT' | 'WORKSPACE' | 'TEAM' | null
  scopeId?: string | null
  currentRole?: string | null
  availableOrganizations?: Array<{ id: string; name: string }>
  availableWorkspaces?: Array<{ id: string; name: string; tenantId: string }>
  availableTeams?: Array<{ id: string; name: string }>
  onSuccess?: () => void
}

const TENANT_ROLES = [
  { value: 'TENANT_OWNER', label: 'Tenant Owner' },
  { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
  { value: 'TENANT_VIEWER', label: 'Tenant Viewer' },
]

const WORKSPACE_ROLES = [
  { value: 'WORKSPACE_LEAD', label: 'Workspace Lead' },
  { value: 'WORKSPACE_ADMIN', label: 'Workspace Admin' },
  { value: 'WORKSPACE_MEMBER', label: 'Workspace Member' },
]

const TEAM_ROLES = [
  { value: 'TEAM_LEAD', label: 'Team Lead' },
  { value: 'TEAM_CONTRIBUTOR', label: 'Team Contributor' },
  { value: 'TEAM_VIEWER', label: 'Team Viewer' },
]

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'TENANT_OWNER': 'Full commercial and operational control over organization. Can bypass publish/cycle locks, manage users/workspaces/teams, export data, manage tenant settings.',
  'TENANT_ADMIN': 'Administrative control within organization. Can bypass locks, manage users/workspaces, export data.',
  'TENANT_VIEWER': 'Read-only access. Can view organization OKRs (subject to visibility rules).',
  'WORKSPACE_LEAD': 'Primary owner of workspace OKRs. Can create, edit, and delete workspace-level OKRs, view all workspace OKRs, manage workspace members.',
  'WORKSPACE_ADMIN': 'Administrative control within workspace. Can create and edit workspace OKRs, manage workspace members.',
  'WORKSPACE_MEMBER': 'Contributor access. Can view workspace OKRs, contribute to OKRs, update key results and submit check-ins.',
  'TEAM_LEAD': 'Owner of team OKRs. Can create, edit, and delete team-level OKRs, view all team OKRs, manage team members.',
  'TEAM_CONTRIBUTOR': 'Contributor access. Can update key results, submit check-ins, view team OKRs.',
  'TEAM_VIEWER': 'Read-only access. Can view team OKRs (subject to visibility rules).',
}

export function RoleAssignmentDialog({
  isOpen,
  onClose,
  userId,
  userName,
  scopeType,
  scopeId: initialScopeId,
  currentRole,
  availableOrganizations = [],
  availableWorkspaces = [],
  availableTeams = [],
  onSuccess,
}: RoleAssignmentDialogProps) {
  const { toast } = useToast()
  const [selectedScopeType, setSelectedScopeType] = useState<'TENANT' | 'WORKSPACE' | 'TEAM' | null>(scopeType)
  const [selectedScopeId, setSelectedScopeId] = useState<string>(initialScopeId || '')
  const [selectedRole, setSelectedRole] = useState<string>(currentRole || '')
  const [loading, setLoading] = useState(false)
  const [filteredWorkspaces, setFilteredWorkspaces] = useState(availableWorkspaces)

  // Determine available roles based on scope type
  const availableRoles = selectedScopeType === 'TENANT' 
    ? TENANT_ROLES 
    : selectedScopeType === 'WORKSPACE' 
    ? WORKSPACE_ROLES 
    : selectedScopeType === 'TEAM'
    ? TEAM_ROLES
    : []

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedScopeType(scopeType)
      setSelectedScopeId(initialScopeId || '')
      const defaultRole = currentRole || (scopeType === 'TENANT' ? TENANT_ROLES[0]?.value : scopeType === 'WORKSPACE' ? WORKSPACE_ROLES[0]?.value : scopeType === 'TEAM' ? TEAM_ROLES[0]?.value : '')
      setSelectedRole(defaultRole)
    }
  }, [isOpen, initialScopeId, currentRole, scopeType])
  
  // Update role when scope type changes
  useEffect(() => {
    if (selectedScopeType && !currentRole) {
      const defaultRole = selectedScopeType === 'TENANT' ? TENANT_ROLES[0]?.value : selectedScopeType === 'WORKSPACE' ? WORKSPACE_ROLES[0]?.value : selectedScopeType === 'TEAM' ? TEAM_ROLES[0]?.value : ''
      setSelectedRole(defaultRole)
    }
  }, [selectedScopeType, currentRole])

  // Filter workspaces when organization changes (for workspace scope)
  useEffect(() => {
    if (scopeType === 'WORKSPACE' && selectedScopeId) {
      // If we're assigning workspace role, selectedScopeId is the workspace ID
      // But if we need to filter by organization, we'd need orgId
      setFilteredWorkspaces(availableWorkspaces)
    }
  }, [scopeType, selectedScopeId, availableWorkspaces])

  const handleSubmit = async () => {
    if (!selectedScopeType || !selectedScopeId || !selectedRole) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please select a scope type, scope, and role',
      })
      return
    }

    setLoading(true)
    try {
      await api.post('/rbac/assignments/assign', {
        userId,
        role: selectedRole,
        scopeType: selectedScopeType,
        scopeId: selectedScopeId,
      })

      toast({
        variant: 'success',
        title: 'Role assigned',
        description: `${userName} has been assigned the ${selectedRole} role.`,
      })

      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error('Failed to assign role:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to assign role'
      toast({
        variant: 'destructive',
        title: 'Failed to assign role',
        description: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  const getScopeLabel = () => {
    switch (selectedScopeType) {
      case 'TENANT':
        return 'Organization'
      case 'WORKSPACE':
        return 'Workspace'
      case 'TEAM':
        return 'Team'
      default:
        return 'Scope'
    }
  }

  const getScopeOptions = () => {
    switch (selectedScopeType) {
      case 'TENANT':
        return availableOrganizations?.map(org => ({ id: org.id, name: org.name })) || []
      case 'WORKSPACE':
        return filteredWorkspaces?.map(ws => ({ id: ws.id, name: ws.name })) || []
      case 'TEAM':
        return availableTeams?.map(team => ({ id: team.id, name: team.name })) || []
      default:
        return []
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentRole ? 'Edit Role Assignment' : 'Assign Role'}
          </DialogTitle>
          <DialogDescription>
            {currentRole 
              ? `Update ${userName}'s ${selectedScopeType?.toLowerCase() || 'role'} assignment`
              : `Assign a role to ${userName}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Scope Type Selection (if not pre-selected) */}
          {!scopeType && (
            <div>
              <Label htmlFor="scope-type-select">Scope Type</Label>
              <Select 
                value={selectedScopeType || ''} 
                onValueChange={(value) => {
                  setSelectedScopeType(value as 'TENANT' | 'WORKSPACE' | 'TEAM')
                  setSelectedScopeId('')
                  setSelectedRole('')
                }}
              >
                <SelectTrigger id="scope-type-select">
                  <SelectValue placeholder="Choose scope type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT">Organization</SelectItem>
                  <SelectItem value="WORKSPACE">Workspace</SelectItem>
                  <SelectItem value="TEAM">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Scope Selection */}
          {selectedScopeType && !initialScopeId && (
            <div>
              <Label htmlFor="scope-select">Select {getScopeLabel()}</Label>
              <Select value={selectedScopeId} onValueChange={setSelectedScopeId}>
                <SelectTrigger id="scope-select">
                  <SelectValue placeholder={`Choose a ${getScopeLabel().toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {getScopeOptions().map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="role-select">Role</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      {selectedRole ? ROLE_DESCRIPTIONS[selectedRole] || 'Select a role to see description' : 'Select a role to see description'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole && ROLE_DESCRIPTIONS[selectedRole] && (
              <p className="text-xs text-slate-500 mt-2">
                {ROLE_DESCRIPTIONS[selectedRole]}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedScopeType || !selectedScopeId || !selectedRole}>
            {loading ? 'Assigning...' : currentRole ? 'Update Role' : 'Assign Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

