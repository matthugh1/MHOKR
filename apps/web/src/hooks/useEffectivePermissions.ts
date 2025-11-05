import { useState, useEffect } from 'react'
import api from '@/lib/api'

interface EffectivePermissionsScope {
  tenantId: string
  workspaceId?: string
  teamId?: string
  effectiveRoles: string[]
  actionsAllowed: string[]
  actionsDenied: string[]
}

interface EffectivePermissionsResponse {
  userId: string
  isSuperuser: boolean
  scopes: EffectivePermissionsScope[]
}

/**
 * Hook to fetch effective permissions for a user
 * Supports fetching permissions for another user (admin inspection)
 */
export function useEffectivePermissions(
  userId?: string,
  tenantId?: string,
  workspaceId?: string,
  teamId?: string,
) {
  const [data, setData] = useState<EffectivePermissionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setData(null)
      setLoading(false)
      return
    }

    const fetchPermissions = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (userId) params.append('userId', userId)
        if (tenantId) params.append('tenantId', tenantId)
        if (workspaceId) params.append('workspaceId', workspaceId)
        if (teamId) params.append('teamId', teamId)

        const response = await api.get<EffectivePermissionsResponse>(
          `/rbac/assignments/effective?${params.toString()}`
        )
        setData(response.data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch effective permissions'))
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [userId, tenantId, workspaceId, teamId])

  return { data, loading, error }
}


