/**
 * AI Insights Section component
 * Fetches and displays insights from /okr/insights/objective/:id
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import api from '@/lib/api'
import { HierarchyOKRNode } from './types'

interface ObjectiveInsights {
  objectiveId: string
  statusTrend: 'IMPROVING' | 'DECLINING' | 'FLAT' | 'UNKNOWN'
  lastUpdateAgeHours: number
  krs: {
    onTrack: number
    atRisk: number
    blocked: number
    completed: number
  }
  upcomingCheckins: number
  overdueCheckins: number
}

interface AIInsightsSectionProps {
  selectedNode: HierarchyOKRNode | null
}

export function AIInsightsSection({ selectedNode }: AIInsightsSectionProps) {
  const [insights, setInsights] = useState<ObjectiveInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedNode || selectedNode.type !== 'objective') {
      setInsights(null)
      return
    }

    const fetchInsights = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get(`/okr/insights/objective/${selectedNode.id}`)
        setInsights(response.data)
      } catch (err: any) {
        console.error('[AIInsightsSection] Failed to fetch insights:', err)
        setError(err.response?.data?.message || 'Failed to load insights')
        setInsights(null)
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [selectedNode])

  if (!selectedNode || selectedNode.type !== 'objective') {
    return null
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 text-indigo-300 text-sm font-semibold">
          <Zap size={16} className="fill-indigo-500 text-indigo-500" />
          Nexus AI Insight
        </div>
        <p className="text-sm text-slate-300">Loading insights...</p>
      </div>
    )
  }

  if (error || !insights) {
    return null // Don't show error, just hide the section
  }

  // Build insight message based on data
  const buildInsightMessage = (): string => {
    const messages: string[] = []

    if (insights.overdueCheckins > 0) {
      messages.push(`${insights.overdueCheckins} overdue check-in${insights.overdueCheckins !== 1 ? 's' : ''} need attention`)
    }

    if (insights.krs.atRisk > 0) {
      messages.push(`${insights.krs.atRisk} key result${insights.krs.atRisk !== 1 ? 's' : ''} ${insights.krs.atRisk === 1 ? 'is' : 'are'} at risk`)
    }

    if (insights.statusTrend === 'DECLINING') {
      messages.push('Status trend is declining - consider intervention')
    }

    if (insights.lastUpdateAgeHours > 336) {
      messages.push('No updates in 14+ days - consider checking in')
    }

    if (messages.length === 0) {
      return 'All key results are on track. Keep up the great work!'
    }

    return messages.join('. ') + '.'
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-4 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2 text-indigo-300 text-sm font-semibold">
        <Zap size={16} className="fill-indigo-500 text-indigo-500" />
        Nexus AI Insight
      </div>
      <p className="text-sm text-slate-300 mb-3">
        {buildInsightMessage()}
      </p>
      <div className="flex gap-2">
        <button className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded shadow-sm transition-colors">
          View Details
        </button>
      </div>
    </div>
  )
}

