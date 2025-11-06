'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface Cycle {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  isStandard?: boolean
}

interface CyclePickerProps {
  onCycleSelect?: (cycle: Cycle) => void
  selectedCycleId?: string | null
  currentOrganizationId?: string
}

export function CyclePicker({ onCycleSelect, selectedCycleId, currentOrganizationId }: CyclePickerProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [cycleType, setCycleType] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('QUARTER')
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })

  // Load existing cycles
  useEffect(() => {
    if (currentOrganizationId) {
      loadCycles()
    }
  }, [currentOrganizationId])

  // Set selected cycle when selectedCycleId changes
  useEffect(() => {
    if (selectedCycleId && cycles.length > 0) {
      const cycle = cycles.find(c => c.id === selectedCycleId)
      if (cycle) {
        setSelectedCycle(cycle)
      }
    }
  }, [selectedCycleId, cycles])

  const loadCycles = async () => {
    if (!currentOrganizationId) return

    try {
      const res = await api.get('/okr/cycles')
      setCycles(res.data || [])
      
      // If we have a selectedCycleId, find and set it
      if (selectedCycleId) {
        const cycle = res.data?.find((c: Cycle) => c.id === selectedCycleId)
        if (cycle) {
          setSelectedCycle(cycle)
        }
      }
    } catch (error: any) {
      console.error('Failed to load cycles:', error)
    }
  }

  const handleCreateCycle = async () => {
    if (!currentOrganizationId) {
      toast({
        title: 'Error',
        description: 'Organization context required',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const res = await api.get(`/okr/cycles/get-or-create-standard?type=${cycleType}&date=${selectedDate}`)
      const newCycle = res.data

      // Add to cycles list if not already present
      setCycles(prev => {
        if (prev.find(c => c.id === newCycle.id)) {
          return prev
        }
        return [...prev, newCycle].sort((a, b) => 
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        )
      })

      setSelectedCycle(newCycle)
      
      if (onCycleSelect) {
        onCycleSelect(newCycle)
      }

      toast({
        title: 'Cycle Selected',
        description: `Selected ${newCycle.name}`,
      })
    } catch (error: any) {
      console.error('Failed to get or create cycle:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to get or create cycle',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCycleSelect = (cycleId: string) => {
    const cycle = cycles.find(c => c.id === cycleId)
    if (cycle) {
      setSelectedCycle(cycle)
      if (onCycleSelect) {
        onCycleSelect(cycle)
      }
    }
  }

  // Generate date options for the current year and next year
  const currentYear = new Date().getFullYear()
  const getQuarterDates = (year: number) => {
    return [
      { label: `Q1 ${year}`, date: `${year}-01-01` },
      { label: `Q2 ${year}`, date: `${year}-04-01` },
      { label: `Q3 ${year}`, date: `${year}-07-01` },
      { label: `Q4 ${year}`, date: `${year}-10-01` },
    ]
  }

  const getMonthDates = (year: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months.map((month, idx) => ({
      label: `${month} ${year}`,
      date: `${year}-${String(idx + 1).padStart(2, '0')}-01`,
    }))
  }

  const getYearDates = (startYear: number, endYear: number) => {
    const years = []
    for (let y = startYear; y <= endYear; y++) {
      years.push({ label: `${y}`, date: `${y}-01-01` })
    }
    return years
  }

  const getDateOptions = () => {
    switch (cycleType) {
      case 'MONTH':
        return [...getMonthDates(currentYear), ...getMonthDates(currentYear + 1)]
      case 'QUARTER':
        return [...getQuarterDates(currentYear), ...getQuarterDates(currentYear + 1)]
      case 'YEAR':
        return getYearDates(currentYear - 1, currentYear + 1)
      default:
        return []
    }
  }

  const dateOptions = getDateOptions()

  return (
    <div className="space-y-4">
      {/* Existing Cycles Selector */}
      {cycles.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Existing Cycle</label>
          <Select
            value={selectedCycle?.id || ''}
            onValueChange={handleCycleSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  <div className="flex items-center gap-2">
                    <span>{cycle.name}</span>
                    {cycle.isStandard && (
                      <span className="text-xs text-muted-foreground">(Standard)</span>
                    )}
                    {cycle.status !== 'ACTIVE' && cycle.status !== 'DRAFT' && (
                      <span className="text-xs text-muted-foreground">({cycle.status})</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Divider */}
      {cycles.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t"></div>
          <span className="text-xs text-muted-foreground">OR</span>
          <div className="flex-1 border-t"></div>
        </div>
      )}

      {/* Cycle Picker */}
      <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <h4 className="font-medium text-sm text-blue-900">Quick Select Standard Cycle</h4>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-blue-900">Cycle Type</label>
            <Select
              value={cycleType}
              onValueChange={(v) => {
                setCycleType(v as 'MONTH' | 'QUARTER' | 'YEAR')
                // Reset to first option of new type
                const options = v === 'MONTH' 
                  ? getMonthDates(currentYear)
                  : v === 'QUARTER'
                  ? getQuarterDates(currentYear)
                  : getYearDates(currentYear - 1, currentYear + 1)
                if (options.length > 0) {
                  setSelectedDate(options[0].date)
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QUARTER">Quarter</SelectItem>
                <SelectItem value="MONTH">Month</SelectItem>
                <SelectItem value="YEAR">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-blue-900">
              {cycleType === 'MONTH' ? 'Month' : cycleType === 'QUARTER' ? 'Quarter' : 'Year'}
            </label>
            <Select
              value={selectedDate}
              onValueChange={setSelectedDate}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((option) => (
                  <SelectItem key={option.date} value={option.date}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCreateCycle}
            disabled={loading}
            className="w-full"
            size="sm"
          >
            {loading ? 'Selecting...' : `Select ${dateOptions.find(o => o.date === selectedDate)?.label || 'Cycle'}`}
          </Button>
        </div>

        <p className="text-xs text-blue-700 mt-2">
          Standard cycles (months, quarters, years) are created automatically when selected.
        </p>
      </div>

      {/* Selected Cycle Display */}
      {selectedCycle && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">Selected: {selectedCycle.name}</p>
          <p className="text-xs text-green-700">
            {new Date(selectedCycle.startDate).toLocaleDateString('en-GB')} - {new Date(selectedCycle.endDate).toLocaleDateString('en-GB')}
          </p>
        </div>
      )}
    </div>
  )
}


