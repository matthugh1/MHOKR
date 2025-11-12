/**
 * W5.M3: Chip Component Tests
 * 
 * Component tests for accessible chip components:
 * - Renders correct labels + aria-labels
 * - Colour classes applied (contrast ≥ 4.5:1)
 * - Keyboard operation (Enter/Space)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { StatusChip, PublishStateChip, VisibilityChip } from '../ui/OkrChips'

describe('OkrChips - W5.M3', () => {
  describe('StatusChip', () => {
    it('should render with correct aria-label', () => {
      render(<StatusChip status="ON_TRACK" />)
      const chip = screen.getByRole('status')
      expect(chip).toHaveAttribute('aria-label', 'Status: On track')
    })

    it('should apply correct colour classes', () => {
      const { container } = render(<StatusChip status="ON_TRACK" />)
      const chip = container.querySelector('.bg-emerald-100')
      expect(chip).toBeInTheDocument()
    })

    it('should handle keyboard activation when interactive', () => {
      const onClick = jest.fn()
      render(<StatusChip status="AT_RISK" interactive={true} onClick={onClick} />)
      
      const chip = screen.getByRole('button')
      fireEvent.keyDown(chip, { key: 'Enter' })
      
      expect(onClick).toHaveBeenCalled()
    })

    it('should handle Space key activation', () => {
      const onClick = jest.fn()
      render(<StatusChip status="BLOCKED" interactive={true} onClick={onClick} />)
      
      const chip = screen.getByRole('button')
      fireEvent.keyDown(chip, { key: ' ' })
      
      expect(onClick).toHaveBeenCalled()
    })
  })

  describe('PublishStateChip', () => {
    it('should render PUBLISHED with correct aria-label', () => {
      render(<PublishStateChip publishState="PUBLISHED" />)
      const chip = screen.getByRole('status')
      expect(chip).toHaveAttribute('aria-label', 'Publish state: Published')
    })

    it('should render DRAFT with correct aria-label', () => {
      render(<PublishStateChip publishState="DRAFT" />)
      const chip = screen.getByRole('status')
      expect(chip).toHaveAttribute('aria-label', 'Publish state: Draft')
    })
  })

  describe('VisibilityChip', () => {
    it('should render PUBLIC_TENANT with correct aria-label', () => {
      render(<VisibilityChip visibilityLevel="PUBLIC_TENANT" />)
      const chip = screen.getByRole('status')
      expect(chip).toHaveAttribute('aria-label', 'Visibility: Public (Tenant)')
    })

    it('should render PRIVATE with correct aria-label', () => {
      render(<VisibilityChip visibilityLevel="PRIVATE" />)
      const chip = screen.getByRole('status')
      expect(chip).toHaveAttribute('aria-label', 'Visibility: Private')
    })
  })
})

