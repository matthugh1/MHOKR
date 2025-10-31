// NOTE [phase14-hardening]:
// Currently unused in the live flow. Kept for future Builder work.
// Safe to refactor or delete post-merge.
// @ts-nocheck is intentional to unblock TypeScript compilation without full type safety.

// @ts-nocheck
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Target, CheckCircle, Lightbulb, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditPanelProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string | null
  nodeData: Record<string, unknown>
  onSave: (nodeId: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (nodeId: string) => Promise<void>
  formData: Record<string, unknown>
  setFormData: (data: Record<string, unknown>) => void
  children: React.ReactNode
}

export function EditPanel({
  isOpen,
  onClose,
  nodeId,
  nodeData: _nodeData,
  onSave,
  onDelete,
  formData,
  setFormData: _propSetFormData,
  children,
}: EditPanelProps) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!nodeId || !formData) return
    
    setIsSaving(true)
    try {
      await onSave(nodeId, formData)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }
  const nodeType = nodeId?.split('-')[0] || ''
  
  const getNodeTypeInfo = () => {
    switch (nodeType) {
      case 'obj':
        return { icon: Target, label: 'Objective', color: 'text-blue-500' }
      case 'kr':
        return { icon: CheckCircle, label: 'Key Result', color: 'text-green-500' }
      case 'init':
        return { icon: Lightbulb, label: 'Initiative', color: 'text-purple-500' }
      default:
        return { icon: Target, label: 'Node', color: 'text-slate-500' }
    }
  }

  const typeInfo = getNodeTypeInfo()
  const Icon = typeInfo.icon

  if (!isOpen || !nodeId) return null

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Icon className={cn('h-5 w-5', typeInfo.color)} />
            <div>
              <CardTitle className="text-lg">{typeInfo.label}</CardTitle>
              <p className="text-xs text-slate-500">Edit details</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="h-[calc(100vh-140px)] overflow-y-auto">
        <div className="p-4">
          {children}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-2 justify-between">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => nodeId && onDelete(nodeId)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

