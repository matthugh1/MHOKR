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
  onSelect: (opt: { key: string; label: string }) => void
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
    : selectedId === 'unassigned'
    ? 'Unassigned / Backlog'
    : selectedId === 'all'
    ? 'All periods'
    : 'Select cycle / period'

  // Group cycles: Current & Upcoming
  const currentAndUpcoming = cycles.filter(cycle => {
    return cycle.status === 'ACTIVE' || cycle.status === 'UPCOMING' || cycle.status === 'DRAFT'
  })

  // Previous cycles (LOCKED, ARCHIVED)
  const previousCycles = cycles.filter(cycle => {
    return cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED'
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

  const handleSelect = (key: string, label: string) => {
    onSelect({ key, label })
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
              {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Current & Upcoming
              </div>
              <div className="space-y-1">
                {currentAndUpcoming.map((cycle) => (
                  <div
                    key={cycle.id}
                    onClick={() => handleSelect(cycle.id, cycle.name)}
                    className="rounded-md hover:bg-neutral-100 cursor-pointer text-sm text-neutral-700 flex items-center justify-between w-full px-3 py-2"
                  >
                    <span className="font-medium text-neutral-800">{cycle.name}</span>
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                      {/* TODO [phase7-hardening]: drive statuses from backend cycle.status */}
                      {/* NOTE: This surface is internal-tenant-only and is not exposed to external design partners. */}
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
                {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
              </div>
            </div>
          )}

          {/* Previous Section */}
          {previousCycles.length > 0 ? (
            <div className="mb-4">
              {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Previous
              </div>
              <div className="max-h-[160px] overflow-y-auto space-y-1">
                {previousCycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    onClick={() => handleSelect(cycle.id, cycle.name)}
                    className="rounded-md hover:bg-neutral-100 cursor-pointer text-sm text-neutral-700 flex items-center justify-between w-full px-3 py-2"
                  >
                    <span className="font-medium text-neutral-800">{cycle.name}</span>
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                      {/* TODO [phase7-hardening]: drive statuses from backend cycle.status */}
                      {/* NOTE: This surface is internal-tenant-only and is not exposed to external design partners. */}
                      {getStatusLabel(cycle.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Legacy Periods Section */}
          {legacyPeriods.length > 0 ? (
            <div className="mb-4">
              {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Planning / historical periods
              </div>
              <div className="max-h-[160px] overflow-y-auto space-y-1">
                {legacyPeriods.map((period) => (
                  <div
                    key={period.id}
                    onClick={() => handleSelect(period.id, period.label)}
                    className="rounded-md hover:bg-neutral-100 cursor-pointer text-sm text-neutral-700 flex items-center justify-between w-full px-3 py-2"
                  >
                    <span className="font-medium text-neutral-800">{period.label}</span>
                    {period.isFuture && (
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                        Future
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Special Section */}
          <div>
            {/* TODO [phase6-polish]: visual grouping headers in popover */}
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
              Special
            </div>
            <div className="space-y-1">
              <div
                onClick={() => handleSelect('unassigned', 'Unassigned / Backlog')}
                className={`rounded-md hover:bg-neutral-100 cursor-pointer text-sm text-neutral-700 flex items-center justify-between w-full px-3 py-2 ${
                  selectedId === 'unassigned' ? 'bg-neutral-100' : ''
                }`}
              >
                <span className="font-medium text-neutral-800">Unassigned / Backlog</span>
              </div>
              <div
                onClick={() => handleSelect('all', 'All periods')}
                className={`rounded-md hover:bg-neutral-100 cursor-pointer text-sm text-neutral-700 flex items-center justify-between w-full px-3 py-2 ${
                  selectedId === 'all' ? 'bg-neutral-100' : ''
                }`}
              >
                <span className="font-medium text-neutral-800">All periods</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
