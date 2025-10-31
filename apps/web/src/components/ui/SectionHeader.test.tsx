// NOTE [phase14-hardening]:
// Test scaffold created in Phase 11. We have not yet wired Jest/RTL.
// @ts-nocheck is intentional to unblock main without removing test intent.

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * @fileoverview Unit tests for SectionHeader component
 * 
 * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SectionHeader } from './SectionHeader'

describe('SectionHeader', () => {
  it('renders without crashing', () => {
    render(<SectionHeader title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('displays title correctly', () => {
    render(<SectionHeader title="Recent Activity" />)
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
  })

  it('displays subtitle when provided', () => {
    render(<SectionHeader title="Test" subtitle="Last 10 check-ins" />)
    expect(screen.getByText('Last 10 check-ins')).toBeInTheDocument()
  })

  it('does not display subtitle when not provided', () => {
    render(<SectionHeader title="Test" />)
    expect(screen.queryByText(/check-ins/)).not.toBeInTheDocument()
  })

  it('applies expected Tailwind classes', () => {
    const { container } = render(<SectionHeader title="Test" />)
    const header = container.firstChild as HTMLElement
    expect(header).toHaveClass('flex', 'items-center', 'justify-between', 'mb-2')
  })

  it('has proper text hierarchy', () => {
    const { container } = render(<SectionHeader title="Test" subtitle="Subtitle" />)
    const title = container.querySelector('.text-sm.font-medium.text-neutral-900')
    const subtitle = container.querySelector('.text-\\[11px\\].text-neutral-500')
    
    expect(title).toBeInTheDocument()
    expect(subtitle).toBeInTheDocument()
  })

  it('applies custom className when provided', () => {
    const { container } = render(<SectionHeader title="Test" className="custom-class" />)
    const header = container.firstChild as HTMLElement
    expect(header).toHaveClass('custom-class')
  })
})

