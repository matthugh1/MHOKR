// NOTE [phase14-hardening]:
// Test scaffold created in Phase 11. We have not yet wired Jest/RTL.
// @ts-nocheck is intentional to unblock main without removing test intent.

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * @fileoverview Unit tests for ActivityItemCard component
 * 
 * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ActivityItemCard } from './ActivityItemCard'

describe('ActivityItemCard', () => {
  const mockProps = {
    actorName: 'John Doe',
    timestamp: '2024-01-15T10:30:00Z',
    action: 'UPDATED',
    summary: 'Progress 45% → 60%',
  }

  it('renders without crashing', () => {
    render(<ActivityItemCard {...mockProps} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('displays actor name correctly', () => {
    render(<ActivityItemCard {...mockProps} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('displays action correctly', () => {
    render(<ActivityItemCard {...mockProps} />)
    expect(screen.getByText('UPDATED')).toBeInTheDocument()
  })

  it('displays summary correctly', () => {
    render(<ActivityItemCard {...mockProps} />)
    expect(screen.getByText('Progress 45% → 60%')).toBeInTheDocument()
  })

  it('formats timestamp as time ago', () => {
    const recentTimestamp = new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    render(<ActivityItemCard {...mockProps} timestamp={recentTimestamp} />)
    // Should display "1h ago" or similar
    expect(screen.getByText(/ago/i)).toBeInTheDocument()
  })

  it('applies expected Tailwind classes', () => {
    const { container } = render(<ActivityItemCard {...mockProps} />)
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('rounded-lg', 'border', 'border-neutral-200', 'bg-white', 'p-3', 'shadow-sm')
  })

  it('has proper text hierarchy', () => {
    const { container } = render(<ActivityItemCard {...mockProps} />)
    const actorName = container.querySelector('.text-sm.font-medium.text-neutral-900')
    const timestamp = container.querySelector('.text-xs.text-neutral-500')
    const action = container.querySelector('.text-sm.text-neutral-700')
    const summary = container.querySelector('.text-xs.text-neutral-600')
    
    expect(actorName).toBeInTheDocument()
    expect(timestamp).toBeInTheDocument()
    expect(action).toBeInTheDocument()
    expect(summary).toBeInTheDocument()
  })
})

