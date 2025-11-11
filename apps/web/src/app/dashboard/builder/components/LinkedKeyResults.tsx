'use client'

import { useState, useEffect } from 'react'
import { LinkedKeyResultsList } from './LinkedKeyResultsList'
import api from '@/lib/api'

interface LinkedKeyResultsProps {
  objectiveId: string
  onRefresh?: () => void
  canEdit?: boolean
}

export function LinkedKeyResults({ objectiveId, onRefresh, canEdit }: LinkedKeyResultsProps) {
  const [keyResults, setKeyResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadLinkedKRs = async () => {
      try {
        const response = await api.get(`/objectives/${objectiveId}`)
        // The API returns objectives with keyResults array containing junction records
        const linkedKRs = response.data.keyResults || []
        setKeyResults(linkedKRs)
      } catch (error) {
        console.error('Failed to load linked Key Results:', error)
        setKeyResults([])
      } finally {
        setLoading(false)
      }
    }

    if (objectiveId) {
      loadLinkedKRs()
    }
  }, [objectiveId])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/objectives/${objectiveId}`)
      const linkedKRs = response.data.keyResults || []
      setKeyResults(linkedKRs)
      onRefresh?.()
    } catch (error) {
      console.error('Failed to refresh linked Key Results:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading linked Key Results...</div>
  }

  return (
    <LinkedKeyResultsList
      objectiveId={objectiveId}
      keyResults={keyResults}
      onRefresh={handleRefresh}
      canEdit={canEdit}
    />
  )
}


