/**
 * Hook for fetching and managing hierarchical OKR data
 */

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { transformToHierarchy } from '../components/utils/transformToHierarchy'
import { HierarchyTreeData } from '../components/types'

interface UseHierarchyOKRsParams {
  tenantId: string | null
  cycleId: string | null
  status?: string | null
  scope?: 'my' | 'team-workspace' | 'tenant'
  searchQuery?: string
  enabled?: boolean
}

interface UseHierarchyOKRsReturn {
  treeData: HierarchyTreeData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useHierarchyOKRs({
  tenantId,
  cycleId,
  status,
  scope,
  searchQuery,
  enabled = true,
}: UseHierarchyOKRsParams): UseHierarchyOKRsReturn {
  const [treeData, setTreeData] = useState<HierarchyTreeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOKRs = useCallback(async () => {
    if (!enabled || !tenantId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch all objectives using pagination (max pageSize is 50)
      const maxPageSize = 50
      let allObjectives: any[] = []
      let currentPage = 1
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          tenantId,
          hierarchyView: 'true',
          page: currentPage.toString(),
          pageSize: maxPageSize.toString(),
        })

        if (cycleId) {
          params.set('cycleId', cycleId)
        }

        if (status) {
          params.set('status', status)
        }

        if (scope) {
          params.set('scope', scope)
        }

        if (searchQuery) {
          // Note: Backend may not support search in hierarchy view, but we'll include it
          params.set('search', searchQuery)
        }

        const response = await api.get(`/okr/overview?${params.toString()}`)
        const envelope = response.data || {}
        const objectives = envelope.objectives || []

        if (objectives.length === 0) {
          hasMore = false
        } else {
          allObjectives = [...allObjectives, ...objectives]
          // Check if there are more pages
          const totalCount = envelope.totalCount || 0
          const fetchedCount = allObjectives.length
          hasMore = fetchedCount < totalCount
          currentPage++
        }
      }

      // Transform complete list to hierarchical structure
      const transformed = transformToHierarchy(allObjectives)
      setTreeData(transformed)
    } catch (err: any) {
      console.error('[useHierarchyOKRs] Failed to fetch OKRs:', err)
      if (err.response?.status === 403) {
        setError('You do not have permission to view OKRs. Please contact your administrator.')
      } else if (err.response?.status === 404) {
        setError('OKR service not found. Please check that the API gateway is running.')
      } else {
        setError(err.response?.data?.message || 'Failed to load OKRs. Please try again later.')
      }
      setTreeData(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, cycleId, status, scope, searchQuery, enabled])

  useEffect(() => {
    fetchOKRs()
  }, [fetchOKRs])

  return {
    treeData,
    loading,
    error,
    refetch: fetchOKRs,
  }
}

