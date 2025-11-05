'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CycleSelector } from '@/components/ui/CycleSelector'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'

interface OKRFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  selectedStatus: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | null
  onStatusChange: (status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | null) => void
  selectedScope: 'my' | 'team-workspace' | 'tenant'
  selectedCycleId: string | null
  normalizedCycles: Array<{
    id: string
    name: string
    status: string
    startsAt: string
    endsAt: string
  }>
  legacyPeriods: Array<{
    id: string
    name: string
    startDate: string
    endDate: string
  }>
  selectedTimeframeKey: string
  onCycleSelect: (opt: { key: string; label: string }) => void
  onManageCycles?: () => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function OKRFilterBar({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedScope,
  selectedCycleId,
  normalizedCycles,
  legacyPeriods,
  selectedTimeframeKey,
  onCycleSelect,
  onManageCycles,
  hasActiveFilters,
  onClearFilters,
}: OKRFilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    onSearchChange(value)
    // Telemetry: filter applied (search)
    track('filter_applied', {
      scope: selectedScope,
      q: value,
      status: selectedStatus,
      cycle_id: selectedCycleId,
      ts: new Date().toISOString(),
    })
  }

  const handleStatusChange = (status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | null) => {
    onStatusChange(status)
    // Telemetry: filter applied (status)
    track('filter_applied', {
      scope: selectedScope,
      status,
      q: searchQuery,
      cycle_id: selectedCycleId,
      ts: new Date().toISOString(),
    })
  }

  return (
    <>
      <div className="flex-1 relative min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input 
          placeholder="Search OKRs..." 
          className="pl-10"
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>
      
      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Status filters">
            <button
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedStatus === null
                  ? "bg-violet-100 text-violet-700 border border-violet-300"
                  : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
              )}
              onClick={() => handleStatusChange(null)}
              aria-label="Show all statuses"
              aria-pressed={selectedStatus === null}
            >
              All statuses
            </button>
            <button
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedStatus === 'ON_TRACK'
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
              )}
              onClick={() => handleStatusChange('ON_TRACK')}
              aria-label="Filter by status: On track"
              aria-pressed={selectedStatus === 'ON_TRACK'}
            >
              On track
            </button>
            <button
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedStatus === 'AT_RISK'
                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                  : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
              )}
              onClick={() => handleStatusChange('AT_RISK')}
              aria-label="Filter by status: At risk"
              aria-pressed={selectedStatus === 'AT_RISK'}
            >
              At risk
            </button>
            <button
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedStatus === 'BLOCKED'
                  ? "bg-rose-100 text-rose-700 border border-rose-300"
                  : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
              )}
              onClick={() => handleStatusChange('BLOCKED')}
              aria-label="Filter by status: Blocked"
              aria-pressed={selectedStatus === 'BLOCKED'}
            >
              Blocked
            </button>
            <button
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedStatus === 'COMPLETED'
                  ? "bg-neutral-200 text-neutral-800 border border-neutral-400"
                  : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
              )}
              onClick={() => handleStatusChange('COMPLETED')}
              aria-label="Filter by status: Completed"
              aria-pressed={selectedStatus === 'COMPLETED'}
            >
              Completed
            </button>
            <button
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedStatus === 'CANCELLED'
                  ? "bg-neutral-200 text-neutral-800 border border-neutral-400"
                  : "bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200"
              )}
              onClick={() => handleStatusChange('CANCELLED')}
              aria-label="Filter by status: Cancelled"
              aria-pressed={selectedStatus === 'CANCELLED'}
            >
              Cancelled
            </button>
          </div>

      {/* W4.M1: Cycle selector only (periods removed) */}
      <CycleSelector
        cycles={normalizedCycles}
        legacyPeriods={legacyPeriods}
        selectedId={selectedTimeframeKey}
        onSelect={onCycleSelect}
        onManageCycles={onManageCycles}
      />
      
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear Filters
        </Button>
      )}
    </>
  )
}

