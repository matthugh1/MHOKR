/**
 * Hook to fetch comprehensive OKR detail data
 * Fetches full details including description, tags, contributors, sponsors, initiatives, check-ins
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { HierarchyOKRNode } from '../components/types'

interface OKRDetail {
  id: string
  type: 'objective' | 'keyResult'
  title: string
  description?: string | null
  status: string
  progress: number
  ownerId: string
  owner?: {
    id: string
    name: string
    email?: string | null
  }
  // Objective-specific
  cycleId?: string | null
  cycleName?: string | null
  cycle?: {
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
  } | null
  startDate?: string | null
  endDate?: string | null
  goalType?: 'ASPIRATIONAL' | 'COMMITTED' | null
  visibilityLevel?: string | null
  isPublished?: boolean | null
  state?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  lastReviewedAt?: string | null
  // Key Result-specific
  currentValue?: number | null
  targetValue?: number | null
  startValue?: number | null
  unit?: string | null
  checkInCadence?: string | null
  // Relationships
  tags?: Array<{
    id: string
    name: string
    color?: string | null
  }>
  contributors?: Array<{
    id: string
    user: {
      id: string
      name: string
      email?: string | null
    }
    role: string
  }>
  sponsors?: Array<{
    id: string
    user: {
      id: string
      name: string
      email?: string | null
    }
  }>
  initiatives?: Array<{
    id: string
    title: string
    description?: string | null
    status: string
    progress: number
    dueDate?: string | null
    ownerId?: string | null
  }>
  keyResults?: Array<{
    id: string
    title: string
    progress: number
    weight?: number
  }>
  checkIns?: Array<{
    id: string
    value: number
    confidence: number
    note?: string | null
    blockers?: string | null
    createdAt: string
    userId: string
    user?: {
      id: string
      name: string
      email?: string | null
    }
  }>
  // Context
  workspaceId?: string | null
  workspace?: {
    id: string
    name: string
  } | null
  teamId?: string | null
  team?: {
    id: string
    name: string
  } | null
  pillarId?: string | null
  pillar?: {
    id: string
    name: string
    color?: string | null
  } | null
}

interface UseOKRDetailReturn {
  detail: OKRDetail | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useOKRDetail(
  node: HierarchyOKRNode | null,
  enabled: boolean = true
): UseOKRDetailReturn {
  const [detail, setDetail] = useState<OKRDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!node || !enabled) {
      setDetail(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (node.type === 'objective') {
        const response = await api.get(`/objectives/${node.id}`)
        const data = response.data

        // Transform API response to OKRDetail format
        const transformed: OKRDetail = {
          id: data.id,
          type: 'objective',
          title: data.title,
          description: data.description,
          status: data.status,
          progress: data.progress,
          ownerId: data.ownerId,
          owner: data.owner
            ? {
                id: data.owner.id,
                name: data.owner.name,
                email: data.owner.email,
              }
            : undefined,
          cycleId: data.cycleId,
          cycleName: data.cycle?.name,
          cycle: data.cycle
            ? {
                id: data.cycle.id,
                name: data.cycle.name,
                status: data.cycle.status,
                startDate: data.cycle.startDate ? (typeof data.cycle.startDate === 'string' ? data.cycle.startDate : data.cycle.startDate.toISOString()) : '',
                endDate: data.cycle.endDate ? (typeof data.cycle.endDate === 'string' ? data.cycle.endDate : data.cycle.endDate.toISOString()) : '',
              }
            : null,
          startDate: data.startDate ? (typeof data.startDate === 'string' ? data.startDate : data.startDate.toISOString()) : null,
          endDate: data.endDate ? (typeof data.endDate === 'string' ? data.endDate : data.endDate.toISOString()) : null,
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString()) : null,
          updatedAt: data.updatedAt ? (typeof data.updatedAt === 'string' ? data.updatedAt : data.updatedAt.toISOString()) : null,
          lastReviewedAt: data.lastReviewedAt ? (typeof data.lastReviewedAt === 'string' ? data.lastReviewedAt : data.lastReviewedAt.toISOString()) : null,
          goalType: data.goalType,
          visibilityLevel: data.visibilityLevel,
          isPublished: data.isPublished,
          state: data.state,
          tags: data.tags?.map((tag: any) => ({
            id: tag.tag?.id || tag.id,
            name: tag.tag?.name || tag.name,
            color: tag.tag?.color || tag.color,
          })),
          contributors: data.contributors?.map((contrib: any) => ({
            id: contrib.id,
            user: {
              id: contrib.user.id,
              name: contrib.user.name,
              email: contrib.user.email,
            },
            role: contrib.role,
          })),
          sponsors: data.sponsors?.map((sponsor: any) => ({
            id: sponsor.id,
            user: {
              id: sponsor.user.id,
              name: sponsor.user.name,
              email: sponsor.user.email,
            },
          })),
          initiatives: data.initiatives?.map((init: any) => ({
            id: init.id,
            title: init.title,
            description: init.description,
            status: init.status,
            progress: init.progress,
            dueDate: init.dueDate,
            ownerId: init.ownerId,
          })),
          keyResults: data.keyResults?.map((kr: any) => ({
            id: kr.keyResult?.id || kr.id,
            title: kr.keyResult?.title || kr.title,
            progress: kr.keyResult?.progress ?? kr.progress ?? 0,
            weight: kr.weight,
          })),
          workspaceId: data.workspaceId,
          workspace: data.workspace
            ? {
                id: data.workspace.id,
                name: data.workspace.name,
              }
            : null,
          teamId: data.teamId,
          team: data.team
            ? {
                id: data.team.id,
                name: data.team.name,
              }
            : null,
          pillarId: data.pillarId,
          pillar: data.pillar
            ? {
                id: data.pillar.id,
                name: data.pillar.name,
                color: data.pillar.color,
              }
            : null,
        }

        setDetail(transformed)
      } else if (node.type === 'keyResult') {
        const response = await api.get(`/key-results/${node.id}`)
        const data = response.data

        // Fetch tags and contributors separately (they may not be included in the main response)
        const [tagsResponse, contributorsResponse, checkInsResponse] = await Promise.all([
          api.get(`/key-results/${node.id}/tags`).catch(() => ({ data: [] })),
          api.get(`/key-results/${node.id}/contributors`).catch(() => ({ data: [] })),
          api.get(`/key-results/${node.id}/check-ins?limit=20`).catch(() => ({ data: { checkIns: [] } })),
        ])

        const transformed: OKRDetail = {
          id: data.id,
          type: 'keyResult',
          title: data.title,
          description: data.description,
          status: data.status,
          progress: data.progress,
          ownerId: data.ownerId,
          owner: data.owner
            ? {
                id: data.owner.id,
                name: data.owner.name,
                email: data.owner.email,
              }
            : undefined,
          currentValue: data.currentValue,
          targetValue: data.targetValue,
          startValue: data.startValue,
          unit: data.unit,
          checkInCadence: data.checkInCadence,
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString()) : null,
          updatedAt: data.updatedAt ? (typeof data.updatedAt === 'string' ? data.updatedAt : data.updatedAt.toISOString()) : null,
          tags: tagsResponse.data?.map((tag: any) => ({
            id: tag.tag?.id || tag.id,
            name: tag.tag?.name || tag.name,
            color: tag.tag?.color || tag.color,
          })) || data.tags?.map((tag: any) => ({
            id: tag.tag?.id || tag.id,
            name: tag.tag?.name || tag.name,
            color: tag.tag?.color || tag.color,
          })),
          contributors: contributorsResponse.data?.map((contrib: any) => ({
            id: contrib.id,
            user: {
              id: contrib.user.id,
              name: contrib.user.name,
              email: contrib.user.email,
            },
            role: contrib.role,
          })) || data.contributors?.map((contrib: any) => ({
            id: contrib.id,
            user: {
              id: contrib.user.id,
              name: contrib.user.name,
              email: contrib.user.email,
            },
            role: contrib.role,
          })),
          checkIns: checkInsResponse.data?.checkIns?.map((checkIn: any) => ({
            id: checkIn.id,
            value: checkIn.value,
            confidence: checkIn.confidence,
            note: checkIn.note,
            blockers: checkIn.blockers,
            createdAt: checkIn.createdAt,
            userId: checkIn.userId,
            user: checkIn.user
              ? {
                  id: checkIn.user.id,
                  name: checkIn.user.name,
                  email: checkIn.user.email,
                }
              : undefined,
          })) || data.checkIns?.map((checkIn: any) => ({
            id: checkIn.id,
            value: checkIn.value,
            confidence: checkIn.confidence,
            note: checkIn.note,
            blockers: checkIn.blockers,
            createdAt: checkIn.createdAt,
            userId: checkIn.userId,
            user: checkIn.user
              ? {
                  id: checkIn.user.id,
                  name: checkIn.user.name,
                  email: checkIn.user.email,
                }
              : undefined,
          })),
          teamId: data.teamId,
          team: data.team
            ? {
                id: data.team.id,
                name: data.team.name,
              }
            : null,
        }

        setDetail(transformed)
      }
    } catch (err: any) {
      console.error('[useOKRDetail] Failed to fetch detail:', err)
      setError(err.response?.data?.message || 'Failed to load details')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [node, enabled])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  return {
    detail,
    loading,
    error,
    refetch: fetchDetail,
  }
}

