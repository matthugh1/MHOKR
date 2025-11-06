/**
 * OKR List - No Visual Builder References Tests
 * 
 * Assertions for OKR_LIST_STORY_2_PR:
 * - No text references to "Visual Builder" or "Builder"
 * - No links to /dashboard/builder or any builder route
 * - No builder-related UI elements (buttons, icons, tooltips)
 * - Layout remains tidy without builder CTAs
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

describe('OKR List - No Visual Builder References', () => {
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

  it('should NOT render any text containing "Visual Builder" or "Builder"', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycles/active')
    }, { timeout: 3000 })

    // Check for any "Builder" or "Visual Builder" text (case insensitive)
    const builderText = screen.queryAllByText(/builder/i)
    const visualBuilderText = screen.queryAllByText(/visual builder/i)
    
    expect(builderText).toHaveLength(0)
    expect(visualBuilderText).toHaveLength(0)
  })

  it('should NOT render any links to /dashboard/builder or builder routes', async () => {
    const { container } = render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycles/active')
    }, { timeout: 3000 })

    // Find all links in the page
    const allLinks = container.querySelectorAll('a[href]')
    
    // Assert no link has a href containing "builder"
    Array.from(allLinks).forEach(link => {
      const href = link.getAttribute('href') || ''
      expect(href.toLowerCase()).not.toContain('builder')
      expect(href).not.toMatch(/\/dashboard\/builder/i)
      expect(href).not.toMatch(/\/visual-builder/i)
      expect(href).not.toMatch(/\/builder/i)
    })
  })

  it('should NOT render builder-related buttons or CTAs in the header/toolbar', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycles/active')
    }, { timeout: 3000 })

    // Get all buttons
    const allButtons = screen.getAllByRole('button')
    
    // Check that no button has text or aria-label containing "builder"
    allButtons.forEach(button => {
      const buttonText = button.textContent || ''
      const ariaLabel = button.getAttribute('aria-label') || ''
      
      expect(buttonText.toLowerCase()).not.toContain('builder')
      expect(ariaLabel.toLowerCase()).not.toContain('builder')
    })
  })

  it('should have tidy header/toolbar without builder CTA', async () => {
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

    // Get header text content
    const headerText = header?.textContent || ''
    
    // Should not contain builder references
    expect(headerText.toLowerCase()).not.toContain('builder')
    expect(headerText.toLowerCase()).not.toContain('visual builder')
    
    // Should not have empty regions or orphaned elements
    const emptyRegions = container.querySelectorAll('[role="region"]:empty')
    expect(emptyRegions.length).toBe(0)
  })

  it('should not have orphaned aria-labels referencing builder', async () => {
    const { container } = render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/reports/cycles/active')
    }, { timeout: 3000 })

    // Find all elements with aria-label
    const elementsWithAriaLabel = container.querySelectorAll('[aria-label]')
    
    // Check that no aria-label contains "builder"
    Array.from(elementsWithAriaLabel).forEach(element => {
      const ariaLabel = element.getAttribute('aria-label') || ''
      expect(ariaLabel.toLowerCase()).not.toContain('builder')
    })
  })
})


