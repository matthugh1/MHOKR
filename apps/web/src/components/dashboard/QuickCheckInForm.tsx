'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'

interface QuickCheckInFormProps {
  keyResultId: string
  keyResultTitle: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function QuickCheckInForm({
  keyResultId,
  keyResultTitle,
  isOpen,
  onClose,
  onSuccess,
}: QuickCheckInFormProps) {
  const [value, setValue] = useState('')
  const [confidence, setConfidence] = useState(50)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      await api.post(`/key-results/${keyResultId}/check-in`, {
        value: parseFloat(value) || 0,
        confidence,
        note: note || undefined,
      })
      onSuccess?.()
      onClose()
      // Reset form
      setValue('')
      setConfidence(50)
      setNote('')
    } catch (error) {
      console.error('Failed to check in:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Check-In</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Key Result</Label>
            <p className="text-sm text-muted-foreground">{keyResultTitle}</p>
          </div>
          
          <div>
            <Label htmlFor="value">Current Value</Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter current value"
            />
          </div>
          
          <div>
            <Label htmlFor="confidence">Confidence (0-100)</Label>
            <Input
              id="confidence"
              type="number"
              min="0"
              max="100"
              value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value) || 50)}
            />
          </div>
          
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any notes or blockers..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !value}>
            {loading ? 'Submitting...' : 'Submit Check-In'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

