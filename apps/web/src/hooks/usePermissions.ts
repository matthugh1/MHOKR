import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'

interface RolesByScope {
  tenant: Array<{ tenantId: string; roles: string[] }>
  workspace: Array<{ workspaceId: string; roles: string[] }>
  team: Array<{ teamId: string; roles: string[] }>
}

interface RBACAssignmentsResponse {
  userId: string
  isSuperuser: boolean
  roles: RolesByScope
}

// Request deduplication: cache in-flight requests to prevent duplicate API calls
const pendingRequests = new Map<string, Promise<RBACAssignmentsResponse>>()
const requestCache = new Map<string, { data: RBACAssignmentsResponse; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds cache

async function fetchRBACAssignmentsWithDedup(
  userId: string,
  signal?: AbortSignal
): Promise<RBACAssignmentsResponse> {
  // Check cache first
  const cached = requestCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // Check if there's already a pending request for this user
  const pending = pendingRequests.get(userId)
  if (pending) {
    // If signal is provided and aborted, reject immediately
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }
    return pending
  }

  // Create new request with abort signal support
  const requestPromise = api.get<RBACAssignmentsResponse>('/rbac/assignments/me', {
    signal,
  })
    .then(response => {
      // Cache the response
      requestCache.set(userId, { data: response.data, timestamp: Date.now() })
      // Remove from pending
      pendingRequests.delete(userId)
      return response.data
    })
    .catch(error => {
      // Remove from pending on error (unless it was aborted)
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        pendingRequests.delete(userId)
      }
      throw error
    })

  // Store pending request
  pendingRequests.set(userId, requestPromise)
  return requestPromise
}

interface OKR {
  ownerId: string
  tenantId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  workspace?: {
    id: string
    ownerId?: string | null
  } | null
  team?: {
    id: string
    ownerId?: string | null
  } | null
}

interface InviteMembersParams {
  tenantId?: string
  workspaceId?: string
  teamId?: string
  workspace?: {
    id: string
    ownerId?: string | null
  } | null
  team?: {
    id: string
    ownerId?: string | null
  } | null
}

export function usePermissions() {
  const { user } = useAuth()
  // Check if user is superuser from auth context first (fallback)
  const isSuperuserFromAuth = user?.isSuperuser === true
  const [rolesByScope, setRolesByScope] = useState<RolesByScope>({
    tenant: [],
    workspace: [],
    team: [],
  })
  const [isSuperuser, setIsSuperuser] = useState(isSuperuserFromAuth)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // AbortController to cancel in-flight requests when component unmounts or user changes
    const abortController = new AbortController()
    let isMounted = true

    const fetchRBACAssignments = async () => {
      if (!user?.id) {
        if (isMounted) {
          setLoading(false)
        }
        return
      }

      try {
        const data = await fetchRBACAssignmentsWithDedup(user.id, abortController.signal)
        
        // Only update state if component is still mounted and request wasn't aborted
        if (isMounted && !abortController.signal.aborted) {
          setRolesByScope(data.roles)
          setIsSuperuser(data.isSuperuser || false)
        }
      } catch (error: any) {
        // Don't handle errors if request was aborted (component unmounted)
        if (abortController.signal.aborted) {
          return
        }

        // Network errors or API unavailable - set empty state but don't block the UI
        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || error.code === 'ERR_INSUFFICIENT_RESOURCES') {
          console.warn('API unavailable or network error when fetching RBAC assignments. Using empty permissions.')
        } else if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          // Only log non-abort errors
          console.error('Failed to fetch RBAC assignments:', error)
        }
        
        // On error, set empty state but don't block the UI (only if still mounted)
        // IMPORTANT: Preserve superuser status from auth context if API fails
        if (isMounted) {
          setRolesByScope({
            tenant: [],
            workspace: [],
            team: [],
          })
          // Don't override superuser status if we have it from auth context
          // This ensures superusers can still access tenant scope even if RBAC API fails
          setIsSuperuser(isSuperuserFromAuth)
        }
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchRBACAssignments()

    // Cleanup: abort request and mark as unmounted
    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [user?.id, isSuperuserFromAuth])

  const canEditOKR = useMemo(() => {
    return (okr: OKR): boolean => {
      // Guard against undefined/null okr
      if (!okr) {
        return false
      }

      // Superuser: always true
      if (isSuperuser) {
        return true
      }

      // Owner shortcut: if okr.ownerId === currentUser.id → true
      if (okr.ownerId === user?.id) {
        return true
      }

      // Tenant roles: If okr.tenantId matches an entry in roles.tenant[].tenantId
      // and that entry contains 'TENANT_OWNER' or 'TENANT_ADMIN', return true
      if (okr.tenantId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.tenantId === okr.tenantId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // Workspace owner: If okr.workspace exists and user is the owner
      if (okr.workspaceId && okr.workspace?.ownerId === user?.id) {
        return true
      }

      // Team owner: If okr.team exists and user is the owner
      if (okr.teamId && okr.team?.ownerId === user?.id) {
        return true
      }

      // Otherwise false
      return false
    }
  }, [isSuperuser, user?.id, rolesByScope])

  const canDeleteOKR = useMemo(() => {
    return (okr: OKR): boolean => {
      // Guard against undefined/null okr
      if (!okr) {
        return false
      }

      // Superuser: always true
      if (isSuperuser) {
        return true
      }

      // Owner shortcut: if okr.ownerId === currentUser.id → true
      if (okr.ownerId === user?.id) {
        return true
      }

      // Tenant roles: If okr.tenantId matches an entry in roles.tenant[].tenantId
      // and that entry contains 'TENANT_OWNER' or 'TENANT_ADMIN', return true
      if (okr.tenantId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.tenantId === okr.tenantId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // Workspace owner: If okr.workspace exists and user is the owner
      if (okr.workspaceId && okr.workspace?.ownerId === user?.id) {
        return true
      }

      // Team owner: If okr.team exists and user is the owner
      if (okr.teamId && okr.team?.ownerId === user?.id) {
        return true
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
      if (params.tenantId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.tenantId === params.tenantId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // Workspace level: Check if user is workspace owner
      if (params.workspaceId) {
        // If workspace object with ownerId is provided, use that
        if (params.workspace?.ownerId === user?.id) {
          return true
        }
        // Fallback: check if user has any tenant admin role (can manage workspace members)
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.tenantId === params.tenantId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // Team level: Check if user is team owner
      if (params.teamId) {
        // If team object with ownerId is provided, use that
        if (params.team?.ownerId === user?.id) {
          return true
        }
        // Fallback: check if user has any tenant admin role (can manage team members)
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.tenantId === params.tenantId
        )
        if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
          return true
        }
      }

      // If no specific scope provided, check if user has any admin role
      if (!params.tenantId && !params.workspaceId && !params.teamId) {
        const hasTenantAdmin = rolesByScope.tenant.some(
          (t) => t.roles.includes('TENANT_OWNER') || t.roles.includes('TENANT_ADMIN')
        )
        return hasTenantAdmin
      }

      return false
    }
  }, [isSuperuser, rolesByScope])

  /**
   * Check if user can administer tenant (TENANT_OWNER or TENANT_ADMIN).
   * Used to determine if user can edit published OKRs or access admin features.
   * 
   * @param tenantId - Optional organization ID to check. If not provided, checks if user has admin role in any organization.
   * @returns true if user has TENANT_OWNER or TENANT_ADMIN role for the organization
   */
  const canAdministerTenant = useMemo(() => {
    return (tenantId?: string): boolean => {
      // Superuser: always true (though they're read-only for OKRs)
      if (isSuperuser) {
        return true
      }

      // If tenantId provided, check that specific org
      if (tenantId) {
        const tenantRoles = rolesByScope.tenant.find(
          (t) => t.tenantId === tenantId
        )
        const hasAdmin = tenantRoles !== undefined && (
          tenantRoles.roles.includes('TENANT_OWNER') || 
          tenantRoles.roles.includes('TENANT_ADMIN')
        )
        return hasAdmin
      }

      // If no tenantId, check if user has admin role in any organization
      const hasAnyAdmin = rolesByScope.tenant.some(
        (t) => t.roles.includes('TENANT_OWNER') || t.roles.includes('TENANT_ADMIN')
      )
      return hasAnyAdmin
    }
  }, [isSuperuser, rolesByScope])

  /**
   * Check if current user is a tenant admin or owner for the current organization.
   * This is a convenience helper that wraps canAdministerTenant with the current org context.
   * 
   * @param tenantId - Optional organization ID. If not provided, checks if user has admin role in any organization.
   * @returns true if user has TENANT_OWNER or TENANT_ADMIN role
   */
  const isTenantAdminOrOwner = useMemo(() => {
    return (tenantId?: string): boolean => {
      return canAdministerTenant(tenantId)
    }
  }, [canAdministerTenant])

  return {
    loading,
    isSuperuser,
    rolesByScope,
    canEditOKR,
    canDeleteOKR,
    canInviteMembers,
    canAdministerTenant,
    isTenantAdminOrOwner,
  }
}
