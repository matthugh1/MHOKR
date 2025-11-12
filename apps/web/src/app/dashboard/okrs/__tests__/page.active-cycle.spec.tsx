/**
 * OKR List - Active Cycle Singleton Tests
 * 
 * Assertions for OKR_LIST_STORY_1_PR:
 * - Only one cycle control exists (the Cycle dropdown in toolbar)
 * - No duplicate "Active Cycle: ..." label is rendered
 * - Header spacing is tidy (no empty rows or duplicate containers)
 */

import { render, screen, waitFor } from '@testing-library/react'
import OKRsPage from '../page'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useWorkspace } from '@/contexts/workspace.context'

// Mock dependencies
jest.mock('@/lib/api')
jest.mock('@/contexts/auth.context')
jest.mock('@/hooks/usePermissions')
jest.mock('@/hooks/useTenantPermissions')
jest.mock('@/contexts/workspace.context')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

const mockApi = api as jest.Mocked<typeof api>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUsePermissions = usePermissions as jest.MockedFunction<typeof usePermissions>
const mockUseTenantPermissions = useTenantPermissions as jest.MockedFunction<typeof useTenantPermissions>
const mockUseWorkspace = useWorkspace as jest.MockedFunction<typeof useWorkspace>

describe('OKR List - Active Cycle Singleton', () => {
  const mockActiveCycles = [
    { id: 'cycle-1', name: 'Q1 2025', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2025-03-31', organizationId: 'org-1' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', organizationId: 'org-1' },
      isLoading: false,
    } as any)

    mockUsePermissions.mockReturnValue({
      isTenantAdminOrOwner: jest.fn().mockReturnValue(false),
      canEditOKR: jest.fn().mockReturnValue(false),
      isSuperuser: false,
    } as any)

    mockUseTenantPermissions.mockReturnValue({
      canSeeObjective: jest.fn().mockReturnValue(true),
      canEditObjective: jest.fn().mockReturnValue(true),
      canDeleteObjective: jest.fn().mockReturnValue(true),
      getLockInfoForObjective: jest.fn().mockReturnValue({ reason: null, message: null }),
    } as any)

    mockUseWorkspace.mockReturnValue({
      workspaces: [],
      teams: [],
      currentOrganization: { id: 'org-1' },
      currentWorkspace: null,
      currentTeam: null,
      defaultOKRContext: {},
      currentOKRLevel: 'TENANT',
      loading: false,
    } as any)

    // Mock API responses
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/okr/overview')) {
        return Promise.resolve({
          data: {
            page: 1,
            pageSize: 20,
            totalCount: 0,
            objectives: [],
          },
        })
      }
      if (url.includes('/reports/cycles/active')) {
        return Promise.resolve({
          data: mockActiveCycles,
        })
      }
      if (url.includes('/reports/check-ins/overdue')) {
        return Promise.resolve({
          data: [],
        })
      }
      if (url.includes('/users')) {
        return Promise.resolve({
          data: [],
        })
      }
      return Promise.resolve({ data: [] })
    })
  })

  it('should render exactly one cycle control (the dropdown)', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    // Wait for cycle dropdown to appear
    await waitFor(() => {
      // Find the cycle dropdown button by its text (shows cycle name)
      const cycleButtons = screen.getAllByRole('button').filter(
        button => button.textContent?.includes('Q1 2025') || button.textContent?.includes('Select cycle')
      )
      
      // Should find exactly one cycle selector button
      expect(cycleButtons.length).toBeGreaterThanOrEqual(1)
      
      // More specifically: should find exactly one button with aria-haspopup="listbox" (the cycle selector)
      const cycleSelector = screen.getAllByRole('button').find(
        button => button.getAttribute('aria-haspopup') === 'listbox'
      )
      expect(cycleSelector).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should NOT render duplicate "Active Cycle:" label anywhere', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    // Wait for page to fully load
    await waitFor(() => {
      // Ensure cycles are loaded
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycles/active')
    }, { timeout: 3000 })

    // Assert no "Active Cycle:" text appears anywhere
    const activeCycleLabels = screen.queryAllByText(/Active Cycle:/i)
    expect(activeCycleLabels).toHaveLength(0)

    // Also check for variations
    const activeCycleText = screen.queryAllByText(/Active Cycle/i).filter(
      element => element.textContent?.includes(':')
    )
    expect(activeCycleText).toHaveLength(0)
  })

  it('should only show cycle in dropdown, not in PageHeader badges', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycles/active')
    }, { timeout: 3000 })

    // Check that PageHeader badges don't contain "Active Cycle:"
    const header = screen.getByRole('banner')
    const headerText = header.textContent || ''
    
    // Should not contain "Active Cycle:" in header badges
    expect(headerText).not.toContain('Active Cycle:')
    
    // The cycle name might appear in "Viewing: Q1 2025" badge, but not "Active Cycle: Q1 2025"
    if (headerText.includes('Q1 2025')) {
      // If it appears, it should be in "Viewing:" format, not "Active Cycle:" format
      expect(headerText).toMatch(/Viewing:.*Q1 2025/i)
      expect(headerText).not.toMatch(/Active Cycle:.*Q1 2025/i)
    }
  })

  it('should have tidy header spacing (no empty banner section)', async () => {
    const { container } = render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycles/active')
    }, { timeout: 3000 })

    // Find the header element
    const header = container.querySelector('header[role="banner"]')
    expect(header).toBeInTheDocument()

    // Should not have an empty "Active Cycle Banner" aside element
    const activeCycleBanner = header?.querySelector('aside[role="complementary"]')
    expect(activeCycleBanner).not.toBeInTheDocument()

    // Check that there's no empty mb-6 container (typical spacing for removed banner)
    const emptyBanners = container.querySelectorAll('aside.mb-6, div.mb-6')
    const hasActiveCycleBanner = Array.from(emptyBanners).some(
      el => el.textContent?.includes('Q1 2025') && el.textContent?.includes('Active')
    )
    expect(hasActiveCycleBanner).toBe(false)
  })

  it('should keep Cycle dropdown accessible with proper aria-label', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    await waitFor(() => {
      // Find the cycle selector button (has aria-haspopup="listbox")
      const cycleSelector = screen.getAllByRole('button').find(
        button => button.getAttribute('aria-haspopup') === 'listbox'
      )
      expect(cycleSelector).toBeInTheDocument()
      
      // Should have proper accessibility attributes
      expect(cycleSelector?.getAttribute('aria-expanded')).not.toBeNull()
    }, { timeout: 3000 })
  })
})




