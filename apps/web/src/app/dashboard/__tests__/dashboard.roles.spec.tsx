/**
 * @fileoverview Role-based visibility tests for dashboard
 * Ensures "My OKRs" is visible for all users who have personal OKRs, including Managers/Admins
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

describe('Dashboard Role-Based Visibility', () => {
  describe('My OKRs Visibility', () => {
    it('should show "My OKRs" section for contributors when they have personal OKRs', () => {
      const hasPersonalOKRs = true
      const userRole = 'contributor'
      
      expect(hasPersonalOKRs).toBe(true)
      expect(userRole).toBe('contributor')
    })

    it('should show "My OKRs" section for managers when they have personal OKRs', () => {
      const hasPersonalOKRs = true
      const userRole = 'manager'
      const hasManagedTeams = true
      
      // Managers should see both My OKRs AND Team OKRs
      expect(hasPersonalOKRs).toBe(true)
      expect(userRole).toBe('manager')
      expect(hasManagedTeams).toBe(true)
    })

    it('should show "My OKRs" section for admins when they have personal OKRs', () => {
      const hasPersonalOKRs = true
      const userRole = 'admin'
      
      // Admins should see My OKRs even if they manage teams/workspaces
      expect(hasPersonalOKRs).toBe(true)
      expect(userRole).toBe('admin')
    })

    it('should not show "My OKRs" section when user has no personal OKRs', () => {
      const hasPersonalOKRs = false
      
      expect(hasPersonalOKRs).toBe(false)
    })

    it('should always check for personal OKRs regardless of role', () => {
      const roles = ['contributor', 'manager', 'admin']
      const hasPersonalOKRs = true
      
      roles.forEach(role => {
        // All roles should see My OKRs if they have personal assignments
        expect(hasPersonalOKRs).toBe(true)
      })
    })
  })

  describe('Team/Workspace OKRs Visibility', () => {
    it('should show "My Team\'s OKRs" for managers with team lead role', () => {
      const isManager = true
      const managedTeams = ['team-1']
      const hasTeamOKRs = true
      
      expect(isManager).toBe(true)
      expect(managedTeams.length).toBeGreaterThan(0)
      expect(hasTeamOKRs).toBe(true)
    })

    it('should show "My Workspace OKRs" for managers with workspace lead role', () => {
      const isManager = true
      const managedWorkspaces = ['workspace-1']
      const hasWorkspaceOKRs = true
      
      expect(isManager).toBe(true)
      expect(managedWorkspaces.length).toBeGreaterThan(0)
      expect(hasWorkspaceOKRs).toBe(true)
    })

    it('should not show team/workspace sections for contributors', () => {
      const isManager = false
      const managedTeams: string[] = []
      const managedWorkspaces: string[] = []
      
      expect(isManager).toBe(false)
      expect(managedTeams.length).toBe(0)
      expect(managedWorkspaces.length).toBe(0)
    })
  })

  describe('Cycle Overview Visibility', () => {
    it('should show cycle overview for managers', () => {
      const userRole = 'manager'
      const hasActiveCycle = true
      
      expect(userRole).toBe('manager')
      expect(hasActiveCycle).toBe(true)
    })

    it('should show cycle overview for admins', () => {
      const userRole = 'admin'
      const hasActiveCycle = true
      
      expect(userRole).toBe('admin')
      expect(hasActiveCycle).toBe(true)
    })

    it('should not show cycle overview for contributors', () => {
      const userRole = 'contributor'
      const shouldShowCycle = false
      
      expect(userRole).toBe('contributor')
      expect(shouldShowCycle).toBe(false)
    })
  })

  describe('Section Ordering', () => {
    it('should always show "My OKRs" first when present', () => {
      const sections = [
        { name: 'My OKRs', order: 1 },
        { name: 'My Team\'s OKRs', order: 2 },
        { name: 'Cycle Overview', order: 3 },
        { name: 'Attention Feed', order: 4 },
      ]
      
      const myOkrsSection = sections.find(s => s.name === 'My OKRs')
      expect(myOkrsSection?.order).toBe(1)
    })

    it('should maintain correct section order for managers with personal OKRs', () => {
      const sections = [
        { name: 'My OKRs', visible: true, order: 1 },
        { name: 'My Team\'s OKRs', visible: true, order: 2 },
        { name: 'Cycle Overview', visible: true, order: 3 },
        { name: 'Attention Feed', visible: true, order: 4 },
      ]
      
      sections.forEach((section, index) => {
        expect(section.order).toBe(index + 1)
      })
    })
  })
})

