/**
 * W5.M3: Focus Trap Tests
 * 
 * Component tests for focus trap functionality:
 * - Focus trap activates on drawer open
 * - Esc closes drawer
 * - Return focus to opener button
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AttentionDrawer } from '../AttentionDrawer'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'

jest.mock('@/lib/api')
jest.mock('@/contexts/auth.context')

const mockApi = api as jest.Mocked<typeof api>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('Focus Trap - W5.M3', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      isLoading: false,
    } as any)
  })

  it('should trap focus within drawer when open', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 0,
        items: [],
      },
    })

    const openerButton = document.createElement('button')
    openerButton.setAttribute('data-focus-restorer', '')
    document.body.appendChild(openerButton)
    openerButton.focus()

    const { container } = render(
      <AttentionDrawer
        isOpen={true}
        onClose={jest.fn()}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      const drawerContent = container.querySelector('[role="dialog"]') || container.querySelector('[aria-labelledby]')
      expect(drawerContent).toBeInTheDocument()
    })

    // Focus should be within drawer, not on opener
    const activeElement = document.activeElement
    expect(activeElement).not.toBe(openerButton)
    expect(container.contains(activeElement)).toBe(true)
  })

  it('should close drawer on Esc key', async () => {
    const onClose = jest.fn()
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
        onClose={onClose}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument()
    })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('should return focus to opener button on close', async () => {
    const openerButton = document.createElement('button')
    openerButton.setAttribute('data-focus-restorer', '')
    document.body.appendChild(openerButton)

    mockApi.get.mockResolvedValue({
      data: {
        page: 1,
        pageSize: 20,
        totalCount: 0,
        items: [],
      },
    })

    const { rerender } = render(
      <AttentionDrawer
        isOpen={true}
        onClose={jest.fn()}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument()
    })

    // Close drawer
    rerender(
      <AttentionDrawer
        isOpen={false}
        onClose={jest.fn()}
        cycleId="cycle-1"
      />,
    )

    await waitFor(() => {
      // Focus should return to opener (simplified check)
      expect(document.activeElement).toBe(openerButton)
    })
  })
})

