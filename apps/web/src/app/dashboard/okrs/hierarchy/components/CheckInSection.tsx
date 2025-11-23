/**
 * Check-in Section component
 * Reuses logic from NewCheckInModal for inline check-in
 */

'use client'

import React, { useState } from 'react'
import { HierarchyOKRNode } from './types'
import { ProgressBar } from './ProgressBar'
import { formatNumber } from '@/lib/utils'

interface CheckInSectionProps {
  selectedNode: HierarchyOKRNode | null
  onCheckIn: (krId: string, data: { value: number; confidence: number; note?: string }) => Promise<void>
  loading?: boolean
}

export function CheckInSection({ selectedNode, onCheckIn, loading: externalLoading }: CheckInSectionProps) {
  const [value, setValue] = useState<string>('')
  const [confidence, setConfidence] = useState<string>('50')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when selection changes
  React.useEffect(() => {
    if (selectedNode?.type === 'keyResult') {
      setValue(selectedNode.currentValue?.toString() || '')
    } else {
      setValue('')
      setConfidence('50')
      setNote('')
    }
  }, [selectedNode])

  if (!selectedNode || selectedNode.type !== 'keyResult') {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const numValue = parseFloat(value)
    const numConfidence = parseInt(confidence, 10)

    if (isNaN(numValue) || isNaN(numConfidence) || numConfidence < 0 || numConfidence > 100) {
      return
    }

    setIsSubmitting(true)
    try {
      await onCheckIn(selectedNode.id, {
        value: numValue,
        confidence: numConfidence,
        note: note.trim() || undefined,
      })
      // Reset form after successful submission
      setNote('')
    } catch (error) {
      console.error('Failed to submit check-in:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const loading = externalLoading || isSubmitting
  const currentValue = selectedNode.currentValue ?? 0
  const targetValue = selectedNode.targetValue ?? 100
  const unit = selectedNode.unit || ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Current Progress</h4>
        <span className="text-xs text-slate-500">Updated recently</span>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
        <div className="flex items-end justify-between mb-2">
          <div className="text-3xl font-light text-white">
            {formatNumber(currentValue)}{unit ? ` ${unit}` : ''}
          </div>
          <div className="text-sm text-slate-500 mb-1">
            Target: {formatNumber(targetValue)}{unit ? ` ${unit}` : ''}
          </div>
        </div>
        <ProgressBar value={selectedNode.progress} status={selectedNode.status} />

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">New Value</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                placeholder={currentValue.toString()}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Confidence</label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                required
                disabled={loading}
              >
                <option value="0">Low (0%)</option>
                <option value="25">Low-Medium (25%)</option>
                <option value="50">Medium (50%)</option>
                <option value="75">Medium-High (75%)</option>
                <option value="100">High (100%)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"
              rows={2}
              placeholder="Add a note about this check-in..."
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded transition-colors"
          >
            {loading ? 'Submitting...' : 'Check-in'}
          </button>
        </form>
      </div>
    </div>
  )
}

