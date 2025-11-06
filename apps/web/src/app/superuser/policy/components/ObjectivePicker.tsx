'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Check, ChevronsUpDown, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface Objective {
  id: string
  title: string
  description?: string
  tenantId?: string
  workspaceId?: string
  teamId?: string
  isPublished: boolean
  visibilityLevel: string
}

interface ObjectivePickerProps {
  value: string
  onChange: (objectiveId: string) => void
  tenantId?: string
}

export function ObjectivePicker({ value, onChange, tenantId }: ObjectivePickerProps) {
  const [open, setOpen] = useState(false)
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      loadObjectives()
    }
  }, [open, tenantId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const loadObjectives = async () => {
    setLoading(true)
    try {
      const url = tenantId 
        ? `/objectives?limit=100&tenantId=${tenantId}`
        : '/objectives?limit=100'
      const response = await api.get(url)
      setObjectives(response.data || [])
    } catch (error) {
      console.error('Failed to load objectives:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedObjective = objectives.find(o => o.id === value)

  const filteredObjectives = objectives.filter(obj =>
    obj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <Label htmlFor="objective-picker">Objective</Label>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        onClick={() => setOpen(!open)}
      >
        {selectedObjective
          ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Target className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedObjective.title}</span>
            </div>
          )
          : 'Select objective...'}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
          <div className="p-2 border-b">
            <Input
              placeholder="Search objectives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Loading objectives...
              </div>
            ) : filteredObjectives.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No objectives found.
              </div>
            ) : (
              filteredObjectives.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => {
                    onChange(obj.id)
                    setOpen(false)
                    setSearchQuery('')
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2',
                    value === obj.id && 'bg-slate-50'
                  )}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === obj.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Target className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{obj.title}</div>
                    {obj.description && (
                      <div className="truncate text-xs text-muted-foreground">{obj.description}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

