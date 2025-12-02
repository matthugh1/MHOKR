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
  'percent',
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
  'employees',
  'members',
  'projects',
  'features',
  'releases',
  'products',
  'orders',
  'transactions',
  // Time
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'quarters',
  'years',
  // Rates & Ratios
  'ratio',
  'rate',
  'per hour',
  'per day',
  'per week',
  'per month',
  // Other
  'units',
  'Number',
  'score',
  'points',
  'NPS',
  'CSAT',
  'sessions',
  'page views',
  'conversions',
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

  const handleSelect = (unit: string) => {
    onValueChange(unit)
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="text-sm font-medium text-slate-200">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          <PopoverTrigger asChild>
            <Input
              ref={inputRef}
              id={id}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className="h-10 pr-8 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
            />
          </PopoverTrigger>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(!open)
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0 border-0 bg-transparent cursor-pointer hover:text-slate-300 transition-colors z-10"
            aria-label="Toggle unit dropdown"
          >
            <ChevronsUpDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-800 border-slate-700" align="start">
          <Command className="bg-slate-800" shouldFilter={true}>
            <CommandInput 
              placeholder="Search units..." 
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" 
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty className="text-slate-400 py-2">No units found.</CommandEmpty>
              <CommandGroup>
                {COMMON_UNITS.map((unit) => (
                  <CommandItem
                    key={unit}
                    value={unit}
                    onSelect={() => handleSelect(unit)}
                    className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer"
                    style={{ opacity: 1, pointerEvents: 'auto' }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === unit ? 'opacity-100 text-indigo-400' : 'opacity-0'
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


