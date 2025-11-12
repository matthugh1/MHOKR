/**
 * Policy Explorer Page Tests
 * 
 * Tests for the Superuser Policy Decision Explorer page.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import PolicyExplorerPage from '../page'
import { useAuth } from '@/contexts/auth.context'
import { useWorkspace } from '@/contexts/workspace.context'
import api from '@/lib/api'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/contexts/auth.context', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/contexts/workspace.context', () => ({
  useWorkspace: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
}))

describe('PolicyExplorerPage', () => {
  const mockPush = jest.fn()
  const mockRouter = {
    push: mockPush,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    process.env.RBAC_INSPECTOR = 'true'
  })

  it('should redirect if user is not superuser', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-123', isSuperuser: false },
    })
    ;(useWorkspace as jest.Mock).mockReturnValue({
      isSuperuser: false,
    })

    render(<PolicyExplorerPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should redirect if RBAC_INSPECTOR flag is false', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-123', isSuperuser: true },
    })
    ;(useWorkspace as jest.Mock).mockReturnValue({
      isSuperuser: true,
    })
    ;(api.get as jest.Mock).mockResolvedValue({
      data: { flags: { rbacInspector: false } },
    })

    render(<PolicyExplorerPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should render page if user is superuser and flag is enabled', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-123', isSuperuser: true },
    })
    ;(useWorkspace as jest.Mock).mockReturnValue({
      isSuperuser: true,
    })
    ;(api.get as jest.Mock).mockResolvedValue({
      data: { flags: { rbacInspector: true } },
    })

    render(<PolicyExplorerPage />)

    await waitFor(() => {
      expect(screen.getByText('Policy Decision Explorer')).toBeInTheDocument()
    })
  })

  it('should submit decision request and display result', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-123', isSuperuser: true },
    })
    ;(useWorkspace as jest.Mock).mockReturnValue({
      isSuperuser: true,
    })
    ;(api.get as jest.Mock).mockResolvedValue({
      data: { flags: { rbacInspector: true } },
    })
    ;(api.post as jest.Mock).mockResolvedValue({
      data: {
        allow: true,
        reason: 'ALLOW',
        details: {
          userRoles: ['TENANT_ADMIN'],
          scopes: { tenantIds: ['org-123'], workspaceIds: [], teamIds: [] },
          resourceCtxEcho: {},
        },
        meta: {
          requestUserId: 'user-123',
          evaluatedUserId: 'user-123',
          action: 'view_okr',
          timestamp: new Date().toISOString(),
        },
      },
    })

    render(<PolicyExplorerPage />)

    await waitFor(() => {
      expect(screen.getByText('Policy Decision Explorer')).toBeInTheDocument()
    })

    // Find and click submit button
    const submitButton = screen.getByText('Evaluate Decision')
    submitButton.click()

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/policy/decide', expect.any(Object))
    })
  })
})



