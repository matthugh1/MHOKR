'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Target, CheckCircle, Lightbulb, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EditFormState } from './EditFormTabs'

interface EditPanelProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string | null
  nodeData: Record<string, unknown> | null
  onSave: (nodeId: string, data: EditFormState) => Promise<void>
  onDelete: (nodeId: string) => Promise<void>
  formData: EditFormState | null
  setFormData: (data: EditFormState) => void
  children: React.ReactNode
  canEdit?: boolean
  canDelete?: boolean
  lockMessage?: string
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
  canEdit = true,
  canDelete = true,
  lockMessage,
}: EditPanelProps) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!nodeId || !formData || !canEdit) return
    
    setIsSaving(true)
    try {
      await onSave(nodeId, formData)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!nodeId || !canDelete) return
    if (!confirm('Delete this item? This cannot be undone.')) return
    await onDelete(nodeId)
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

  // Empty state handling
  if (!formData) {
    return (
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-8">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-neutral-600 shadow-sm">
            <p className="text-sm">
              This draft could not be loaded.
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {/* TODO [phase6-polish]: Add CTA to create a new objective */}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-neutral-200 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Icon className={cn('h-5 w-5', typeInfo.color)} />
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">{typeInfo.label}</h3>
              <p className="text-xs text-neutral-500">Edit details</p>
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
        <div className="p-4 space-y-4">
          {/* Lock messaging */}
          {lockMessage && (
            <>
              <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-600 shadow-sm">
                {lockMessage}
              </div>
            </>
          )}
          
          {/* Main content wrapped in design system card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            {children}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-4">
        <div className="flex gap-2 justify-between items-center">
          {canDelete && (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isSaving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

