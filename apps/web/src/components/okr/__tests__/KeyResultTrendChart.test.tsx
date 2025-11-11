// NOTE: phase14-hardening
// Test scaffold for Key Result Trend Chart component

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * @fileoverview Tests for Key Result Trend Chart component
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { KeyResultTrendChart } from '../KeyResultTrendChart'
import api from '@/lib/api'

// Mock API module
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}))

describe('KeyResultTrendChart', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', () => {
    ;(api.get as jest.Mock).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<KeyResultTrendChart keyResultId="kr-1" />)
    
    expect(screen.getByText(/Loading trend/i)).toBeInTheDocument()
  })

  it('renders trend data with points', async () => {
    const mockData = [
      {
        timestamp: new Date('2025-01-01').toISOString(),
        value: 25,
        confidence: 80,
      },
      {
        timestamp: new Date('2025-01-15').toISOString(),
        value: 50,
        confidence: 85,
      },
      {
        timestamp: new Date('2025-01-30').toISOString(),
        value: 75,
        confidence: 90,
      },
    ]

    ;(api.get as jest.Mock).mockResolvedValue({ data: mockData })

    render(<KeyResultTrendChart keyResultId="kr-1" />)
    
    await waitFor(() => {
      expect(screen.getByText(/Trend/i)).toBeInTheDocument()
      expect(screen.queryByText(/Loading trend/i)).not.toBeInTheDocument()
    })

    // Chart should render SVG
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('displays empty state when no data', async () => {
    ;(api.get as jest.Mock).mockResolvedValue({ data: [] })

    render(<KeyResultTrendChart keyResultId="kr-1" />)
    
    await waitFor(() => {
      expect(screen.getByText(/No check-in data available/i)).toBeInTheDocument()
    })
  })

  it('handles 403 error gracefully', async () => {
    ;(api.get as jest.Mock).mockRejectedValue({
      response: { status: 403, data: { message: 'Forbidden' } },
    })

    render(<KeyResultTrendChart keyResultId="kr-1" />)
    
    await waitFor(() => {
      expect(screen.getByText(/No permission to view trend/i)).toBeInTheDocument()
    })
  })

  it('handles 404 error gracefully', async () => {
    ;(api.get as jest.Mock).mockRejectedValue({
      response: { status: 404, data: { message: 'Not found' } },
    })

    render(<KeyResultTrendChart keyResultId="kr-1" />)
    
    await waitFor(() => {
      expect(screen.getByText(/Key result not found/i)).toBeInTheDocument()
    })
  })

  it('handles network errors gracefully', async () => {
    ;(api.get as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<KeyResultTrendChart keyResultId="kr-1" />)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load trend data/i)).toBeInTheDocument()
    })
  })

  it('toggles confidence line visibility', async () => {
    const mockData = [
      {
        timestamp: new Date('2025-01-01').toISOString(),
        value: 25,
        confidence: 80,
      },
    ]

    ;(api.get as jest.Mock).mockResolvedValue({ data: mockData })

    render(<KeyResultTrendChart keyResultId="kr-1" />)
    
    await waitFor(() => {
      const checkbox = screen.getByLabelText(/Show confidence/i)
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })
  })
})


