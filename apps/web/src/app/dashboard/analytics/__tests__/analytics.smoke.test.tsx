// NOTE: phase14-hardening
// Test scaffold created in Phase 11. We have not yet wired Jest/RTL.
// @ts-nocheck is intentional to unblock main without removing test intent.

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * @fileoverview Smoke test for Analytics page
 * 
 * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AnalyticsPage from '../page'
import api from '@/lib/api'

// Mock API module
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}))

// Mock contexts
jest.mock('@/contexts/workspace.context', () => ({
  useWorkspace: () => ({
    currentOrganization: { id: 'org-1', name: 'Test Org' },
  }),
}))

jest.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  }),
}))

jest.mock('@/hooks/useTenantPermissions', () => ({
  useTenantPermissions: () => ({
    canExportData: () => true,
  }),
}))

jest.mock('@/components/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/dashboard-layout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('Analytics Page Smoke Test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful API responses
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/reports/analytics/summary') {
        return Promise.resolve({
          data: {
            totalObjectives: 10,
            byStatus: { ON_TRACK: 7, AT_RISK: 2, OFF_TRACK: 1 },
            atRiskRatio: 0.2,
          },
        })
      }
      if (url === '/reports/analytics/feed') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/check-ins/overdue') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/pillars/coverage') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/cycles/active') {
        return Promise.resolve({ data: [] })
      }
      if (url.startsWith('/reports/health-heatmap')) {
        return Promise.resolve({
          data: {
            buckets: [
              { dimensionId: 'team-1', dimensionName: 'Engineering', status: 'ON_TRACK', count: 5 },
              { dimensionId: 'team-1', dimensionName: 'Engineering', status: 'AT_RISK', count: 2 },
              { dimensionId: 'team-2', dimensionName: 'Product', status: 'ON_TRACK', count: 3 },
            ],
            totals: [
              { dimensionId: 'team-1', dimensionName: 'Engineering', total: 7 },
              { dimensionId: 'team-2', dimensionName: 'Product', total: 3 },
            ],
          },
        })
      }
      if (url.startsWith('/reports/at-risk')) {
        return Promise.resolve({ data: [] })
      }
      if (url.startsWith('/reports/cycle-health')) {
        return Promise.resolve({
          data: {
            totalsByStatus: {
              ON_TRACK: 10,
              AT_RISK: 3,
              OFF_TRACK: 1,
              BLOCKED: 0,
              COMPLETED: 5,
              CANCELLED: 0,
            },
            avgConfidence: 75.5,
            coverage: {
              objectivesWith2PlusKRsPct: 85.5,
              krsWithRecentCheckInPct: 72.3,
            },
          },
        })
      }
      return Promise.resolve({ data: null })
    })
  })

  it('renders without crashing', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Execution Health/i)).toBeInTheDocument()
    })
  })

  it('renders StatCard grid when data is loaded', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => {
      expect(screen.getByText('Total Objectives')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
    })
  })

  it('displays empty state cards when sections have no data', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => {
      expect(screen.getByText('No overdue check-ins')).toBeInTheDocument()
      expect(screen.getByText('No recent activity.')).toBeInTheDocument()
    })
  })

  it('renders SectionHeader components', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => {
      expect(screen.getByText('Strategic Coverage')).toBeInTheDocument()
      expect(screen.getByText('Execution Risk')).toBeInTheDocument()
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })
  })

  it('renders CSV export button when user has permission', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Export CSV/i)).toBeInTheDocument()
    })
  })

  it('renders real data from API responses', async () => {
    // Mock API with realistic data
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/reports/analytics/summary') {
        return Promise.resolve({
          data: {
            totalObjectives: 15,
            byStatus: { ON_TRACK: 10, AT_RISK: 3, OFF_TRACK: 1, COMPLETED: 1 },
            atRiskRatio: 0.2,
          },
        })
      }
      if (url === '/reports/analytics/feed') {
        return Promise.resolve({
          data: [
            {
              id: 'checkin-1',
              krId: 'kr-1',
              krTitle: 'Increase user engagement',
              userId: 'user-1',
              userName: 'John Doe',
              value: 75,
              confidence: 85,
              createdAt: new Date().toISOString(),
            },
          ],
        })
      }
      if (url === '/reports/check-ins/overdue') {
        return Promise.resolve({
          data: [
            {
              krId: 'kr-2',
              krTitle: 'Reduce churn rate',
              objectiveId: 'obj-1',
              objectiveTitle: 'Improve retention',
              owner: { id: 'user-2', name: 'Jane Smith' },
              cadence: 'WEEKLY',
              lastCheckInAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
              daysOverdue: 3,
              status: 'OVERDUE',
            },
          ],
        })
      }
      if (url === '/reports/pillars/coverage') {
        return Promise.resolve({
          data: [
            { pillarId: 'pillar-1', pillarName: 'Product Innovation', objectiveCountInActiveCycle: 5 },
            { pillarId: 'pillar-2', pillarName: 'Customer Success', objectiveCountInActiveCycle: 3 },
          ],
        })
      }
      if (url === '/reports/cycles/active') {
        return Promise.resolve({
          data: [
            {
              id: 'cycle-1',
              name: 'Q1 2025',
              status: 'ACTIVE',
              startDate: new Date().toISOString(),
              endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId: 'org-1',
            },
          ],
        })
      }
      return Promise.resolve({ data: null })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      // Verify summary stats
      expect(screen.getByText('15')).toBeInTheDocument() // Total Objectives
      expect(screen.getByText('10 on track')).toBeInTheDocument()
      
      // Verify feed data
      expect(screen.getByText(/John Doe.*checked in.*Increase user engagement/i)).toBeInTheDocument()
      
      // Verify overdue check-ins
      expect(screen.getByText(/Reduce churn rate/i)).toBeInTheDocument()
      expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument()
      
      // Verify pillar coverage
      expect(screen.getByText(/Product Innovation/i)).toBeInTheDocument()
      expect(screen.getByText(/Customer Success/i)).toBeInTheDocument()
      
      // Verify active cycle
      expect(screen.getByText(/Q1 2025 Execution Health/i)).toBeInTheDocument()
    })
  })

  it('handles 403 Forbidden error from RBAC', async () => {
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/reports/analytics/summary') {
        return Promise.reject({
          response: { status: 403, data: { message: 'Forbidden' } },
        })
      }
      // Other endpoints succeed
      return Promise.resolve({ data: [] })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/You do not have permission to view analytics/i)).toBeInTheDocument()
      expect(screen.getByText(/Please check your permissions or try refreshing the page/i)).toBeInTheDocument()
    })
  })

  it('handles 401 Unauthorized error gracefully', async () => {
    ;(api.get as jest.Mock).mockImplementation(() => {
      return Promise.reject({
        response: { status: 401, data: { message: 'Unauthorized' } },
      })
    })

    render(<AnalyticsPage />)
    
    // 401 should be handled by interceptor (redirects to login)
    // Page should not show error message, but should handle gracefully
    await waitFor(() => {
      // Should not show fetch error since 401 is handled by interceptor
      expect(screen.queryByText(/You do not have permission/i)).not.toBeInTheDocument()
    })
  })

  it('handles network errors gracefully', async () => {
    ;(api.get as jest.Mock).mockImplementation(() => {
      return Promise.reject(new Error('Network error'))
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument()
    })
  })

  it('renders health heatmap table with data', async () => {
    // Mock API with heatmap data
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/reports/analytics/summary') {
        return Promise.resolve({
          data: {
            totalObjectives: 10,
            byStatus: { ON_TRACK: 7, AT_RISK: 2, OFF_TRACK: 1 },
            atRiskRatio: 0.2,
          },
        })
      }
      if (url === '/reports/analytics/feed') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/check-ins/overdue') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/pillars/coverage') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/cycles/active') {
        return Promise.resolve({ data: [] })
      }
      if (url.startsWith('/reports/health-heatmap')) {
        return Promise.resolve({
          data: {
            buckets: [
              { dimensionId: 'team-1', dimensionName: 'Engineering', status: 'ON_TRACK', count: 5 },
              { dimensionId: 'team-1', dimensionName: 'Engineering', status: 'AT_RISK', count: 2 },
              { dimensionId: 'team-2', dimensionName: 'Product', status: 'ON_TRACK', count: 3 },
            ],
            totals: [
              { dimensionId: 'team-1', dimensionName: 'Engineering', total: 7 },
              { dimensionId: 'team-2', dimensionName: 'Product', total: 3 },
            ],
          },
        })
      }
      return Promise.resolve({ data: null })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Health Heatmap/i)).toBeInTheDocument()
      expect(screen.getByText(/Engineering/i)).toBeInTheDocument()
      expect(screen.getByText(/Product/i)).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument() // ON_TRACK count
      expect(screen.getByText('2')).toBeInTheDocument() // AT_RISK count
      expect(screen.getByText('7')).toBeInTheDocument() // Total for Engineering
    })
  })

  it('displays empty state when heatmap has no data', async () => {
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/reports/health-heatmap')) {
        return Promise.resolve({
          data: {
            buckets: [],
            totals: [],
          },
        })
      }
      // Other endpoints return empty/default data
      return Promise.resolve({ data: [] })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/No data available/i)).toBeInTheDocument()
    })
  })

  it('renders at-risk items card with count and list', async () => {
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/reports/analytics/summary') {
        return Promise.resolve({
          data: {
            totalObjectives: 10,
            byStatus: { ON_TRACK: 7, AT_RISK: 2, OFF_TRACK: 1 },
            atRiskRatio: 0.2,
          },
        })
      }
      if (url === '/reports/analytics/feed') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/check-ins/overdue') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/pillars/coverage') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/cycles/active') {
        return Promise.resolve({ data: [] })
      }
      if (url.startsWith('/reports/health-heatmap')) {
        return Promise.resolve({
          data: {
            buckets: [],
            totals: [],
          },
        })
      }
      if (url.startsWith('/reports/at-risk')) {
        return Promise.resolve({
          data: [
            {
              entityType: 'OBJECTIVE',
              id: 'obj-1',
              title: 'At-Risk Objective',
              owner: { id: 'user-1', name: 'John Doe' },
              status: 'AT_RISK',
              confidence: null,
              lastUpdatedAt: new Date().toISOString(),
              dimensionRefs: {
                teamId: 'team-1',
                teamName: 'Engineering',
              },
            },
            {
              entityType: 'KEY_RESULT',
              id: 'kr-1',
              title: 'Low Confidence KR',
              owner: { id: 'user-2', name: 'Jane Smith' },
              status: 'ON_TRACK',
              confidence: 45,
              lastUpdatedAt: new Date().toISOString(),
              dimensionRefs: {
                objectiveId: 'obj-1',
                objectiveTitle: 'Parent Objective',
              },
            },
          ],
        })
      }
      return Promise.resolve({ data: null })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/At-Risk Items/i)).toBeInTheDocument()
      expect(screen.getByText(/2 items at risk/i)).toBeInTheDocument()
      expect(screen.getByText(/At-Risk Objective/i)).toBeInTheDocument()
      expect(screen.getByText(/Low Confidence KR/i)).toBeInTheDocument()
      expect(screen.getByText(/Confidence: 45%/i)).toBeInTheDocument()
    })
  })

  it('displays empty state when no at-risk items', async () => {
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/reports/at-risk')) {
        return Promise.resolve({
          data: [],
        })
      }
      // Other endpoints return empty/default data
      return Promise.resolve({ data: [] })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/No at-risk items found/i)).toBeInTheDocument()
    })
  })

  it('renders cycle health card with KPIs', async () => {
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/reports/analytics/summary') {
        return Promise.resolve({
          data: {
            totalObjectives: 10,
            byStatus: { ON_TRACK: 7, AT_RISK: 2, OFF_TRACK: 1 },
            atRiskRatio: 0.2,
          },
        })
      }
      if (url === '/reports/analytics/feed') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/check-ins/overdue') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/pillars/coverage') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/reports/cycles/active') {
        return Promise.resolve({
          data: [{ id: 'cycle-1', name: 'Q1 2025', status: 'ACTIVE' }],
        })
      }
      if (url.startsWith('/reports/health-heatmap')) {
        return Promise.resolve({
          data: {
            buckets: [],
            totals: [],
          },
        })
      }
      if (url.startsWith('/reports/at-risk')) {
        return Promise.resolve({ data: [] })
      }
      if (url.startsWith('/reports/cycle-health')) {
        return Promise.resolve({
          data: {
            totalsByStatus: {
              ON_TRACK: 10,
              AT_RISK: 3,
              OFF_TRACK: 1,
              BLOCKED: 0,
              COMPLETED: 5,
              CANCELLED: 0,
            },
            avgConfidence: 75.5,
            coverage: {
              objectivesWith2PlusKRsPct: 85.5,
              krsWithRecentCheckInPct: 72.3,
            },
          },
        })
      }
      return Promise.resolve({ data: null })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Cycle Health/i)).toBeInTheDocument()
      expect(screen.getByText(/Health metrics for Q1 2025/i)).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument() // ON_TRACK count
      expect(screen.getByText('3')).toBeInTheDocument() // AT_RISK count
      expect(screen.getByText(/75.5%/i)).toBeInTheDocument() // Average confidence
      expect(screen.getByText(/85.5%/i)).toBeInTheDocument() // Objectives with ≥2 KRs
      expect(screen.getByText(/72.3%/i)).toBeInTheDocument() // KRs with recent check-in
    })
  })

  it('handles empty cycle gracefully', async () => {
    ;(api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/reports/cycles/active') {
        return Promise.resolve({ data: [] })
      }
      // Other endpoints return empty/default data
      return Promise.resolve({ data: [] })
    })

    render(<AnalyticsPage />)
    
    await waitFor(() => {
      // Cycle health card should not be rendered when no active cycle
      expect(screen.queryByText(/Cycle Health/i)).not.toBeInTheDocument()
    })
  })
})

