'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CycleSelector } from '@/components/ui/CycleSelector'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface OKRFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  selectedStatus: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | null
  onStatusChange: (status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | null) => void
  selectedScope: 'my' | 'team-workspace' | 'tenant'
  onScopeChange: (scope: 'my' | 'team-workspace' | 'tenant') => void
  availableScopes: Array<'my' | 'team-workspace' | 'tenant'>
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
  // New filter props
  myOkrsOnly: boolean
  onMyOkrsToggle: (enabled: boolean) => void
  selectedVisibility: 'ALL' | 'PUBLIC_TENANT' | 'PRIVATE'
  onVisibilityChange: (visibility: 'ALL' | 'PUBLIC_TENANT' | 'PRIVATE') => void
  selectedOwnerId: string | null
  onOwnerChange: (ownerId: string | null) => void
  availableUsers: Array<{ id: string; name: string; email?: string }>
  currentUserId?: string | null
  selectedPillarId?: string | null
  onPillarChange?: (pillarId: string | null) => void
}

export function OKRFilterBar({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedScope,
  onScopeChange,
  availableScopes,
  selectedCycleId,
  normalizedCycles,
  legacyPeriods,
  selectedTimeframeKey,
  onCycleSelect,
  onManageCycles,
  hasActiveFilters,
  onClearFilters,
  myOkrsOnly,
  onMyOkrsToggle,
  selectedVisibility,
  onVisibilityChange,
  selectedOwnerId,
  onOwnerChange,
  selectedPillarId,
  onPillarChange,
  availableUsers,
  currentUserId,
}: OKRFilterBarProps) {
  const [availablePillars, setAvailablePillars] = React.useState<Array<{ id: string; name: string; color: string | null }>>([])

  React.useEffect(() => {
    // Load pillars for filter dropdown
    api.get('/reports/pillars')
      .then((res) => {
        setAvailablePillars(res.data || [])
      })
      .catch((err) => {
        console.error('Failed to load pillars:', err)
      })
  }, [])
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

  const handleScopeChange = (newScope: 'my' | 'team-workspace' | 'tenant') => {
    onScopeChange(newScope)
    // When scope changes to 'my', also enable myOkrsOnly
    if (newScope === 'my' && !myOkrsOnly) {
      onMyOkrsToggle(true)
    } else if (newScope !== 'my' && myOkrsOnly) {
      onMyOkrsToggle(false)
    }
    track('filter_applied', {
      filter: 'scope',
      scope: newScope,
      ts: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Primary Filters - Scope, Visibility, Search */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Unified Scope Selector */}
        {availableScopes.length > 0 && (
          <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 p-1" role="group" aria-label="Scope filter">
            {availableScopes.includes('my') && (
              <button
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
                  selectedScope === 'my'
                    ? "bg-violet-600 text-white shadow-md hover:bg-violet-700"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                )}
                onClick={() => handleScopeChange('my')}
                aria-pressed={selectedScope === 'my'}
              >
                My OKRs
              </button>
            )}
            {availableScopes.includes('team-workspace') && (
              <button
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
                  selectedScope === 'team-workspace'
                    ? "bg-violet-600 text-white shadow-md hover:bg-violet-700"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                )}
                onClick={() => handleScopeChange('team-workspace')}
                aria-pressed={selectedScope === 'team-workspace'}
              >
                Team/Workspace OKRs
              </button>
            )}
            {availableScopes.includes('tenant') && (
              <button
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
                  selectedScope === 'tenant'
                    ? "bg-violet-600 text-white shadow-md hover:bg-violet-700"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                )}
                onClick={() => handleScopeChange('tenant')}
                aria-pressed={selectedScope === 'tenant'}
              >
                Company OKRs
              </button>
            )}
          </div>
        )}

        {/* Visibility Filter */}
        <Select
          value={selectedVisibility}
          onValueChange={(value) => {
            onVisibilityChange(value as 'ALL' | 'PUBLIC_TENANT' | 'PRIVATE')
            track('filter_applied', {
              filter: 'visibility',
              value,
              ts: new Date().toISOString(),
            })
          }}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Visibility</SelectItem>
            <SelectItem value="PUBLIC_TENANT">Public</SelectItem>
            <SelectItem value="PRIVATE">Private</SelectItem>
          </SelectContent>
        </Select>

        {/* Search Input */}
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search OKRs..." 
            className="pl-10 h-9"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Row 2: Secondary Filters - Status, Cycle, Owner */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status Filter */}
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Status filters">
          <button
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
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
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
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
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
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
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
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
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
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
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none h-9",
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

        {/* Cycle Selector */}
        <CycleSelector
          cycles={normalizedCycles}
          legacyPeriods={legacyPeriods}
          selectedId={selectedTimeframeKey}
          onSelect={onCycleSelect}
          onManageCycles={onManageCycles}
        />

        {/* Owner Filter - only show if scope is not 'my' */}
        {selectedScope !== 'my' && (
          <Select
            value={selectedOwnerId === currentUserId ? 'me' : (selectedOwnerId || 'all')}
            onValueChange={(value) => {
              onOwnerChange(value === 'all' ? null : value === 'me' ? 'me' : value)
              track('filter_applied', {
                filter: 'owner',
                ownerId: value === 'all' ? null : value === 'me' ? 'me' : value,
                ts: new Date().toISOString(),
              })
            }}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              <SelectItem value="me">Me</SelectItem>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email || user.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

