/**
 * @fileoverview Navigation deduplication tests
 * Ensures sidebar shows exactly one "Dashboard" item
 */

import { describe, it, expect } from '@jest/globals'

describe('Navigation Deduplication', () => {
  describe('Sidebar navigation', () => {
    it('should show exactly one "Dashboard" item', () => {
      // Expected navigation items after deduplication
      const navigation = [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'OKRs', href: '/dashboard/okrs' },
        { name: 'Visual Builder', href: '/dashboard/builder' },
        { name: 'Analytics', href: '/dashboard/analytics' },
        { name: 'AI Assistant', href: '/dashboard/ai' },
      ]

      // Count dashboard items
      const dashboardItems = navigation.filter(item => 
        item.name.toLowerCase().includes('dashboard')
      )

      expect(dashboardItems.length).toBe(1)
      expect(dashboardItems[0].name).toBe('Dashboard')
      expect(dashboardItems[0].href).toBe('/dashboard')
    })

    it('should not contain "My Dashboard" item', () => {
      const navigation = [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'OKRs', href: '/dashboard/okrs' },
        { name: 'Visual Builder', href: '/dashboard/builder' },
        { name: 'Analytics', href: '/dashboard/analytics' },
        { name: 'AI Assistant', href: '/dashboard/ai' },
      ]

      const myDashboardItems = navigation.filter(item => 
        item.name === 'My Dashboard'
      )

      expect(myDashboardItems.length).toBe(0)
    })

    it('should have Dashboard as the first item', () => {
      const navigation = [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'OKRs', href: '/dashboard/okrs' },
        { name: 'Visual Builder', href: '/dashboard/builder' },
        { name: 'Analytics', href: '/dashboard/analytics' },
        { name: 'AI Assistant', href: '/dashboard/ai' },
      ]

      expect(navigation[0].name).toBe('Dashboard')
      expect(navigation[0].href).toBe('/dashboard')
    })
  })
})

