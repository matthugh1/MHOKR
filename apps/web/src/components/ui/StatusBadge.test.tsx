/**
 * @fileoverview Unit tests for StatusBadge component
 * 
 * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders without crashing', () => {
    render(<StatusBadge status="ON_TRACK" />)
    expect(screen.getByText('On Track')).toBeInTheDocument()
  })

  it('displays ON_TRACK status correctly', () => {
    render(<StatusBadge status="ON_TRACK" />)
    expect(screen.getByText('On Track')).toBeInTheDocument()
  })

  it('displays AT_RISK status correctly', () => {
    render(<StatusBadge status="AT_RISK" />)
    expect(screen.getByText('At Risk')).toBeInTheDocument()
  })

  it('displays OFF_TRACK status correctly', () => {
    render(<StatusBadge status="OFF_TRACK" />)
    expect(screen.getByText('Off Track')).toBeInTheDocument()
  })

  it('displays COMPLETED status correctly', () => {
    render(<StatusBadge status="COMPLETED" />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('displays CANCELLED status correctly', () => {
    render(<StatusBadge status="CANCELLED" />)
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('applies status-specific styling for ON_TRACK', () => {
    const { container } = render(<StatusBadge status="ON_TRACK" />)
    const badge = container.querySelector('.bg-green-500\\/20')
    expect(badge).toBeInTheDocument()
  })

  it('applies status-specific styling for AT_RISK', () => {
    const { container } = render(<StatusBadge status="AT_RISK" />)
    const badge = container.querySelector('.bg-yellow-500\\/20')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('animate-pulse')
  })

  it('applies expected base classes', () => {
    const { container } = render(<StatusBadge status="ON_TRACK" />)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('text-xs', 'rounded-full', 'border')
  })

  it('applies custom className when provided', () => {
    const { container } = render(<StatusBadge status="ON_TRACK" className="custom-class" />)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('custom-class')
  })
})

