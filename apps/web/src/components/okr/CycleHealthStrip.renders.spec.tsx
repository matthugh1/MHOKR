/**
 * W5.M2: Cycle Health Strip - Component Tests
 * 
 * Component tests for CycleHealthStrip:
 * - Renders correct numbers from mocked API
 * - Handles loading and error states
 * - Calls onFilterClick on chip click
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CycleHealthStrip } from '../CycleHealthStrip'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'

// Mock dependencies
jest.mock('@/lib/api')
jest.mock('@/contexts/auth.context')

const mockApi = api as jest.Mocked<typeof api>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('CycleHealthStrip - W5.M2', () => {
  const mockOnFilterClick = jest.fn()

  const mockSummary = {
    cycleId: 'cycle-1',
    objectives: { total: 10, published: 7, draft: 3 },
    krs: { total: 25, onTrack: 15, atRisk: 5, blocked: 3, completed: 2 },
    checkins: { upcoming7d: 8, overdue: 3, recent24h: 5 },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      isLoading: false,
    } as any)
  })

  it('should render cycle health summary with correct numbers', async () => {
    mockApi.get.mockResolvedValue({
      data: mockSummary,
    })

    render(<CycleHealthStrip cycleId="cycle-1" onFilterClick={mockOnFilterClick} />)

    await waitFor(() => {
      expect(screen.getByText('Cycle health:')).toBeInTheDocument()
    })

    expect(screen.getByText('10')).toBeInTheDocument() // Objectives total
    expect(screen.getByText('25')).toBeInTheDocument() // KRs total
    expect(screen.getByText('11')).toBeInTheDocument() // Check-ins total (8 + 3)
  })

  it('should show loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<CycleHealthStrip cycleId="cycle-1" />)

    expect(screen.getByText('Loading cycle health...')).toBeInTheDocument()
  })

  it('should handle error state', async () => {
    mockApi.get.mockRejectedValue({
      response: { data: { message: 'Failed to load' } },
    })

    render(<CycleHealthStrip cycleId="cycle-1" />)

    await waitFor(() => {
      // Component should hide on error
      expect(screen.queryByText('Cycle health:')).not.toBeInTheDocument()
    })
  })

  it('should call onFilterClick when chip clicked', async () => {
    mockApi.get.mockResolvedValue({
      data: mockSummary,
    })

    render(<CycleHealthStrip cycleId="cycle-1" onFilterClick={mockOnFilterClick} />)

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    // Click objectives chip
    const objectivesChip = screen.getByText('10').closest('div')?.parentElement
    if (objectivesChip) {
      fireEvent.click(objectivesChip)
      expect(mockOnFilterClick).toHaveBeenCalledWith('objectives', undefined)
    }
  })

  it('should not render when cycleId is null', () => {
    render(<CycleHealthStrip cycleId={null} />)

    expect(screen.queryByText('Cycle health:')).not.toBeInTheDocument()
  })

  it('should display published and draft badges when present', async () => {
    mockApi.get.mockResolvedValue({
      data: mockSummary,
    })

    render(<CycleHealthStrip cycleId="cycle-1" />)

    await waitFor(() => {
      expect(screen.getByText('7 published')).toBeInTheDocument()
      expect(screen.getByText('3 draft')).toBeInTheDocument()
    })
  })

  it('should display KR status badges when present', async () => {
    mockApi.get.mockResolvedValue({
      data: mockSummary,
    })

    render(<CycleHealthStrip cycleId="cycle-1" />)

    await waitFor(() => {
      expect(screen.getByText('15 on track')).toBeInTheDocument()
      expect(screen.getByText('5 at risk')).toBeInTheDocument()
      expect(screen.getByText('3 blocked')).toBeInTheDocument()
    })
  })

  it('should display check-in badges when present', async () => {
    mockApi.get.mockResolvedValue({
      data: mockSummary,
    })

    render(<CycleHealthStrip cycleId="cycle-1" />)

    await waitFor(() => {
      expect(screen.getByText('3 overdue')).toBeInTheDocument()
      expect(screen.getByText('8 upcoming')).toBeInTheDocument()
    })
  })

  it('should track telemetry on load', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    mockApi.get.mockResolvedValue({
      data: mockSummary,
    })

    render(<CycleHealthStrip cycleId="cycle-1" />)

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Telemetry] okr.insights.cycle.open',
      expect.objectContaining({
        userId: 'user-1',
        cycleId: 'cycle-1',
      }),
    )

    consoleSpy.mockRestore()
  })
})

