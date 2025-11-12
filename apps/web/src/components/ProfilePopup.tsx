'use client'

import React from 'react'
import { useAuth } from '@/contexts/auth.context'
import { useWorkspace } from '@/contexts/workspace.context'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Network, Shield, CheckCircle2, Eye } from 'lucide-react'

interface ProfilePopupProps {
  isOpen: boolean
  onClose: () => void
}

const ROLE_DESCRIPTIONS: Record<string, { description: string; permissions: string[] }> = {
  SUPERUSER: {
    description: 'System-wide read-only auditor with access to all tenants',
    permissions: [
      'View all OKRs across all organizations',
      'Cannot create, edit, or delete OKRs',
      'System administration access'
    ]
  },
  TENANT_OWNER: {
    description: 'Full commercial and operational control over your organization',
    permissions: [
      'Create, edit, and delete all OKRs in your organization',
      'Bypass publish and cycle locks',
      'Manage users, workspaces, and teams',
      'Export data and manage organization settings',
      'Full access to all organization features'
    ]
  },
  TENANT_ADMIN: {
    description: 'Administrative control within your organization',
    permissions: [
      'Create, edit, and delete OKRs (can bypass publish/cycle locks)',
      'Manage users, workspaces, and teams',
      'Export data',
      'Access to administrative features'
    ]
  },
  TENANT_VIEWER: {
    description: 'Read-only access to organization OKRs',
    permissions: [
      'View organization OKRs (subject to visibility rules)',
      'Cannot create, edit, or delete OKRs',
      'Read-only access to reports and analytics'
    ]
  },
  WORKSPACE_LEAD: {
    description: 'Primary owner of workspace OKRs',
    permissions: [
      'Create, edit, and delete workspace-level OKRs',
      'View all workspace OKRs',
      'Manage workspace members'
    ]
  },
  WORKSPACE_ADMIN: {
    description: 'Administrative control within workspace',
    permissions: [
      'Create and edit workspace OKRs',
      'Manage workspace members',
      'Administrative access within workspace'
    ]
  },
  WORKSPACE_MEMBER: {
    description: 'Contributor access to workspace OKRs',
    permissions: [
      'View workspace OKRs',
      'Contribute to OKRs',
      'Update key results and submit check-ins'
    ]
  },
  TEAM_LEAD: {
    description: 'Owner of team OKRs',
    permissions: [
      'Create, edit, and delete team-level OKRs',
      'View all team OKRs',
      'Manage team members'
    ]
  },
  TEAM_CONTRIBUTOR: {
    description: 'Contributor access to team OKRs',
    permissions: [
      'Update key results',
      'Submit check-ins',
      'View team OKRs'
    ]
  },
  TEAM_VIEWER: {
    description: 'Read-only access to team OKRs',
    permissions: [
      'View team OKRs (subject to visibility rules)',
      'Cannot create, edit, or delete OKRs'
    ]
  }
}

export function ProfilePopup({ isOpen, onClose }: ProfilePopupProps) {
  const { user } = useAuth()
  const { currentOrganization, workspaces, teams, isSuperuser } = useWorkspace()
  const permissions = usePermissions()

  const getRoleIcon = (role: string) => {
    if (role.includes('OWNER') || role.includes('LEAD')) {
      return <Shield className="h-4 w-4" />
    }
    if (role.includes('ADMIN')) {
      return <Users className="h-4 w-4" />
    }
    if (role.includes('VIEWER')) {
      return <Eye className="h-4 w-4" />
    }
    return <CheckCircle2 className="h-4 w-4" />
  }

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role.includes('OWNER') || role.includes('LEAD') || role === 'SUPERUSER') {
      return 'default'
    }
    if (role.includes('ADMIN')) {
      return 'secondary'
    }
    return 'outline'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your Profile & Permissions</DialogTitle>
          <DialogDescription>
            View your account information, organization membership, and role-based permissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* User Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Your Information
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-slate-500">Name</p>
                <p className="text-sm font-medium text-slate-900">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium text-slate-900">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          {/* Organization */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </h3>
            {currentOrganization ? (
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-900">{currentOrganization.name}</p>
                {permissions.rolesByScope?.tenant?.find(t => t.tenantId === currentOrganization.id) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-500 mb-2">Your Roles:</p>
                    <div className="flex flex-wrap gap-2">
                      {permissions.rolesByScope.tenant
                        .find(t => t.tenantId === currentOrganization.id)
                        ?.roles.map((role) => {
                          const roleInfo = ROLE_DESCRIPTIONS[role]
                          return (
                            <Badge
                              key={role}
                              variant={getRoleBadgeVariant(role)}
                              className="text-xs flex items-center gap-1"
                            >
                              {getRoleIcon(role)}
                              {role.replace(/_/g, ' ')}
                            </Badge>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">No organization assigned</p>
              </div>
            )}
          </div>

          {/* Workspaces */}
          {permissions.rolesByScope?.workspace && permissions.rolesByScope.workspace.length > 0 && (
            <>
              <div className="border-t border-slate-200" />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Workspaces
                </h3>
                <div className="space-y-3">
                  {permissions.rolesByScope.workspace.map((workspace) => {
                    const workspaceInfo = workspaces.find(w => w.id === workspace.workspaceId)
                    return (
                      <div key={workspace.workspaceId} className="bg-slate-50 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-medium text-slate-900">
                          {workspaceInfo?.name || `Workspace ${workspace.workspaceId}`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {workspace.roles.map((role) => {
                            const roleInfo = ROLE_DESCRIPTIONS[role]
                            return (
                              <Badge
                                key={role}
                                variant={getRoleBadgeVariant(role)}
                                className="text-xs flex items-center gap-1"
                              >
                                {getRoleIcon(role)}
                                {role.replace(/_/g, ' ')}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Teams */}
          {permissions.rolesByScope?.team && permissions.rolesByScope.team.length > 0 && (
            <>
              <div className="border-t border-slate-200" />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teams
                </h3>
                <div className="space-y-3">
                  {permissions.rolesByScope.team.map((team) => {
                    const teamInfo = teams.find(t => t.id === team.teamId)
                    return (
                      <div key={team.teamId} className="bg-slate-50 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-medium text-slate-900">
                          {teamInfo?.name || `Team ${team.teamId}`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {team.roles.map((role) => {
                            const roleInfo = ROLE_DESCRIPTIONS[role]
                            return (
                              <Badge
                                key={role}
                                variant={getRoleBadgeVariant(role)}
                                className="text-xs flex items-center gap-1"
                              >
                                {getRoleIcon(role)}
                                {role.replace(/_/g, ' ')}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Role Descriptions */}
          <div className="border-t border-slate-200" />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Role Permissions
            </h3>
            <div className="space-y-4">
              {/* Collect all unique roles */}
              {(() => {
                const allRoles = new Set<string>()
                if (isSuperuser) allRoles.add('SUPERUSER')
                permissions.rolesByScope?.tenant?.forEach(t => t.roles.forEach(r => allRoles.add(r)))
                permissions.rolesByScope?.workspace?.forEach(w => w.roles.forEach(r => allRoles.add(r)))
                permissions.rolesByScope?.team?.forEach(t => t.roles.forEach(r => allRoles.add(r)))

                return Array.from(allRoles).map((role) => {
                  const roleInfo = ROLE_DESCRIPTIONS[role]
                  if (!roleInfo) return null

                  return (
                    <div key={role} className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role)}
                        <Badge variant={getRoleBadgeVariant(role)} className="text-xs">
                          {role.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{roleInfo.description}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-slate-600">What you can do:</p>
                        <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">
                          {roleInfo.permissions.map((permission, idx) => (
                            <li key={idx}>{permission}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

