/**
 * People and Tags Section component
 * Displays tags, contributors, sponsors, and multiple owners
 */

'use client'

import React, { useEffect, useState } from 'react'
import { Tag, Users, Award, User } from 'lucide-react'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'
import { cn } from '@/lib/utils'
import { getObjectiveOwners, getKeyResultOwners, type Owner } from '@/lib/okr-owners-api'

interface PeopleAndTagsSectionProps {
  hideTitle?: boolean
  detail: {
    id?: string
    type?: 'objective' | 'keyResult'
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
    owner?: {
      id: string
      name: string
      email?: string | null
    }
  } | null
}

export function PeopleAndTagsSection({ detail, hideTitle = false }: PeopleAndTagsSectionProps) {
  const [owners, setOwners] = useState<Owner[]>([])
  const [isLoadingOwners, setIsLoadingOwners] = useState(false)

  // Fetch all owners when detail changes
  useEffect(() => {
    const fetchOwners = async () => {
      if (!detail?.id) {
        setOwners([])
        return
      }

      setIsLoadingOwners(true)
      try {
        if (detail.type === 'objective') {
          const ownersData = await getObjectiveOwners(detail.id)
          setOwners(ownersData)
        } else if (detail.type === 'keyResult') {
          const ownersData = await getKeyResultOwners(detail.id)
          setOwners(ownersData)
        } else {
          // Fallback: try objective first, then key result
          try {
            const ownersData = await getObjectiveOwners(detail.id)
            setOwners(ownersData)
          } catch {
            try {
              const ownersData = await getKeyResultOwners(detail.id)
              setOwners(ownersData)
            } catch {
              setOwners([])
            }
          }
        }
      } catch (error) {
        console.error('Failed to load owners:', error)
        setOwners([])
      } finally {
        setIsLoadingOwners(false)
      }
    }

    fetchOwners()
  }, [detail?.id, detail?.type])

  if (!detail) return null

  const hasTags = detail.tags && detail.tags.length > 0
  const hasContributors = detail.contributors && detail.contributors.length > 0
  const hasSponsors = detail.sponsors && detail.sponsors.length > 0
  const hasOwners = owners.length > 0

  if (!hasTags && !hasContributors && !hasSponsors && !hasOwners) {
    return null
  }

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users size={16} className="text-slate-500" />
          People & Tags
        </h4>
      )}

      <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-4 space-y-4">
        {/* Tags */}
        {hasTags && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold">
              <Tag size={12} />
              Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.tags!.map((tag) => (
                <span
                  key={tag.id}
                  className={cn(
                    'text-xs px-2 py-1 rounded-md border',
                    tag.color
                      ? 'text-white border-transparent'
                      : 'bg-slate-700/50 text-slate-300 border-slate-700'
                  )}
                  style={tag.color ? { backgroundColor: tag.color } : undefined}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Owners */}
        {hasOwners && (
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold">
              <Users size={12} />
              Owners ({owners.length})
            </div>
            <div className="flex flex-wrap gap-3">
              {owners.map((owner) => (
                <div key={owner.id} className="flex items-center gap-2">
                  <AvatarCircle name={owner.userName} size="sm" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-300">{owner.userName}</span>
                    {owner.isPrimary && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-600 text-white">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contributors */}
        {hasContributors && (
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold">
              <Users size={12} />
              Contributors ({detail.contributors!.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.contributors!.map((contributor) => (
                <div key={contributor.id} className="flex items-center gap-2">
                  <AvatarCircle name={contributor.user.name} size="sm" />
                  <span className="text-sm text-slate-300">{contributor.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sponsors */}
        {hasSponsors && (
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold">
              <Award size={12} />
              Sponsors ({detail.sponsors!.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.sponsors!.map((sponsor) => (
                <div key={sponsor.id} className="flex items-center gap-2">
                  <AvatarCircle name={sponsor.user.name} size="sm" />
                  <span className="text-sm text-slate-300">{sponsor.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

