'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface StandardCycleSelectorProps {
  value?: string | null
  onValueChange: (cycleId: string) => void
  currentOrganizationId?: string
  disabled?: boolean
}

export function StandardCycleSelector({
  value,
  onValueChange,
  currentOrganizationId,
  disabled = false,
}: StandardCycleSelectorProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [cycleType, setCycleType] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('QUARTER')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(value || null)

  // Sync with external value prop
  useEffect(() => {
    if (value !== selectedCycleId) {
      setSelectedCycleId(value || null)
    }
  }, [value])

  // Clear selection when value is cleared externally
  useEffect(() => {
    if (!value && selectedPeriod) {
      setSelectedPeriod('')
    }
  }, [value, selectedPeriod])

  const currentYear = new Date().getFullYear()
  
  // Generate quarter options
  const getQuarterOptions = (year: number) => [
    { label: `Q1 ${year}`, date: `${year}-01-01` },
    { label: `Q2 ${year}`, date: `${year}-04-01` },
    { label: `Q3 ${year}`, date: `${year}-07-01` },
    { label: `Q4 ${year}`, date: `${year}-10-01` },
  ]

  // Generate month options
  const getMonthOptions = (year: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months.map((month, idx) => ({
      label: `${month} ${year}`,
      date: `${year}-${String(idx + 1).padStart(2, '0')}-01`,
    }))
  }

  // Generate year options
  const getYearOptions = (startYear: number, endYear: number) => {
    const years = []
    for (let y = startYear; y <= endYear; y++) {
      years.push({ label: `${y}`, date: `${y}-01-01` })
    }
    return years
  }

  const getPeriodOptions = () => {
    switch (cycleType) {
      case 'QUARTER':
        return [...getQuarterOptions(currentYear), ...getQuarterOptions(currentYear + 1)]
      case 'MONTH':
        return [...getMonthOptions(currentYear), ...getMonthOptions(currentYear + 1)]
      case 'YEAR':
        return getYearOptions(currentYear - 1, currentYear + 1)
      default:
        return []
    }
  }

  const handlePeriodSelect = async (date: string) => {
    if (!currentOrganizationId || !date) {
      toast({
        title: 'Error',
        description: 'Organization context and date are required',
        variant: 'destructive',
      })
      return
    }

    setSelectedPeriod(date)
    setLoading(true)

    try {
      const res = await api.get(`/okr/cycles/get-or-create-standard?type=${cycleType}&date=${date}`)
      const cycle = res.data
      
      if (!cycle || !cycle.id) {
        throw new Error('Invalid cycle response: missing cycle ID')
      }

      // Validate cycle ID is not a route path (safety check)
      if (cycle.id.includes('/') || cycle.id === 'get-or-create-standard') {
        throw new Error('Invalid cycle ID received from server')
      }
      
      setSelectedCycleId(cycle.id)
      onValueChange(cycle.id)
    } catch (error: any) {
      console.error('Failed to get or create cycle:', error)
      // Reset the period selection on error
      setSelectedPeriod('')
      setSelectedCycleId(null)
      onValueChange('')
      
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to get or create cycle',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Reset period when type changes
  const handleTypeChange = (newType: 'MONTH' | 'QUARTER' | 'YEAR') => {
    setCycleType(newType)
    setSelectedPeriod('')
    setSelectedCycleId(null)
    onValueChange('')
  }

  const periodOptions = getPeriodOptions()

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="cycle-type">
          Cycle Type <span className="text-red-500">*</span>
        </Label>
        <Select
          value={cycleType}
          onValueChange={handleTypeChange}
          disabled={disabled}
        >
          <SelectTrigger id="cycle-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="QUARTER">Quarter</SelectItem>
            <SelectItem value="MONTH">Month</SelectItem>
            <SelectItem value="YEAR">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cycle-period">
          {cycleType === 'MONTH' ? 'Month' : cycleType === 'QUARTER' ? 'Quarter' : 'Year'} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={selectedPeriod}
          onValueChange={handlePeriodSelect}
          disabled={disabled || loading}
        >
          <SelectTrigger id="cycle-period">
            <SelectValue placeholder={`Select ${cycleType.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.date} value={option.date}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && (
          <p className="text-xs text-muted-foreground">Creating cycle...</p>
        )}
        <p className="text-xs text-muted-foreground">
          The cycle will be created automatically if it doesn't exist.
        </p>
      </div>
    </div>
  )
}

