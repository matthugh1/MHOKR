'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { format } from 'date-fns'

interface TrendPoint {
  timestamp: string
  value: number | null
  confidence: number | null
}

interface KeyResultTrendChartProps {
  keyResultId: string
  className?: string
}

export function KeyResultTrendChart({ keyResultId, className = '' }: KeyResultTrendChartProps) {
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfidence, setShowConfidence] = useState(false)

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get<TrendPoint[]>(`/reports/krs/${keyResultId}/trend`)
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
        Loading trend...
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
        No check-in data available
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

  const values = trendData.map(d => d.value).filter((v): v is number => v !== null)
  const minValue = values.length > 0 ? Math.min(...values) : 0
  const maxValue = values.length > 0 ? Math.max(...values) : 100
  const valueRange = maxValue - minValue || 1

  const confidences = trendData.map(d => d.confidence).filter((v): v is number => v !== null)
  const minConfidence = confidences.length > 0 ? Math.min(...confidences) : 0
  const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 100
  const confidenceRange = maxConfidence - minConfidence || 1

  // Helper to convert data point to SVG coordinates
  const toX = (timestamp: string) => {
    const time = new Date(timestamp).getTime()
    return padding.left + ((time - minTime) / timeRange) * (width - padding.left - padding.right)
  }

  const toYValue = (value: number | null) => {
    if (value === null) return null
    return height - padding.bottom - ((value - minValue) / valueRange) * (height - padding.top - padding.bottom)
  }

  const toYConfidence = (confidence: number | null) => {
    if (confidence === null) return null
    return height - padding.bottom - ((confidence - minConfidence) / confidenceRange) * (height - padding.top - padding.bottom)
  }

  // Build path strings
  const valuePoints = trendData
    .map((d, i) => {
      const y = toYValue(d.value)
      if (y === null) return null
      return `${i === 0 ? 'M' : 'L'} ${toX(d.timestamp)} ${y}`
    })
    .filter((p): p is string => p !== null)
    .join(' ')

  const confidencePoints = trendData
    .map((d, i) => {
      const y = toYConfidence(d.confidence)
      if (y === null) return null
      return `${i === 0 ? 'M' : 'L'} ${toX(d.timestamp)} ${y}`
    })
    .filter((p): p is string => p !== null)
    .join(' ')

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h6 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          Trend
        </h6>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showConfidence}
            onChange={(e) => setShowConfidence(e.target.checked)}
            className="w-3 h-3"
          />
          <span className="text-[10px] text-neutral-500">Show confidence</span>
        </label>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-2">
        <svg width={width} height={height} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = height - padding.bottom - ratio * (height - padding.top - padding.bottom)
            return (
              <line
                key={`grid-${ratio}`}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={0.5}
              />
            )
          })}

          {/* Value line */}
          {valuePoints && (
            <path
              d={valuePoints}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Confidence line */}
          {showConfidence && confidencePoints && (
            <path
              d={confidencePoints}
              fill="none"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {trendData.map((d, i) => {
            const yValue = toYValue(d.value)
            if (yValue === null) return null
            return (
              <circle
                key={`point-${i}`}
                cx={toX(d.timestamp)}
                cy={yValue}
                r={3}
                fill="#6366f1"
                stroke="white"
                strokeWidth={1}
              />
            )
          })}

          {/* Confidence points */}
          {showConfidence &&
            trendData.map((d, i) => {
              const yConf = toYConfidence(d.confidence)
              if (yConf === null) return null
              return (
                <circle
                  key={`conf-point-${i}`}
                  cx={toX(d.timestamp)}
                  cy={yConf}
                  r={2}
                  fill="#10b981"
                  stroke="white"
                  strokeWidth={1}
                />
              )
            })}

          {/* Y-axis labels (value) */}
          {[0, 0.5, 1].map((ratio) => {
            const value = minValue + ratio * valueRange
            const y = height - padding.bottom - ratio * (height - padding.top - padding.bottom)
            return (
              <text
                key={`y-label-${ratio}`}
                x={padding.left - 5}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
              >
                {Math.round(value)}
              </text>
            )
          })}

          {/* X-axis labels (dates) */}
          {trendData.length > 0 && (
            <>
              {trendData.length <= 5
                ? trendData.map((d, i) => {
                    const x = toX(d.timestamp)
                    return (
                      <text
                        key={`x-label-${i}`}
                        x={x}
                        y={height - padding.bottom + 15}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#6b7280"
                      >
                        {format(new Date(d.timestamp), 'MMM d')}
                      </text>
                    )
                  })
                : [
                    trendData[0],
                    trendData[Math.floor(trendData.length / 2)],
                    trendData[trendData.length - 1],
                  ].map((d, i) => {
                    const x = toX(d.timestamp)
                    return (
                      <text
                        key={`x-label-${i}`}
                        x={x}
                        y={height - padding.bottom + 15}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#6b7280"
                      >
                        {format(new Date(d.timestamp), 'MMM d')}
                      </text>
                    )
                  })}
            </>
          )}

          {/* Legend */}
          <g>
            <line
              x1={width - padding.right - 80}
              y1={padding.top + 5}
              x2={width - padding.right - 70}
              y2={padding.top + 5}
              stroke="#6366f1"
              strokeWidth={2}
            />
            <text
              x={width - padding.right - 65}
              y={padding.top + 8}
              fontSize="9"
              fill="#6b7280"
            >
              Value
            </text>
            {showConfidence && (
              <>
                <line
                  x1={width - padding.right - 80}
                  y1={padding.top + 18}
                  x2={width - padding.right - 70}
                  y2={padding.top + 18}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <text
                  x={width - padding.right - 65}
                  y={padding.top + 21}
                  fontSize="9"
                  fill="#6b7280"
                >
                  Confidence
                </text>
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}


