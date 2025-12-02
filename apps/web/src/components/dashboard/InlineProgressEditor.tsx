'use client'

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Check, X } from 'lucide-react'
import api from '@/lib/api'

interface InlineProgressEditorProps {
  itemType: 'OBJECTIVE' | 'KEY_RESULT'
  itemId: string
  currentProgress: number
  onSuccess?: () => void
  onCancel?: () => void
}

export function InlineProgressEditor({
  itemType,
  itemId,
  currentProgress,
  onSuccess,
  onCancel,
}: InlineProgressEditorProps) {
  const [progress, setProgress] = useState(currentProgress.toString())
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    try {
      setLoading(true)
      const progressValue = Math.max(0, Math.min(100, parseFloat(progress) || 0))
      const endpoint = itemType === 'OBJECTIVE' 
        ? `/objectives/${itemId}`
        : `/key-results/${itemId}`
      
      await api.patch(endpoint, { progress: progressValue })
      onSuccess?.()
    } catch (error) {
      console.error('Failed to update progress:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="progress" className="text-sm">Progress:</Label>
        <Input
          id="progress"
          type="number"
          min="0"
          max="100"
          value={progress}
          onChange={(e) => setProgress(e.target.value)}
          className="w-20"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleSave}
        disabled={loading || parseFloat(progress) === currentProgress}
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

