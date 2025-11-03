/**
 * OKR List - Add Split-Button RBAC Tests
 * 
 * Assertions for OKR_LIST_STORY_4_PR:
 * - Add split-button renders with correct RBAC gating
 * - Menu items show/hide based on permissions
 * - Each mode opens correct drawer title
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('OKR List - Add Split-Button RBAC', () => {
  const mockActiveCycles = [
    { id: 'cycle-1', name: 'Q1 2025', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2025-03-31', organizationId: 'org-1' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', organizationId: 'org-1' },
      isLoading: false,
    } as any)

    mockUseTenantPermissions.mockReturnValue({
      canSeeObjective: jest.fn().mockReturnValue(true),
      canEditObjective: jest.fn().mockReturnValue(true),
      canDeleteObjective: jest.fn().mockReturnValue(true),
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

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/okr/overview')) {
        return Promise.resolve({
          data: {
            page: 1,
            pageSize: 20,
            totalCount: 0,
            objectives: [],
            canCreateObjective: true,
          },
        })
      }
      if (url.includes('/reports/cycles/active')) {
        return Promise.resolve({ data: mockActiveCycles })
      }
      if (url.includes('/reports/check-ins/overdue')) {
        return Promise.resolve({ data: [] })
      }
      if (url.includes('/okr/insights/cycle-summary')) {
        return Promise.resolve({
          data: {
            cycleId: mockActiveCycles[0].id,
            objectives: { total: 0, published: 0, draft: 0 },
            krs: { total: 0, onTrack: 0, atRisk: 0, blocked: 0, completed: 0 },
            checkins: { upcoming7d: 0, overdue: 0, recent24h: 0 },
          },
        })
      }
      return Promise.resolve({ data: [] })
    })
  })

  it('should render Add split-button when user has create permissions', async () => {
    mockUsePermissions.mockReturnValue({
      isTenantAdminOrOwner: jest.fn().mockReturnValue(true),
      canEditOKR: jest.fn().mockReturnValue(true),
      isSuperuser: false,
    } as any)

    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    const addButton = screen.getByLabelText('Add')
    expect(addButton).toBeInTheDocument()
  })

  it('should show all three menu items for tenant owner/admin', async () => {
    mockUsePermissions.mockReturnValue({
      isTenantAdminOrOwner: jest.fn().mockReturnValue(true),
      canEditOKR: jest.fn().mockReturnValue(true),
      isSuperuser: false,
    } as any)

    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Add')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const dropdownTrigger = screen.getByLabelText('Add options')
    await user.click(dropdownTrigger)

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Add Objective/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /Add Key Result/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /Add Initiative/i })).toBeInTheDocument()
    })
  })

  it('should hide Add button when user has no permissions', async () => {
    mockUsePermissions.mockReturnValue({
      isTenantAdminOrOwner: jest.fn().mockReturnValue(false),
      canEditOKR: jest.fn().mockReturnValue(false),
      isSuperuser: false,
    } as any)

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/okr/overview')) {
        return Promise.resolve({
          data: {
            page: 1,
            pageSize: 20,
            totalCount: 0,
            objectives: [],
            canCreateObjective: false,
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    expect(screen.queryByLabelText('Add')).not.toBeInTheDocument()
  })

  it('should open drawer with correct mode when clicking menu item', async () => {
    mockUsePermissions.mockReturnValue({
      isTenantAdminOrOwner: jest.fn().mockReturnValue(true),
      canEditOKR: jest.fn().mockReturnValue(true),
      isSuperuser: false,
    } as any)

    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Add')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const dropdownTrigger = screen.getByLabelText('Add options')
    await user.click(dropdownTrigger)

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Add Key Result/i })).toBeInTheDocument()
    })

    const krMenuItem = screen.getByRole('menuitem', { name: /Add Key Result/i })
    await user.click(krMenuItem)

    await waitFor(() => {
      expect(screen.getByText('New Key Result')).toBeInTheDocument()
    })
  })
})

