/**
 * W5.M1: OKR Creation Drawer - Publish Flow Tests
 * 
 * Component tests for OKRCreationDrawer publish functionality:
 * - Validation gates (publish disabled until valid)
 * - Visibility options exclude EXEC_ONLY
 * - PRIVATE requires whitelist
 * - SUPERUSER publish blocked
 * - Success flow: drawer closes, list refreshes
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OKRCreationDrawer } from '../OKRCreationDrawer'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'

// Mock dependencies
jest.mock('@/lib/api')
jest.mock('@/contexts/auth.context')
jest.mock('@/hooks/usePermissions')
jest.mock('@/hooks/use-toast')

const mockApi = api as jest.Mocked<typeof api>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUsePermissions = usePermissions as jest.MockedFunction<typeof usePermissions>
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>

describe('OKRCreationDrawer - W5.M1 Publish Flow', () => {
  const mockOnClose = jest.fn()
  const mockOnSuccess = jest.fn()
  const mockToast = jest.fn()

  const mockProps = {
    isOpen: true,
    onClose: mockOnClose,
    availableUsers: [
      { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      { id: 'user-2', name: 'User 2', email: 'user2@example.com' },
    ],
    activeCycles: [
      { id: 'cycle-1', name: 'Q1 2025', status: 'ACTIVE' },
    ],
    currentOrganization: { id: 'org-1' },
    onSuccess: mockOnSuccess,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      isLoading: false,
    } as any)
    mockUsePermissions.mockReturnValue({
      isTenantAdminOrOwner: jest.fn().mockReturnValue(false),
      isSuperuser: false,
    } as any)
    mockUseToast.mockReturnValue({
      toast: mockToast,
    } as any)
    mockApi.get.mockResolvedValue({
      data: {
        allowedVisibilityLevels: ['PUBLIC_TENANT', 'PRIVATE'],
        allowedOwners: mockProps.availableUsers,
        canAssignOthers: true,
        availableCycles: mockProps.activeCycles,
      },
    })
  })

  describe('Validation Gates', () => {
    it('should disable publish button until title + cycle + at least 1 KR is present', async () => {
      render(<OKRCreationDrawer {...mockProps} />)

      // Navigate to review step
      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Next')) // Step A -> Step B
      fireEvent.click(screen.getByText('Next')) // Step B -> Step C
      
      // Add one KR
      const addKRButton = screen.getByText(/Add Key Result/i)
      fireEvent.click(addKRButton)

      // Fill KR title
      const krTitleInput = screen.getByLabelText(/KR Title/i)
      fireEvent.change(krTitleInput, { target: { value: 'Test KR' } })

      fireEvent.click(screen.getByText('Next')) // Step C -> Step D

      // Publish button should be enabled now
      await waitFor(() => {
        const publishButton = screen.getByText(/Publish/i)
        expect(publishButton).not.toBeDisabled()
      })
    })

    it('should disable publish if title is empty', async () => {
      render(<OKRCreationDrawer {...mockProps} />)

      // Navigate through steps without filling title
      fireEvent.click(screen.getByText('Next')) // Step A -> Step B
      fireEvent.click(screen.getByText('Next')) // Step B -> Step C
      
      const addKRButton = screen.getByText(/Add Key Result/i)
      fireEvent.click(addKRButton)

      fireEvent.click(screen.getByText('Next')) // Step C -> Step D

      // Publish button should be disabled
      await waitFor(() => {
        const publishButton = screen.getByText(/Publish/i)
        expect(publishButton).toBeDisabled()
      })
    })

    it('should disable publish if no Key Results', async () => {
      render(<OKRCreationDrawer {...mockProps} />)

      // Fill title
      const titleInput = screen.getByLabelText(/Objective Title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Objective' } })

      // Navigate through steps without adding KR
      fireEvent.click(screen.getByText('Next')) // Step A -> Step B
      fireEvent.click(screen.getByText('Next')) // Step B -> Step C
      fireEvent.click(screen.getByText('Next')) // Step C -> Step D

      // Publish button should be disabled
      await waitFor(() => {
        const publishButton = screen.getByText(/Publish/i)
        expect(publishButton).toBeDisabled()
      })
    })
  })

  describe('Visibility Options', () => {
    it('should exclude EXEC_ONLY from visibility options', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          allowedVisibilityLevels: ['PUBLIC_TENANT', 'PRIVATE'],
          allowedOwners: mockProps.availableUsers,
          canAssignOthers: true,
          availableCycles: mockProps.activeCycles,
        },
      })

      render(<OKRCreationDrawer {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Next')) // Step A -> Step B

      // Check visibility dropdown
      const visibilitySelect = screen.getByLabelText(/Visibility Level/i)
      fireEvent.click(visibilitySelect)

      // Should only show PUBLIC_TENANT and PRIVATE
      expect(screen.getByText('Public (Tenant)')).toBeInTheDocument()
      expect(screen.getByText('Private')).toBeInTheDocument()
      expect(screen.queryByText(/EXEC_ONLY/i)).not.toBeInTheDocument()
    })
  })

  describe('PRIVATE Visibility', () => {
    it('should require whitelist users when PRIVATE is selected', async () => {
      render(<OKRCreationDrawer {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Next')) // Step A -> Step B

      // Select PRIVATE visibility
      const visibilitySelect = screen.getByLabelText(/Visibility Level/i)
      fireEvent.click(visibilitySelect)
      fireEvent.click(screen.getByText('Private'))

      // Whitelist section should appear
      await waitFor(() => {
        expect(screen.getByText(/Whitelist Users/i)).toBeInTheDocument()
      })

      // Should show available users in whitelist
      expect(screen.getByText('User 2')).toBeInTheDocument()
    })
  })

  describe('SUPERUSER Block', () => {
    it('should show warning and block publish if user is SUPERUSER', async () => {
      mockUsePermissions.mockReturnValue({
        isTenantAdminOrOwner: jest.fn().mockReturnValue(false),
        isSuperuser: true,
      } as any)

      render(<OKRCreationDrawer {...mockProps} />)

      // Fill required fields
      const titleInput = screen.getByLabelText(/Objective Title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Objective' } })

      // Navigate to review step
      fireEvent.click(screen.getByText('Next')) // Step A -> Step B
      fireEvent.click(screen.getByText('Next')) // Step B -> Step C
      
      const addKRButton = screen.getByText(/Add Key Result/i)
      fireEvent.click(addKRButton)

      const krTitleInput = screen.getByLabelText(/KR Title/i)
      fireEvent.change(krTitleInput, { target: { value: 'Test KR' } })

      fireEvent.click(screen.getByText('Next')) // Step C -> Step D

      // Should show SUPERUSER warning
      await waitFor(() => {
        expect(screen.getByText(/SUPERUSER accounts are read-only/i)).toBeInTheDocument()
      })

      // Publish button should be disabled or show error
      const publishButton = screen.getByText(/Publish/i)
      expect(publishButton).toBeDisabled()
    })
  })

  describe('Success Flow', () => {
    it('should call composite endpoint, close drawer, and refresh list on success', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          objectiveId: 'objective-1',
          keyResultIds: ['kr-1'],
          publishState: 'PUBLISHED',
          status: 'ON_TRACK',
          visibilityLevel: 'PUBLIC_TENANT',
        },
      })

      render(<OKRCreationDrawer {...mockProps} />)

      // Fill form
      const titleInput = screen.getByLabelText(/Objective Title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Objective' } })

      // Navigate to review step
      fireEvent.click(screen.getByText('Next')) // Step A -> Step B
      fireEvent.click(screen.getByText('Next')) // Step B -> Step C
      
      const addKRButton = screen.getByText(/Add Key Result/i)
      fireEvent.click(addKRButton)

      const krTitleInput = screen.getByLabelText(/KR Title/i)
      fireEvent.change(krTitleInput, { target: { value: 'Test KR' } })

      fireEvent.click(screen.getByText('Next')) // Step C -> Step D

      // Click publish
      await waitFor(() => {
        const publishButton = screen.getByText(/Publish/i)
        expect(publishButton).not.toBeDisabled()
      })

      const publishButton = screen.getByText(/Publish/i)
      fireEvent.click(publishButton)

      // Should call composite endpoint
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/okr/create-composite',
          expect.objectContaining({
            objective: expect.objectContaining({
              title: 'Test Objective',
              ownerUserId: 'user-1',
              cycleId: 'cycle-1',
              visibilityLevel: 'PUBLIC_TENANT',
            }),
            keyResults: expect.arrayContaining([
              expect.objectContaining({
                title: 'Test KR',
                ownerUserId: 'user-1',
              }),
            ]),
          }),
        )
      })

      // Should show success toast
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'OKR published successfully',
        }),
      )

      // Should call onSuccess (which refreshes list)
      expect(mockOnSuccess).toHaveBeenCalled()

      // Drawer should close (via onSuccess callback in parent)
    })

    it('should handle 403 permission denied error', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 403,
          data: { message: 'You do not have permission to create OKRs in this scope' },
        },
      })

      render(<OKRCreationDrawer {...mockProps} />)

      // Fill form and navigate to review
      const titleInput = screen.getByLabelText(/Objective Title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Objective' } })

      fireEvent.click(screen.getByText('Next'))
      fireEvent.click(screen.getByText('Next'))
      
      const addKRButton = screen.getByText(/Add Key Result/i)
      fireEvent.click(addKRButton)

      const krTitleInput = screen.getByLabelText(/KR Title/i)
      fireEvent.change(krTitleInput, { target: { value: 'Test KR' } })

      fireEvent.click(screen.getByText('Next'))

      // Click publish
      await waitFor(() => {
        const publishButton = screen.getByText(/Publish/i)
        expect(publishButton).not.toBeDisabled()
      })

      const publishButton = screen.getByText(/Publish/i)
      fireEvent.click(publishButton)

      // Should show error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Permission denied',
            variant: 'destructive',
          }),
        )
      })

      // Drawer should NOT close
      expect(mockOnSuccess).not.toHaveBeenCalled()
    })

    it('should handle 429 rate limit error', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' },
        },
      })

      render(<OKRCreationDrawer {...mockProps} />)

      // Fill form and navigate to review
      const titleInput = screen.getByLabelText(/Objective Title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Objective' } })

      fireEvent.click(screen.getByText('Next'))
      fireEvent.click(screen.getByText('Next'))
      
      const addKRButton = screen.getByText(/Add Key Result/i)
      fireEvent.click(addKRButton)

      const krTitleInput = screen.getByLabelText(/KR Title/i)
      fireEvent.change(krTitleInput, { target: { value: 'Test KR' } })

      fireEvent.click(screen.getByText('Next'))

      // Click publish
      await waitFor(() => {
        const publishButton = screen.getByText(/Publish/i)
        expect(publishButton).not.toBeDisabled()
      })

      const publishButton = screen.getByText(/Publish/i)
      fireEvent.click(publishButton)

      // Should show rate limit toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Rate limit exceeded',
            variant: 'destructive',
          }),
        )
      })
    })
  })
})


