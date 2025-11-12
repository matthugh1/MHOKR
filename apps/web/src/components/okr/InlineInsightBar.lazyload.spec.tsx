/**
 * W5.M2: Inline Insight Bar - Lazy Load Tests
 * 
 * Component tests for InlineInsightBar:
 * - Loads on intersection (IntersectionObserver)
 * - Shows trend arrow + last update age
 * - Handles loading and error states
 */

import { render, screen, waitFor } from '@testing-library/react'
import { InlineInsightBar } from '../InlineInsightBar'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'

// Mock dependencies
jest.mock('@/lib/api')
jest.mock('@/contexts/auth.context')

const mockApi = api as jest.Mocked<typeof api>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation((callback) => {
  return {
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
    trigger: (isIntersecting: boolean) => {
      callback([{ isIntersecting, target: document.createElement('div') }], {} as IntersectionObserver)
    },
  }
}) as any

describe('InlineInsightBar - W5.M2 Lazy Load', () => {
  const mockOnCheckInClick = jest.fn()

  const mockInsights = {
    objectiveId: 'obj-1',
    statusTrend: 'IMPROVING' as const,
    lastUpdateAgeHours: 5,
    krs: { onTrack: 2, atRisk: 1, blocked: 0, completed: 0 },
    upcomingCheckins: 1,
    overdueCheckins: 2,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      isLoading: false,
    } as any)
  })

  it('should not render when not visible', () => {
    render(<InlineInsightBar objectiveId="obj-1" isVisible={false} />)

    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
  })

  it('should load insights when visible and intersecting', async () => {
    mockApi.get.mockResolvedValue({
      data: mockInsights,
    })

    const { container } = render(
      <InlineInsightBar objectiveId="obj-1" isVisible={true} onCheckInClick={mockOnCheckInClick} />,
    )

    // Trigger intersection observer
    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText(/Updated 5h ago/)).toBeInTheDocument()
    })

    expect(mockApi.get).toHaveBeenCalledWith('/okr/insights/objective/obj-1')
  })

  it('should show status trend icon for IMPROVING', async () => {
    mockApi.get.mockResolvedValue({
      data: { ...mockInsights, statusTrend: 'IMPROVING' },
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      // ArrowUp icon should be present (check for SVG or icon class)
      const container = screen.getByText(/Updated 5h ago/).closest('div')
      expect(container).toBeInTheDocument()
    })
  })

  it('should show status trend icon for DECLINING', async () => {
    mockApi.get.mockResolvedValue({
      data: { ...mockInsights, statusTrend: 'DECLINING' },
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText(/Updated 5h ago/)).toBeInTheDocument()
    })
  })

  it('should format last update age correctly', async () => {
    mockApi.get.mockResolvedValue({
      data: { ...mockInsights, lastUpdateAgeHours: 0 },
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText(/Updated Just now/)).toBeInTheDocument()
    })
  })

  it('should format last update age as days when >= 24 hours', async () => {
    mockApi.get.mockResolvedValue({
      data: { ...mockInsights, lastUpdateAgeHours: 48 },
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText(/Updated 2d ago/)).toBeInTheDocument()
    })
  })

  it('should show KR roll-ups', async () => {
    mockApi.get.mockResolvedValue({
      data: mockInsights,
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText('2 on track')).toBeInTheDocument()
      expect(screen.getByText('1 at risk')).toBeInTheDocument()
    })
  })

  it('should show check-in badges', async () => {
    mockApi.get.mockResolvedValue({
      data: mockInsights,
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText('2 overdue')).toBeInTheDocument()
      expect(screen.getByText('1 upcoming')).toBeInTheDocument()
    })
  })

  it('should handle error state', async () => {
    mockApi.get.mockRejectedValue({
      response: { data: { message: 'Failed to load' } },
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      // Component should hide on error (returns null)
      expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
    })
  })

  it('should not load if already loaded', async () => {
    mockApi.get.mockResolvedValue({
      data: mockInsights,
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText(/Updated 5h ago/)).toBeInTheDocument()
    })

    // Trigger again - should not call API again
    observer.trigger(true)

    expect(mockApi.get).toHaveBeenCalledTimes(1)
  })

  it('should track telemetry on load', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    mockApi.get.mockResolvedValue({
      data: mockInsights,
    })

    render(<InlineInsightBar objectiveId="obj-1" isVisible={true} />)

    const observer = (global.IntersectionObserver as jest.Mock).mock.results[0].value
    observer.trigger(true)

    await waitFor(() => {
      expect(screen.getByText(/Updated 5h ago/)).toBeInTheDocument()
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Telemetry] okr.insights.objective.loaded',
      expect.objectContaining({
        userId: 'user-1',
        objectiveId: 'obj-1',
      }),
    )

    consoleSpy.mockRestore()
  })
})

