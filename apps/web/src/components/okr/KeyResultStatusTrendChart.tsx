'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { format } from 'date-fns'

interface TrendPoint {
  timestamp: string
  status: string
  progress: number | null
  triggeredBy: string | null
}

interface KeyResultStatusTrendChartProps {
  keyResultId: string
  className?: string
}

export function KeyResultStatusTrendChart({ keyResultId, className = '' }: KeyResultStatusTrendChartProps) {
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get<TrendPoint[]>(`/key-results/${keyResultId}/status-trend`)
        setTrendData(response.data || [])
      } catch (err: unknown) {
        const apiError = err as { response?: { status?: number; data?: { message?: string } } }
        if (apiError.response?.status === 403) {
          setError('No permission to view trend')
        } else if (apiError.response?.status === 404) {
          setError('Key result not found')
        } else {
          setError('Failed to load trend data')
        }
        setTrendData([])
      } finally {
        setLoading(false)
      }
    }

    if (keyResultId) {
      fetchTrend()
    }
  }, [keyResultId])

  if (loading) {
    return (
      <div className={`text-center py-4 text-sm text-neutral-500 ${className}`}>
        Loading status trend...
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
        No status history available
      </div>
    )
  }

  // Chart dimensions
  const width = 400
  const height = 120
  const padding = { top: 10, right: 20, bottom: 30, left: 10 }

  // Calculate scales
  const timestamps = trendData.map(d => new Date(d.timestamp).getTime())
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const timeRange = maxTime - minTime || 1

  // Status mapping to Y positions (stacked vertically)
  const statusOrder = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED']
  const statusYPositions: Record<string, number> = {}
  statusOrder.forEach((status, index) => {
    statusYPositions[status] = padding.top + (index * (height - padding.top - padding.bottom) / (statusOrder.length - 1))
  })

  // Helper to convert data point to SVG coordinates
  const toX = (timestamp: string) => {
    const time = new Date(timestamp).getTime()
    return padding.left + ((time - minTime) / timeRange) * (width - padding.left - padding.right)
  }

  const toY = (status: string) => {
    return statusYPositions[status] || height / 2
  }

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

  // Status label mapping
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return 'On Track'
      case 'AT_RISK':
        return 'At Risk'
      case 'OFF_TRACK':
        return 'Off Track'
      case 'COMPLETED':
        return 'Completed'
      case 'CANCELLED':
        return 'Cancelled'
      default:
        return status
    }
  }

  return (
    <div className={className}>
      <div className="mb-2">
        <h4 className="text-xs font-semibold text-neutral-700">Status Trend</h4>
      </div>
      <svg width={width} height={height} className="overflow-visible">
        {/* Status labels on left */}
        {statusOrder.map((status) => {
          const y = statusYPositions[status]
          return (
            <text
              key={status}
              x={padding.left - 5}
              y={y + 4}
              textAnchor="end"
              fontSize="9"
              fill="#6b7280"
            >
              {getStatusLabel(status)}
            </text>
          )
        })}

        {/* Data points */}
        {trendData.map((point, index) => {
          const x = toX(point.timestamp)
          const y = toY(point.status)
          const color = getStatusColor(point.status)
          
          return (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r={5}
                fill={color}
                stroke="white"
                strokeWidth={2}
              />
              {/* Line connecting to next point */}
              {index < trendData.length - 1 && (
                <line
                  x1={x}
                  y1={y}
                  x2={toX(trendData[index + 1].timestamp)}
                  y2={toY(trendData[index + 1].status)}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="3,3"
                  opacity={0.5}
                />
              )}
            </g>
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
        <span>{trendData.length} change{trendData.length !== 1 ? 's' : ''}</span>
        {trendData.length > 0 && (
          <span>
            Current: {getStatusLabel(trendData[trendData.length - 1].status)}
          </span>
        )}
      </div>
    </div>
  )
}

