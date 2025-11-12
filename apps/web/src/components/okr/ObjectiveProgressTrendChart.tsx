'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { format } from 'date-fns'

interface TrendPoint {
  timestamp: string
  progress: number
  status: string
  triggeredBy: string | null
}

interface ObjectiveProgressTrendChartProps {
  objectiveId: string
  className?: string
}

export function ObjectiveProgressTrendChart({ objectiveId, className = '' }: ObjectiveProgressTrendChartProps) {
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get<TrendPoint[]>(`/objectives/${objectiveId}/progress-trend`)
        setTrendData(response.data || [])
      } catch (err: unknown) {
        const apiError = err as { response?: { status?: number; data?: { message?: string } } }
        if (apiError.response?.status === 403) {
          setError('No permission to view trend')
        } else if (apiError.response?.status === 404) {
          setError('Objective not found')
        } else {
          setError('Failed to load trend data')
        }
        setTrendData([])
      } finally {
        setLoading(false)
      }
    }

    if (objectiveId) {
      fetchTrend()
    }
  }, [objectiveId])

  if (loading) {
    return (
      <div className={`text-center py-4 text-sm text-neutral-500 ${className}`}>
        Loading progress trend...
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-4 text-sm text-red-500 ${className}`}>
        {error}
      </div>
    )
  }

  if (trendData.length === 0) {
    return (
      <div className={`text-center py-4 text-sm text-neutral-500 ${className}`}>
        No progress history available
      </div>
    )
  }

  // Chart dimensions
  const width = 400
  const height = 150
  const padding = { top: 10, right: 20, bottom: 30, left: 40 }

  // Calculate scales
  const timestamps = trendData.map(d => new Date(d.timestamp).getTime())
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const timeRange = maxTime - minTime || 1

  const progressValues = trendData.map(d => d.progress)
  const minProgress = Math.min(...progressValues, 0)
  const maxProgress = Math.max(...progressValues, 100)
  const progressRange = maxProgress - minProgress || 1

  // Helper to convert data point to SVG coordinates
  const toX = (timestamp: string) => {
    const time = new Date(timestamp).getTime()
    return padding.left + ((time - minTime) / timeRange) * (width - padding.left - padding.right)
  }

  const toY = (progress: number) => {
    return height - padding.bottom - ((progress - minProgress) / progressRange) * (height - padding.top - padding.bottom)
  }

  // Generate path for progress line
  const progressPath = trendData
    .map((point, index) => {
      const x = toX(point.timestamp)
      const y = toY(point.progress)
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    })
    .join(' ')

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return '#10b981' // emerald-500
      case 'AT_RISK':
        return '#f59e0b' // amber-500
      case 'OFF_TRACK':
        return '#ef4444' // red-500
      case 'COMPLETED':
        return '#6366f1' // indigo-500
      case 'CANCELLED':
        return '#6b7280' // gray-500
      default:
        return '#6b7280'
    }
  }

  return (
    <div className={className}>
      <div className="mb-2">
        <h4 className="text-xs font-semibold text-neutral-700">Progress Trend</h4>
      </div>
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(value => {
          const y = toY(value)
          return (
            <line
              key={value}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          )
        })}

        {/* Progress line */}
        <path
          d={progressPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {trendData.map((point, index) => {
          const x = toX(point.timestamp)
          const y = toY(point.progress)
          const color = getStatusColor(point.status)
          
          return (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r={4}
                fill={color}
                stroke="white"
                strokeWidth={2}
              />
            </g>
          )
        })}

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map(value => {
          const y = toY(value)
          return (
            <text
              key={value}
              x={padding.left - 5}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              {value}%
            </text>
          )
        })}

        {/* X-axis labels */}
        {trendData.length > 0 && (
          <>
            <text
              x={toX(trendData[0].timestamp)}
              y={height - padding.bottom + 15}
              textAnchor="middle"
              fontSize="9"
              fill="#6b7280"
            >
              {format(new Date(trendData[0].timestamp), 'MMM d')}
            </text>
            {trendData.length > 1 && (
              <text
                x={toX(trendData[trendData.length - 1].timestamp)}
                y={height - padding.bottom + 15}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7280"
              >
                {format(new Date(trendData[trendData.length - 1].timestamp), 'MMM d')}
              </text>
            )}
          </>
        )}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{trendData.length} snapshot{trendData.length !== 1 ? 's' : ''}</span>
        {trendData.length > 0 && (
          <span>
            Latest: {Math.round(trendData[trendData.length - 1].progress)}%
          </span>
        )}
      </div>
    </div>
  )
}

