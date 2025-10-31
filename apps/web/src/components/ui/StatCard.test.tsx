// NOTE [phase14-hardening]:
// Test scaffold created in Phase 11. We have not yet wired Jest/RTL.
// @ts-nocheck is intentional to unblock main without removing test intent.

// @ts-nocheck
/**
 * @fileoverview Unit tests for StatCard component
 * 
 * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders without crashing', () => {
    render(<StatCard title="Test" value={42} />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('displays title correctly', () => {
    render(<StatCard title="Total Objectives" value={42} />)
    expect(screen.getByText('Total Objectives')).toBeInTheDocument()
  })

  it('displays value correctly', () => {
    render(<StatCard title="Test" value={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('displays subtitle when provided', () => {
    render(<StatCard title="Test" value={42} subtitle="12 on track" />)
    expect(screen.getByText('12 on track')).toBeInTheDocument()
  })

  it('does not display subtitle when not provided', () => {
    render(<StatCard title="Test" value={42} />)
    expect(screen.queryByText(/on track/)).not.toBeInTheDocument()
  })

  it('renders ReactNode values', () => {
    render(<StatCard title="Test" value={<span data-testid="custom-value">Custom</span>} />)
    expect(screen.getByTestId('custom-value')).toBeInTheDocument()
  })

  it('applies expected Tailwind classes', () => {
    const { container } = render(<StatCard title="Test" value={42} />)
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('rounded-xl', 'border', 'border-neutral-200', 'bg-white', 'p-4', 'shadow-sm')
  })

  it('has proper text hierarchy', () => {
    const { container } = render(<StatCard title="Test" value={42} subtitle="Subtitle" />)
    const title = container.querySelector('.text-xs.text-neutral-500')
    const value = container.querySelector('.text-2xl.font-semibold.text-neutral-900')
    const subtitle = container.querySelector('.text-\\[11px\\].text-neutral-500')
    
    expect(title).toBeInTheDocument()
    expect(value).toBeInTheDocument()
    expect(subtitle).toBeInTheDocument()
  })
})

