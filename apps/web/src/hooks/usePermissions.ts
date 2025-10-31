import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'

interface RolesByScope {
  tenant: Array<{ organizationId: string; roles: string[] }>
  workspace: Array<{ workspaceId: string; roles: string[] }>
  team: Array<{ teamId: string; roles: string[] }>
}

interface RBACAssignmentsResponse {
  userId: string
  isSuperuser: boolean
  roles: RolesByScope
}

interface OKR {
  ownerId: string
  organizationId?: string | null
  workspaceId?: string | null
  teamId?: string | null
}

interface InviteMembersParams {
  organizationId?: string
  workspaceId?: string
  teamId?: string
}

export function usePermissions() {
  const { user } = useAuth()
  const [rolesByScope, setRolesByScope] = useState<RolesByScope>({
    tenant: [],
    workspace: [],
    team: [],
  })
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRBACAssignments = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const response = await api.get<RBACAssignmentsResponse>('/rbac/assignments/me')
        setRolesByScope(response.data.roles)
        setIsSuperuser(response.data.isSuperuser || false)
      } catch (error) {
        console.error('Failed to fetch RBAC assignments:', error)
        // On error, set empty state but don't block the UI
        setRolesByScope({
          tenant: [],
          workspace: [],
          team: [],
        })
        setIsSuperuser(false)
      } finally {
        setLoading(false)
      }
    }

    fetchRBACAssignments()
  }, [user?.id])

  const canEditOKR = useMemo(() => {
    return (okr: OKR): boolean => {
      // Superuser: always true
      if (isSuperuser) {
        return true
      }

      // Owner shortcut: if okr.ownerId === currentUser.id → true
      if (okr.ownerId === user?.id) {
        return true
      }

      // Tenant roles: If okr.organizationId matches an entry in roles.tenant[].organizationId
      // and that entry contains 'TENANT_OWNER' or 'TENANT_ADMIN', return true
      if (okr.organizationId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.organizationId === okr.organizationId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // Workspace roles: If okr.workspaceId matches an entry in roles.workspace[].workspaceId
      // and that entry contains 'WORKSPACE_LEAD' or 'WORKSPACE_ADMIN', return true
      if (okr.workspaceId) {
        const workspaceRoles = rolesByScope.workspace.find(
          (w) => w.workspaceId === okr.workspaceId
        )
        if (workspaceRoles && (workspaceRoles.roles.includes('WORKSPACE_LEAD') || workspaceRoles.roles.includes('WORKSPACE_ADMIN'))) {
          return true
        }
      }

      // Team roles: If okr.teamId matches an entry in roles.team[].teamId
      // and that entry contains 'TEAM_LEAD', return true
      if (okr.teamId) {
        const teamRoles = rolesByScope.team.find(
          (t) => t.teamId === okr.teamId
        )
        if (teamRoles && teamRoles.roles.includes('TEAM_LEAD')) {
          return true
        }
      }

      // Otherwise false
      return false
    }
  }, [isSuperuser, user?.id, rolesByScope])

  const canDeleteOKR = useMemo(() => {
    return (okr: OKR): boolean => {
      // Superuser: always true
      if (isSuperuser) {
        return true
      }

      // Owner shortcut: if okr.ownerId === currentUser.id → true
      if (okr.ownerId === user?.id) {
        return true
      }

      // Tenant roles: If okr.organizationId matches an entry in roles.tenant[].organizationId
      // and that entry contains 'TENANT_OWNER' or 'TENANT_ADMIN', return true
      if (okr.organizationId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.organizationId === okr.organizationId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // Workspace roles: If okr.workspaceId matches an entry in roles.workspace[].workspaceId
      // and that entry contains 'WORKSPACE_LEAD' or 'WORKSPACE_ADMIN', return true
      if (okr.workspaceId) {
        const workspaceRoles = rolesByScope.workspace.find(
          (w) => w.workspaceId === okr.workspaceId
        )
        if (workspaceRoles && (workspaceRoles.roles.includes('WORKSPACE_LEAD') || workspaceRoles.roles.includes('WORKSPACE_ADMIN'))) {
          return true
        }
      }

      // Team roles: If okr.teamId matches an entry in roles.team[].teamId
      // and that entry contains 'TEAM_LEAD', return true
      if (okr.teamId) {
        const teamRoles = rolesByScope.team.find(
          (t) => t.teamId === okr.teamId
        )
        if (teamRoles && teamRoles.roles.includes('TEAM_LEAD')) {
          return true
        }
      }

      // Otherwise false
      return false
    }
  }, [isSuperuser, user?.id, rolesByScope])

  const canInviteMembers = useMemo(() => {
    return (params: InviteMembersParams = {}): boolean => {
      // Superuser: always true
      if (isSuperuser) {
        return true
      }

      // Tenant level: Check if user has TENANT_OWNER or TENANT_ADMIN for the organization
      if (params.organizationId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.organizationId === params.organizationId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // Workspace level: Check if user has WORKSPACE_LEAD or WORKSPACE_ADMIN for the workspace
      if (params.workspaceId) {
        const workspaceRoles = rolesByScope.workspace.find(
          (w) => w.workspaceId === params.workspaceId
        )
        if (workspaceRoles && (workspaceRoles.roles.includes('WORKSPACE_LEAD') || workspaceRoles.roles.includes('WORKSPACE_ADMIN'))) {
          return true
        }
      }

      // Team level: Check if user has TEAM_LEAD for the team
      if (params.teamId) {
        const teamRoles = rolesByScope.team.find(
          (t) => t.teamId === params.teamId
        )
        if (teamRoles && teamRoles.roles.includes('TEAM_LEAD')) {
          return true
        }
      }

      // If no specific scope provided, check if user has any admin role at any level
      if (!params.organizationId && !params.workspaceId && !params.teamId) {
        const hasTenantAdmin = rolesByScope.tenant.some(
          (t) => t.roles.includes('TENANT_OWNER') || t.roles.includes('TENANT_ADMIN')
        )
        const hasWorkspaceAdmin = rolesByScope.workspace.some(
          (w) => w.roles.includes('WORKSPACE_LEAD') || w.roles.includes('WORKSPACE_ADMIN')
        )
        const hasTeamLead = rolesByScope.team.some(
          (t) => t.roles.includes('TEAM_LEAD')
        )
        return hasTenantAdmin || hasWorkspaceAdmin || hasTeamLead
      }

      return false
    }
  }, [isSuperuser, rolesByScope])

  /**
   * Check if user can administer tenant (TENANT_OWNER or TENANT_ADMIN).
   * Used to determine if user can edit published OKRs or access admin features.
   * 
   * @param organizationId - Optional organization ID to check. If not provided, checks if user has admin role in any organization.
   * @returns true if user has TENANT_OWNER or TENANT_ADMIN role for the organization
   */
  const canAdministerTenant = useMemo(() => {
    return (organizationId?: string): boolean => {
      // Superuser: always true (though they're read-only for OKRs)
      if (isSuperuser) {
        return true
      }

      // If organizationId provided, check that specific org
      if (organizationId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.organizationId === organizationId
        )
        return tenantRoles !== undefined && (
          tenantRoles.roles.includes('TENANT_OWNER') || 
          tenantRoles.roles.includes('TENANT_ADMIN')
        )
      }

      // If no organizationId, check if user has admin role in any organization
      return rolesByScope.tenant.some(
        (t) => t.roles.includes('TENANT_OWNER') || t.roles.includes('TENANT_ADMIN')
      )
    }
  }, [isSuperuser, rolesByScope])

  /**
   * Check if current user is a tenant admin or owner for the current organization.
   * This is a convenience helper that wraps canAdministerTenant with the current org context.
   * 
   * @param organizationId - Optional organization ID. If not provided, checks if user has admin role in any organization.
   * @returns true if user has TENANT_OWNER or TENANT_ADMIN role
   */
  const isTenantAdminOrOwner = useMemo(() => {
    return (organizationId?: string): boolean => {
      return canAdministerTenant(organizationId)
    }
  }, [canAdministerTenant])

  return {
    loading,
    isSuperuser,
    canEditOKR,
    canDeleteOKR,
    canInviteMembers,
    canAdministerTenant,
    isTenantAdminOrOwner,
  }
}
