/**
 * @fileoverview Unit tests for ObjectiveCard component
 * 
 * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ObjectiveCard } from './ObjectiveCard'

const mockProps = {
  title: 'Increase Customer Satisfaction',
  ownerName: 'John Doe',
  status: 'ON_TRACK' as const,
  progressPct: 75,
  isPublished: false,
  canEdit: true,
  canDelete: true,
}

describe('ObjectiveCard', () => {
  it('renders without crashing', () => {
    render(<ObjectiveCard {...mockProps} />)
    expect(screen.getByText('Increase Customer Satisfaction')).toBeInTheDocument()
  })

  it('displays title correctly', () => {
    render(<ObjectiveCard {...mockProps} />)
    expect(screen.getByText('Increase Customer Satisfaction')).toBeInTheDocument()
  })

  it('displays owner name correctly', () => {
    render(<ObjectiveCard {...mockProps} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('displays progress percentage correctly', () => {
    render(<ObjectiveCard {...mockProps} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders StatusBadge with correct status', () => {
    render(<ObjectiveCard {...mockProps} />)
    expect(screen.getByText('On Track')).toBeInTheDocument()
  })

  it('shows published badge when isPublished is true', () => {
    render(<ObjectiveCard {...mockProps} isPublished={true} />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('does not show published badge when isPublished is false', () => {
    render(<ObjectiveCard {...mockProps} isPublished={false} />)
    expect(screen.queryByText('Published')).not.toBeInTheDocument()
  })

  it('applies expected Tailwind classes', () => {
    const { container } = render(<ObjectiveCard {...mockProps} />)
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('rounded-xl', 'border', 'border-neutral-200', 'bg-white', 'p-4', 'shadow-sm')
  })

  it('has proper heading structure', () => {
    const { container } = render(<ObjectiveCard {...mockProps} />)
    const heading = container.querySelector('h3')
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent('Increase Customer Satisfaction')
  })

  it('disables edit button when canEdit is false', () => {
    render(<ObjectiveCard {...mockProps} canEdit={false} />)
    const editButton = screen.getByRole('button', { name: /edit/i })
    expect(editButton).toBeDisabled()
  })

  it('disables delete button when canDelete is false', () => {
    render(<ObjectiveCard {...mockProps} canDelete={false} />)
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    expect(deleteButton).toBeDisabled()
  })
})

