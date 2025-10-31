'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface CycleSelectorProps {
  cycles: Array<{
    id: string
    name: string // e.g. "Q4 2025"
    status: string // e.g. "ACTIVE" | "LOCKED" | "DRAFT" | "ARCHIVED"
    startsAt?: string // ISO timestamp, optional
    endsAt?: string // ISO timestamp, optional
  }>
  selectedCycleId: string | null
  onSelect: (cycleId: string) => void
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'ACTIVE':
      return 'Active'
    case 'LOCKED':
      return 'Locked'
    case 'DRAFT':
      return 'Draft'
    default:
      return status
  }
}

/**
 * @module CycleSelector
 * @see {@link https://github.com/matthugh1/MHOKR/blob/main/docs/architecture/DESIGN_SYSTEM.md Design System Documentation}
 * 
 * CycleSelector - Compact, reusable cycle selection component
 * 
 * Displays the currently selected cycle with a popover menu for selecting from
 * grouped cycles (Current & Upcoming vs Previous). Shows cycle status badges.
 * 
 * @example
 * ```tsx
 * <CycleSelector
 *   cycles={cycles}
 *   selectedCycleId={selectedCycleId}
 *   onSelect={(id) => setSelectedCycleId(id)}
 * />
 * ```
 */
export function CycleSelector({ cycles, selectedCycleId, onSelect }: CycleSelectorProps) {
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

  const selectedCycle = cycles.find(c => c.id === selectedCycleId)
  const selectedCycleName = selectedCycle?.name || 'Select cycle...'
  const selectedCycleStatus = selectedCycle?.status || ''

  // Group cycles: Current & Upcoming vs Previous
  const now = new Date()
  const currentAndUpcoming = cycles.filter(cycle => {
    // Include ACTIVE or DRAFT cycles
    if (cycle.status === 'ACTIVE' || cycle.status === 'DRAFT') {
      return true
    }
    // Include cycles with startsAt in the future (if we have timestamps)
    if (cycle.startsAt) {
      const startDate = new Date(cycle.startsAt)
      return startDate >= now
    }
    return false
  })

  const previous = cycles
    .filter(cycle => !currentAndUpcoming.includes(cycle))
    .sort((a, b) => {
      // Sort descending by startsAt/endsAt if available
      const aDate = a.startsAt ? new Date(a.startsAt) : (a.endsAt ? new Date(a.endsAt) : new Date(0))
      const bDate = b.startsAt ? new Date(b.startsAt) : (b.endsAt ? new Date(b.endsAt) : new Date(0))
      return bDate.getTime() - aDate.getTime()
    })
    .slice(0, 5) // Limit to 5 items

  const handleSelect = (cycleId: string) => {
    onSelect(cycleId)
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
        className="rounded-lg border border-neutral-200 bg-white shadow-sm px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex flex-col items-start flex-1 min-w-0">
          <span className="text-sm font-medium text-neutral-900 truncate w-full">
            {selectedCycleName}
          </span>
          {selectedCycleStatus && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-300 text-neutral-600 bg-neutral-50">
              {getStatusLabel(selectedCycleStatus)}
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-neutral-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 rounded-lg border border-neutral-200 bg-white shadow-lg p-3">
          {/* Current & Upcoming Section */}
          {currentAndUpcoming.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Current & Upcoming
              </div>
              <div className="space-y-1">
                {currentAndUpcoming.map((cycle) => (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() => handleSelect(cycle.id)}
                    className={`w-full text-left px-2 py-2 rounded-md hover:bg-neutral-50 flex items-center justify-between ${
                      cycle.id === selectedCycleId ? 'bg-neutral-100' : ''
                    }`}
                  >
                    <span className="text-sm text-neutral-900">{cycle.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-300 text-neutral-600 bg-neutral-50">
                      {getStatusLabel(cycle.status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Previous Section */}
          {previous.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-2">
                Previous
              </div>
              <div className="space-y-1">
                {previous.map((cycle) => (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() => handleSelect(cycle.id)}
                    className={`w-full text-left px-2 py-2 rounded-md hover:bg-neutral-50 flex items-center justify-between ${
                      cycle.id === selectedCycleId ? 'bg-neutral-100' : ''
                    }`}
                  >
                    <span className="text-sm text-neutral-900">{cycle.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-300 text-neutral-600 bg-neutral-50">
                      {getStatusLabel(cycle.status)}
                    </span>
                  </button>
                ))}
              </div>
              {/* TODO [phase7-hardening]: Implement full "view all cycles" navigation */}
              {cycles.length > currentAndUpcoming.length + previous.length && (
                <div className="text-xs text-neutral-400 italic px-2 py-1 mt-2">
                  View all cycles…
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {currentAndUpcoming.length === 0 && previous.length === 0 && (
            <div className="text-sm text-neutral-500 px-2 py-2">
              No cycles available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

