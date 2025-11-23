'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UnitInputProps {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  id?: string
  label?: string
  placeholder?: string
  className?: string
}

// Common units based on imported data and typical OKR metrics
const COMMON_UNITS = [
  // Percentage
  '%',
  'Percentage',
  // Currency
  '$',
  'USD',
  'EUR',
  'GBP',
  'NOK',
  'MNOK',
  'KNOK',
  'Dollar',
  // Counts
  'users',
  'customers',
  'accounts',
  'deployments',
  'reviews',
  'cases',
  'tickets',
  'vulnerabilities',
  // Time
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  // Rates & Ratios
  'ratio',
  'rate',
  // Other
  'Number',
  'score',
  'points',
]

export function UnitInput({
  value,
  onValueChange,
  disabled = false,
  id = 'unit',
  label = 'Unit',
  placeholder = 'e.g., users, hours, %, $',
  className,
}: UnitInputProps) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter suggestions based on input
  const filteredUnits = value
    ? COMMON_UNITS.filter((unit) =>
        unit.toLowerCase().includes(value.toLowerCase())
      )
    : COMMON_UNITS

  const handleSelect = (unit: string) => {
    onValueChange(unit)
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              id={id}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className="h-9 pr-8"
            />
            <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search units..." />
            <CommandList>
              <CommandEmpty>No units found.</CommandEmpty>
              <CommandGroup>
                {filteredUnits.slice(0, 10).map((unit) => (
                  <CommandItem
                    key={unit}
                    value={unit}
                    onSelect={() => handleSelect(unit)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === unit ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {unit}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}


