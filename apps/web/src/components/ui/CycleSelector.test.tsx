// NOTE [phase14-hardening]:
// Test scaffold created in Phase 11. We have not yet wired Jest/RTL.
// @ts-nocheck is intentional to unblock main without removing test intent.

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * @fileoverview Unit tests for CycleSelector component
 * 
 * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CycleSelector } from './CycleSelector'

describe('CycleSelector', () => {
  const mockActiveCycles = [
    {
      id: 'cycle-1',
      name: 'Q4 2025',
      status: 'ACTIVE',
      startsAt: '2025-10-01T00:00:00Z',
      endsAt: '2025-12-31T23:59:59Z',
    },
    {
      id: 'cycle-2',
      name: 'Q1 2026',
      status: 'DRAFT',
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2026-03-31T23:59:59Z',
    },
  ]

  const mockPreviousCycles = [
    {
      id: 'cycle-3',
      name: 'Q3 2025',
      status: 'LOCKED',
      startsAt: '2025-07-01T00:00:00Z',
      endsAt: '2025-09-30T23:59:59Z',
    },
    {
      id: 'cycle-4',
      name: 'Q2 2025',
      status: 'ARCHIVED',
      startsAt: '2025-04-01T00:00:00Z',
      endsAt: '2025-06-30T23:59:59Z',
    },
    {
      id: 'cycle-5',
      name: 'Q1 2025',
      status: 'ARCHIVED',
      startsAt: '2025-01-01T00:00:00Z',
      endsAt: '2025-03-31T23:59:59Z',
    },
  ]

  const allCycles = [...mockActiveCycles, ...mockPreviousCycles]

  it('renders without crashing', () => {
    const handleSelect = jest.fn()
    render(
      <CycleSelector
        cycles={allCycles}
        selectedCycleId="cycle-1"
        onSelect={handleSelect}
      />
    )
    expect(screen.getByText('Q4 2025')).toBeInTheDocument()
  })

  it('displays the selected cycle name', () => {
    const handleSelect = jest.fn()
    render(
      <CycleSelector
        cycles={allCycles}
        selectedCycleId="cycle-1"
        onSelect={handleSelect}
      />
    )
    expect(screen.getByText('Q4 2025')).toBeInTheDocument()
  })

  it('displays status badge for selected cycle', () => {
    const handleSelect = jest.fn()
    render(
      <CycleSelector
        cycles={allCycles}
        selectedCycleId="cycle-1"
        onSelect={handleSelect}
      />
    )
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('opens popover when trigger is clicked', () => {
    const handleSelect = jest.fn()
    render(
      <CycleSelector
        cycles={allCycles}
        selectedCycleId="cycle-1"
        onSelect={handleSelect}
      />
    )
    
    const trigger = screen.getByRole('button', { name: /Q4 2025/i })
    fireEvent.click(trigger)
    
    expect(screen.getByText('Current & Upcoming')).toBeInTheDocument()
  })

  it('calls onSelect when a cycle is selected', () => {
    const handleSelect = jest.fn()
    render(
      <CycleSelector
        cycles={allCycles}
        selectedCycleId="cycle-1"
        onSelect={handleSelect}
      />
    )
    
    const trigger = screen.getByRole('button', { name: /Q4 2025/i })
    fireEvent.click(trigger)
    
    const cycleOption = screen.getByText('Q1 2026')
    fireEvent.click(cycleOption)
    
    expect(handleSelect).toHaveBeenCalledWith('cycle-2')
  })

  it('displays "Previous" section with previous cycles', () => {
    const handleSelect = jest.fn()
    render(
      <CycleSelector
        cycles={allCycles}
        selectedCycleId="cycle-1"
        onSelect={handleSelect}
      />
    )
    
    const trigger = screen.getByRole('button', { name: /Q4 2025/i })
    fireEvent.click(trigger)
    
    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText('Q3 2025')).toBeInTheDocument()
  })

  it('shows empty state when no cycles are available', () => {
    const handleSelect = jest.fn()
    render(
      <CycleSelector
        cycles={[]}
        selectedCycleId={null}
        onSelect={handleSelect}
      />
    )
    
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    
    expect(screen.getByText('No cycles available')).toBeInTheDocument()
  })
})

