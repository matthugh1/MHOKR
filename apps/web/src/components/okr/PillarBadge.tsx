"use client"

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface Pillar {
  id: string
  name: string
  color: string | null
}

interface PillarBadgeProps {
  pillarId: string | null | undefined
  className?: string
}

// Cache for pillars to avoid repeated API calls
let pillarsCache: Map<string, Pillar> | null = null
let pillarsCachePromise: Promise<void> | null = null

const loadPillarsCache = async (): Promise<Map<string, Pillar>> => {
  if (pillarsCache) {
    return pillarsCache
  }

  if (pillarsCachePromise) {
    await pillarsCachePromise
    return pillarsCache!
  }

  pillarsCachePromise = (async () => {
    try {
      const response = await api.get('/pillars')
      const pillars = response.data || []
      pillarsCache = new Map(pillars.map((p: Pillar) => [p.id, p]))
    } catch (error) {
      console.error('Failed to load pillars for badge:', error)
      pillarsCache = new Map()
    }
  })()

  await pillarsCachePromise
  return pillarsCache!
}

export function PillarBadge({ pillarId, className }: PillarBadgeProps) {
  const [pillar, setPillar] = useState<Pillar | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!pillarId) {
      setPillar(null)
      return
    }

    const fetchPillar = async () => {
      const cache = await loadPillarsCache()
      const found = cache.get(pillarId)
      
      if (found) {
        setPillar(found)
      } else {
        // Pillar not in cache, try to fetch it
        setIsLoading(true)
        try {
          const response = await api.get(`/pillars/${pillarId}`)
          const fetchedPillar = response.data
          if (fetchedPillar) {
            // Update cache
            if (pillarsCache) {
              pillarsCache.set(pillarId, fetchedPillar)
            }
            setPillar(fetchedPillar)
          } else {
            setPillar(null)
          }
        } catch (error) {
          console.error('Failed to fetch pillar:', error)
          setPillar(null)
        } finally {
          setIsLoading(false)
        }
      }
    }

    fetchPillar()
  }, [pillarId])

  if (!pillarId) {
    return null
  }

  if (isLoading) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-xs", className)}
        aria-label="Loading pillar information"
      >
        Pillar
      </Badge>
    )
  }

  if (!pillar) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-xs", className)}
        aria-label="Pillar information unavailable"
      >
        Pillar
      </Badge>
    )
  }

  const backgroundColor = pillar.color || '#6b7280'
  const textColor = pillar.color 
    ? (getContrastColor(pillar.color) === 'light' ? '#ffffff' : '#000000')
    : undefined

  return (
    <Badge
      variant="secondary"
      className={cn("text-xs", className)}
      style={{
        backgroundColor: backgroundColor,
        color: textColor,
      }}
      aria-label={`Pillar: ${pillar.name}`}
      title={`Pillar: ${pillar.name}`}
    >
      {pillar.name}
    </Badge>
  )
}

// Helper function to determine if a color is light or dark
function getContrastColor(hexColor: string): 'light' | 'dark' {
  // Remove # if present
  const hex = hexColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  return luminance > 0.5 ? 'light' : 'dark'
}


