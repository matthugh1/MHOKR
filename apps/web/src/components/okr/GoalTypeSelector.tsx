'use client'

import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type GoalType = 'ASPIRATIONAL' | 'COMMITTED'

interface GoalTypeSelectorProps {
  value?: GoalType | null
  onValueChange: (value: GoalType) => void
  label?: string
  required?: boolean
  disabled?: boolean
  id?: string
  className?: string
}

const GOAL_TYPE_OPTIONS: Array<{ value: GoalType; label: string; description?: string }> = [
  { value: 'ASPIRATIONAL', label: 'Aspirational', description: 'Stretch goal - ambitious target' },
  { value: 'COMMITTED', label: 'Committed', description: 'Committed goal - must achieve' },
]

export function GoalTypeSelector({
  value,
  onValueChange,
  label = 'Goal Type',
  required = false,
  disabled = false,
  id = 'goal-type',
  className,
}: GoalTypeSelectorProps) {
  const handleChange = (newValue: string) => {
    if (newValue === 'ASPIRATIONAL' || newValue === 'COMMITTED') {
      onValueChange(newValue)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium text-slate-200">
          {label} {required && <span className="text-red-400">*</span>}
        </Label>
      )}
      <Select
        value={value || 'ASPIRATIONAL'}
        onValueChange={handleChange}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger 
          id={id} 
          className={cn(
            'bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500',
            label && 'mt-1.5'
          )}
        >
          <SelectValue placeholder="Select goal type" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 text-white">
          {GOAL_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-white focus:bg-slate-700">
              <div className="flex flex-col">
                <span className="text-white">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-slate-400">{option.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

