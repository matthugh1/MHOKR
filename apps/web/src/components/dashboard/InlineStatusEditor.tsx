'use client'

import React, { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import api from '@/lib/api'

interface InlineStatusEditorProps {
  itemType: 'OBJECTIVE' | 'KEY_RESULT' | 'INITIATIVE' | 'TASK'
  itemId: string
  currentStatus: string
  onSuccess?: () => void
  onCancel?: () => void
}

const statusOptions: Record<string, string[]> = {
  OBJECTIVE: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED'],
  KEY_RESULT: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED'],
  INITIATIVE: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'],
  TASK: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'],
}

const statusLabels: Record<string, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  OFF_TRACK: 'Off Track',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
}

export function InlineStatusEditor({
  itemType,
  itemId,
  currentStatus,
  onSuccess,
  onCancel,
}: InlineStatusEditorProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    try {
      setLoading(true)
      const endpoint = itemType === 'OBJECTIVE' 
        ? `/objectives/${itemId}`
        : itemType === 'KEY_RESULT'
        ? `/key-results/${itemId}`
        : itemType === 'INITIATIVE'
        ? `/initiatives/${itemId}`
        : `/tasks/${itemId}`
      
      await api.patch(endpoint, { status })
      onSuccess?.()
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setLoading(false)
    }
  }

  const options = statusOptions[itemType] || []

  return (
    <div className="flex items-center gap-2">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {statusLabels[opt] || opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleSave}
        disabled={loading || status === currentStatus}
      >
        <Check className="w-4 h-4" />
      </Button>
      {onCancel && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}

