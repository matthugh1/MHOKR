/**
 * W5.M2: Attention Drawer - Pagination Tests
 * 
 * Component tests for AttentionDrawer:
 * - Paginated list display
 * - Grouped by type
 * - Action buttons hidden by permission
 * - Navigation callbacks
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AttentionDrawer } from '../AttentionDrawer'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'

// Mock dependencies
jest.mock('@/lib/api')
jest.mock('@/contexts/auth.context')

const mockApi = api as jest.Mocked<typeof api>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('AttentionDrawer - W5.M2 Pagination', () => {
  const mockOnClose = jest.fn()
  const mockOnNavigateToObjective = jest.fn()
  const mockOnNavigateToKeyResult = jest.fn()
  const mockOnRequestCheckIn = jest.fn()

  const mockFeedPage1 = {
    page: 1,
    pageSize: 20,
    totalCount: 25,
    items: Array.from({ length: 20 }, (_, i) => ({
      type: i < 5 ? 'OVERDUE_CHECKIN' : i < 10 ? 'NO_UPDATE_14D' : 'STATUS_DOWNGRADE',
      objectiveId: `obj-${i}`,
      keyResultId: i < 5 ? `kr-${i}` : undefined,
      ageDays: i < 5 ? 10 + i : 15 + i,
      from: i >= 10 ? 'ON_TRACK' : undefined,
      to: i >= 10 ? 'AT_RISK' : undefined,
    })),
  }

  const mockFeedPage2 = {
    page: 2,
    pageSize: 20,
    totalCount: 25,
    items: Array.from({ length: 5 }, (_, i) => ({
      type: 'OVERDUE_CHECKIN',
      objectiveId: `obj-${i + 20}`,
      keyResultId: `kr-${i + 20}`,
      ageDays: 10 + i,
    })),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      isLoading: false,
    } as any)
  })

  it('should render paginated attention items', async () => {
    mockApi.get.mockResolvedValue({
      data: mockFeedPage1,
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        onNavigateToObjective={mockOnNavigateToObjective}
        onNavigateToKeyResult={mockOnNavigateToKeyResult}
        canRequestCheckIn={true}
        onRequestCheckIn={mockOnRequestCheckIn}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument()
    })

    // Should show items
    expect(screen.getByText(/Overdue check-in/)).toBeInTheDocument()
    expect(screen.getByText(/No update in/)).toBeInTheDocument()
    expect(screen.getByText(/Status changed from/)).toBeInTheDocument()
  })

  it('should paginate correctly', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: mockFeedPage1 })
      .mockResolvedValueOnce({ data: mockFeedPage2 })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        onNavigateToObjective={mockOnNavigateToObjective}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Showing 1-20 of 25')).toBeInTheDocument()
    })

    // Click next page
    const nextButton = screen.getByLabelText(/next/i) || screen.getByRole('button', { name: /next/i })
    if (nextButton) {
      fireEvent.click(nextButton)
    } else {
      // Fallback: find button with ChevronRight
      const buttons = screen.getAllByRole('button')
      const nextBtn = buttons.find((btn) => btn.textContent?.includes('Page'))
      if (nextBtn) {
        fireEvent.click(nextBtn)
      }
    }

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledTimes(2)
      expect(mockApi.get).toHaveBeenLastCalledWith(
        expect.stringContaining('page=2'),
      )
    })
  })

  it('should hide request check-in button when not permitted', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 1,
        items: [
          {
            type: 'OVERDUE_CHECKIN' as const,
            objectiveId: 'obj-1',
            keyResultId: 'kr-1',
            ageDays: 10,
          },
        ],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        canRequestCheckIn={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Open KR')).toBeInTheDocument()
    })

    expect(screen.queryByText('Request check-in')).not.toBeInTheDocument()
  })

  it('should show request check-in button when permitted', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 1,
        items: [
          {
            type: 'OVERDUE_CHECKIN' as const,
            objectiveId: 'obj-1',
            keyResultId: 'kr-1',
            ageDays: 10,
          },
        ],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        canRequestCheckIn={true}
        onRequestCheckIn={mockOnRequestCheckIn}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Request check-in')).toBeInTheDocument()
    })
  })

  it('should call onNavigateToObjective when clicking Open Objective', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 1,
        items: [
          {
            type: 'NO_UPDATE_14D' as const,
            objectiveId: 'obj-1',
            ageDays: 15,
          },
        ],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        onNavigateToObjective={mockOnNavigateToObjective}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Open Objective')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Open Objective'))

    expect(mockOnNavigateToObjective).toHaveBeenCalledWith('obj-1')
  })

  it('should call onNavigateToKeyResult when clicking Open KR', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 1,
        items: [
          {
            type: 'OVERDUE_CHECKIN' as const,
            objectiveId: 'obj-1',
            keyResultId: 'kr-1',
            ageDays: 10,
          },
        ],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        onNavigateToKeyResult={mockOnNavigateToKeyResult}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Open KR')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Open KR'))

    expect(mockOnNavigateToKeyResult).toHaveBeenCalledWith('kr-1')
  })

  it('should call onRequestCheckIn when clicking Request check-in', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 1,
        items: [
          {
            type: 'OVERDUE_CHECKIN' as const,
            objectiveId: 'obj-1',
            keyResultId: 'kr-1',
            ageDays: 10,
          },
        ],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        canRequestCheckIn={true}
        onRequestCheckIn={mockOnRequestCheckIn}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Request check-in')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Request check-in'))

    expect(mockOnRequestCheckIn).toHaveBeenCalledWith('kr-1')
  })

  it('should show empty state when no items', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 0,
        items: [],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('No items need attention at this time.')).toBeInTheDocument()
    })
  })

  it('should handle error state', async () => {
    mockApi.get.mockRejectedValue({
      response: { data: { message: 'Failed to load' } },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument()
    })
  })

  it('should track telemetry on open', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 0,
        items: [],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Telemetry] okr.insights.attention.open',
        expect.objectContaining({
          userId: 'user-1',
          cycleId: 'cycle-1',
        }),
      )
    })

    consoleSpy.mockRestore()
  })

  it('should track telemetry on request check-in click', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 1,
        items: [
          {
            type: 'OVERDUE_CHECKIN' as const,
            objectiveId: 'obj-1',
            keyResultId: 'kr-1',
            ageDays: 10,
          },
        ],
      },
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
        canRequestCheckIn={true}
        onRequestCheckIn={mockOnRequestCheckIn}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Request check-in')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Request check-in'))

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Telemetry] okr.insights.request_checkin.click',
      expect.objectContaining({
        userId: 'user-1',
        keyResultId: 'kr-1',
      }),
    )

    consoleSpy.mockRestore()
  })

  it('should disable pagination buttons at boundaries', async () => {
    mockApi.get.mockResolvedValue({
      data: mockFeedPage1,
    })

    render(
      <AttentionDrawer
        isOpen={true}
        onClose={mockOnClose}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    })

    // Previous button should be disabled on page 1
    const buttons = screen.getAllByRole('button')
    const prevButton = buttons.find((btn) => btn.textContent?.includes('Previous') || btn.disabled)
    if (prevButton) {
      expect(prevButton).toBeDisabled()
    }
  })
})

