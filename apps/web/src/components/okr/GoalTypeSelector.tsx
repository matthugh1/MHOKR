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
    <div className={className}>
      {label && (
        <Label htmlFor={id}>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <Select
        value={value || 'ASPIRATIONAL'}
        onValueChange={handleChange}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger id={id} className={label ? 'mt-1.5' : ''}>
          <SelectValue placeholder="Select goal type" />
        </SelectTrigger>
        <SelectContent>
          {GOAL_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

