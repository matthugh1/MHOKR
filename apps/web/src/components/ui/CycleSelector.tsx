'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface CycleSelectorProps {
  cycles: Array<{
    id: string
    name: string
    status: 'ACTIVE' | 'UPCOMING' | 'LOCKED' | 'ARCHIVED' | string
    startsAt?: string | undefined
    endsAt?: string | undefined
  }>
  /** legacyPeriods is the list of past/future planning buckets we previously showed in the giant <select> */
  legacyPeriods: Array<{
    id: string // e.g. "2025-Q1", "2025-Q2-planning"
    label: string // e.g. "Q1 2025 (planning)", "Q2 2025 (draft)"
    isFuture?: boolean // optional marker for styling
  }>
  /** currently selected item, can be either a cycle.id or a legacyPeriod.id */
  selectedId: string | null
  onSelect: (id: string) => void
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'ACTIVE':
      return 'Active'
    case 'UPCOMING':
      return 'Upcoming'
    case 'LOCKED':
      return 'Locked'
    case 'DRAFT':
      return 'Draft'
    case 'ARCHIVED':
      return 'Archived'
    default:
      return status
  }
}

/**
 * @module CycleSelector
 * @see {@link https://github.com/matthugh1/MHOKR/blob/main/docs/architecture/DESIGN_SYSTEM.md Design System Documentation}
 * 
 * CycleSelector - Unified cycle and period selection component
 * 
 * Displays the currently selected cycle or period with a popover menu for selecting from
 * cycles (Current & Upcoming, All Cycles) and legacy planning periods.
 * 
 * @example
 * ```tsx
 * <CycleSelector
 *   cycles={cycles}
 *   legacyPeriods={legacyPeriods}
 *   selectedId={selectedId}
 *   onSelect={(id) => setSelectedId(id)}
 * />
 * ```
 */
export function CycleSelector({ cycles, legacyPeriods, selectedId, onSelect }: CycleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  // Determine what label to show on the button
  const selectedCycle = cycles.find(c => c.id === selectedId)
  const selectedPeriod = legacyPeriods.find(p => p.id === selectedId)
  const buttonLabel = selectedCycle
    ? selectedCycle.name
    : selectedPeriod
    ? selectedPeriod.label
    : 'Select cycle / period'

  // Group cycles: Current & Upcoming
  const currentAndUpcoming = cycles.filter(cycle => {
    return cycle.status === 'ACTIVE' || cycle.status === 'UPCOMING' || cycle.status === 'DRAFT'
  })

  // All cycles (sorted by status priority, then by date)
  const allCycles = [...cycles].sort((a, b) => {
    const statusOrder = { ACTIVE: 0, UPCOMING: 1, DRAFT: 2, LOCKED: 3, ARCHIVED: 4 }
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 99
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    
    // If same status, sort by date
    const aDate = a.startsAt ? new Date(a.startsAt) : (a.endsAt ? new Date(a.endsAt) : new Date(0))
    const bDate = b.startsAt ? new Date(b.startsAt) : (b.endsAt ? new Date(b.endsAt) : new Date(0))
    return bDate.getTime() - aDate.getTime()
  })

  const handleSelect = (id: string) => {
    onSelect(id)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm flex items-center gap-2 hover:bg-neutral-50 transition-colors"
      >
        <span className="font-medium text-neutral-800 truncate">{buttonLabel}</span>
        <ChevronDown className={`h-4 w-4 text-neutral-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-72 rounded-lg border border-neutral-200 bg-white shadow-lg p-3">
          {/* Current & Upcoming Section */}
          {currentAndUpcoming.length > 0 ? (
            <div className="mb-4">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Current & Upcoming
              </div>
              <div className="space-y-1">
                {currentAndUpcoming.map((cycle) => (
                  <div
                    key={cycle.id}
                    onClick={() => handleSelect(cycle.id)}
                    className={`flex items-center justify-between px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer rounded-md ${
                      cycle.id === selectedId ? 'bg-neutral-100' : ''
                    }`}
                  >
                    <span className="font-medium text-neutral-800">{cycle.name}</span>
                    <span className="text-[10px] px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                      {getStatusLabel(cycle.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <div className="text-xs text-neutral-500 px-3 py-2">
                No cycles defined yet.
                {/* [phase6-polish]: CTA to create first cycle */}
              </div>
            </div>
          )}

          {/* All Cycles Section */}
          {allCycles.length > 0 ? (
            <div className="mb-4">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                All Cycles
              </div>
              <div className="max-h-[160px] overflow-y-auto space-y-1">
                {allCycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    onClick={() => handleSelect(cycle.id)}
                    className={`flex items-center justify-between px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer rounded-md ${
                      cycle.id === selectedId ? 'bg-neutral-100' : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-800">{cycle.name}</span>
                    </div>
                    <span className="text-[10px] px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                      {getStatusLabel(cycle.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Planning / Historical Periods Section */}
          {legacyPeriods.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Planning / historical periods
              </div>
              <div className="max-h-[160px] overflow-y-auto space-y-1">
                {legacyPeriods.map((period) => (
                  <div
                    key={period.id}
                    onClick={() => handleSelect(period.id)}
                    className={`flex items-center justify-between px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer rounded-md ${
                      period.id === selectedId ? 'bg-neutral-100' : ''
                    }`}
                  >
                    <span className="font-medium text-neutral-800">{period.label}</span>
                    {period.isFuture && (
                      <span className="text-[10px] px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                        Future
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Planning / historical periods
              </div>
              <div className="text-xs text-neutral-500 px-3 py-2">
                No historical / planning periods.
                {/* [phase6-polish]: This will list planning windows once defined */}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
