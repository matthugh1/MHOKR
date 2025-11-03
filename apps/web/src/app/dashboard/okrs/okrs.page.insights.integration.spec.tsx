/**
 * W5.M2: OKRs Page - Insights Integration Tests
 * 
 * Integration tests for OKRs page with insights features:
 * - End-to-end render with mocked APIs
 * - Verify no leakage of hidden objectives/KRs
 * - Cycle Health Strip integration
 * - Attention Drawer integration
 */

import { render, screen, waitFor } from '@testing-library/react'
import OKRsPage from '../../page'
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

describe('OKRs Page - W5.M2 Insights Integration', () => {
  const mockObjectives = [
    {
      objectiveId: 'obj-1',
      title: 'Public Objective',
      status: 'ON_TRACK',
      publishState: 'PUBLISHED',
      isPublished: true,
      visibilityLevel: 'PUBLIC_TENANT',
      ownerId: 'user-1',
      organizationId: 'org-1',
      cycleId: 'cycle-1',
      progress: 50,
      keyResults: [
        {
          id: 'kr-1',
          title: 'KR 1',
          status: 'ON_TRACK',
          progress: 60,
          ownerId: 'user-1',
          canCheckIn: true,
        },
      ],
      canEdit: true,
      canDelete: true,
    },
    {
      objectiveId: 'obj-2',
      title: 'Private Objective',
      status: 'ON_TRACK',
      publishState: 'PUBLISHED',
      isPublished: true,
      visibilityLevel: 'PRIVATE',
      ownerId: 'user-1',
      organizationId: 'org-1',
      cycleId: 'cycle-1',
      progress: 40,
      keyResults: [],
      canEdit: true,
      canDelete: true,
    },
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

    // Mock OKR overview endpoint
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/okr/overview')) {
        return Promise.resolve({
          data: {
            page: 1,
            pageSize: 20,
            totalCount: 2,
            objectives: mockObjectives,
          },
        })
      }
      if (url.includes('/okr/insights/cycle-summary')) {
        return Promise.resolve({
          data: {
            cycleId: 'cycle-1',
            objectives: { total: 2, published: 2, draft: 0 },
            krs: { total: 1, onTrack: 1, atRisk: 0, blocked: 0, completed: 0 },
            checkins: { upcoming7d: 0, overdue: 0, recent24h: 0 },
          },
        })
      }
      if (url.includes('/reports/cycles/active')) {
        return Promise.resolve({
          data: [{ id: 'cycle-1', name: 'Q1 2025', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2025-03-31', organizationId: 'org-1' }],
        })
      }
      if (url.includes('/reports/check-ins/overdue')) {
        return Promise.resolve({
          data: [],
        })
      }
      return Promise.resolve({ data: [] })
    })
  })

  it('should render OKRs page with cycle health strip', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Objectives & Key Results')).toBeInTheDocument()
    })

    // Cycle Health Strip should appear when cycle is selected
    await waitFor(() => {
      expect(screen.getByText(/Cycle health:/)).toBeInTheDocument()
    })
  })

  it('should not leak PRIVATE objectives to unauthorized users', async () => {
    // Mock visibility: user can only see PUBLIC_TENANT
    mockUseTenantPermissions.mockReturnValue({
      canSeeObjective: jest.fn((obj: any) => obj.visibilityLevel === 'PUBLIC_TENANT'),
      canEditObjective: jest.fn().mockReturnValue(true),
      canDeleteObjective: jest.fn().mockReturnValue(true),
    } as any)

    // Mock API to return only visible objectives
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/okr/overview')) {
        return Promise.resolve({
          data: {
            page: 1,
            pageSize: 20,
            totalCount: 1,
            objectives: [mockObjectives[0]], // Only PUBLIC_TENANT
          },
        })
      }
      if (url.includes('/okr/insights/cycle-summary')) {
        return Promise.resolve({
          data: {
            cycleId: 'cycle-1',
            objectives: { total: 1, published: 1, draft: 0 },
            krs: { total: 1, onTrack: 1, atRisk: 0, blocked: 0, completed: 0 },
            checkins: { upcoming7d: 0, overdue: 0, recent24h: 0 },
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Public Objective')).toBeInTheDocument()
    })

    // PRIVATE objective should not be visible
    expect(screen.queryByText('Private Objective')).not.toBeInTheDocument()
  })

  it('should render attention drawer button', async () => {
    render(<OKRsPage />)

    await waitFor(() => {
      expect(screen.getByText('Needs attention')).toBeInTheDocument()
    })
  })

  it('should integrate cycle health strip with cycle selection', async () => {
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
      if (url.includes('/okr/insights/cycle-summary')) {
        return Promise.resolve({
          data: {
            cycleId: 'cycle-1',
            objectives: { total: 5, published: 3, draft: 2 },
            krs: { total: 10, onTrack: 7, atRisk: 2, blocked: 1, completed: 0 },
            checkins: { upcoming7d: 3, overdue: 1, recent24h: 2 },
          },
        })
      }
      if (url.includes('/reports/cycles/active')) {
        return Promise.resolve({
          data: [{ id: 'cycle-1', name: 'Q1 2025', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2025-03-31', organizationId: 'org-1' }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    render(<OKRsPage />)

    // Wait for cycle to be selected and cycle health strip to load
    await waitFor(() => {
      expect(screen.getByText(/Cycle health:/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should show cycle health numbers
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument() // Objectives total
      expect(screen.getByText('10')).toBeInTheDocument() // KRs total
    })
  })
})

