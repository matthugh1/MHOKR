// Storybook types - uncomment when @storybook/react is installed
// import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { CycleSelector } from './CycleSelector'

// Placeholder types for Storybook readiness (install @storybook/react to enable)
type Meta<T> = { title: string; component: T; parameters?: Record<string, unknown>; tags?: string[] }
type StoryObj<T extends keyof React.JSX.IntrinsicElements | React.JSXElementConstructor<any>> = { 
  args?: Partial<React.ComponentProps<T>>
  render?: () => React.ReactElement
}

/**
 * @module CycleSelector
 * @see {@link https://github.com/matthugh1/MHOKR/blob/main/docs/architecture/DESIGN_SYSTEM.md Design System Documentation}
 * 
 * CycleSelector - Compact, reusable cycle selection component
 * 
 * Displays the currently selected cycle with a popover menu for selecting from
 * grouped cycles (Current & Upcoming vs Previous). Shows cycle status badges.
 */

const meta: Meta<typeof CycleSelector> = {
  title: 'UI/CycleSelector',
  component: CycleSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CycleSelector>

const mockCyclesDefault = [
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
]

// Interactive wrapper component
const InteractiveCycleSelector = ({ cycles, legacyPeriods, initialSelected }: { cycles: typeof mockCyclesDefault; legacyPeriods?: Array<{ id: string; label: string; isFuture?: boolean }>; initialSelected?: string | null }) => {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected || cycles[0]?.id || null)
  
  return (
    <CycleSelector
      cycles={cycles}
      legacyPeriods={legacyPeriods || []}
      selectedId={selectedId}
      onSelect={(opt) => setSelectedId(opt.key)}
    />
  )
}

export const Default: Story = {
  render: () => <InteractiveCycleSelector cycles={mockCyclesDefault} legacyPeriods={[]} />,
}

export const LockedCycleSelected: Story = {
  render: () => <InteractiveCycleSelector cycles={mockCyclesDefault} legacyPeriods={[]} initialSelected="cycle-3" />,
}

export const DraftUpcomingCycle: Story = {
  render: () => <InteractiveCycleSelector cycles={mockCyclesDefault} legacyPeriods={[]} initialSelected="cycle-2" />,
}

export const ManyCycles: Story = {
  render: () => {
    const manyCycles = [
      ...mockCyclesDefault,
      {
        id: 'cycle-5',
        name: 'Q1 2025',
        status: 'ARCHIVED',
        startsAt: '2025-01-01T00:00:00Z',
        endsAt: '2025-03-31T23:59:59Z',
      },
      {
        id: 'cycle-6',
        name: 'Q4 2024',
        status: 'ARCHIVED',
        startsAt: '2024-10-01T00:00:00Z',
        endsAt: '2024-12-31T23:59:59Z',
      },
      {
        id: 'cycle-7',
        name: 'Q3 2024',
        status: 'ARCHIVED',
        startsAt: '2024-07-01T00:00:00Z',
        endsAt: '2024-09-30T23:59:59Z',
      },
    ]
    return <InteractiveCycleSelector cycles={manyCycles} legacyPeriods={[]} />
  },
}

export const EmptyState: Story = {
  render: () => <InteractiveCycleSelector cycles={[]} legacyPeriods={[]} initialSelected={null} />,
}

