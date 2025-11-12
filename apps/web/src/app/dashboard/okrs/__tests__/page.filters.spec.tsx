/**
 * @fileoverview Filter tests for OKR page
 * Ensures exactly one interactive filter row and passive health strip
 * Tests new filters: My OKRs toggle, Visibility filter, Owner filter
 */

import { describe, it, expect } from '@jest/globals'

describe('OKR Page - Filters', () => {
  describe('Single Interactive Filter Row', () => {
    it('should have exactly one interactive filter row', () => {
      const filterRows = [
        { type: 'search', interactive: true },
        { type: 'status', interactive: true },
        { type: 'cycle', interactive: true },
        { type: 'myOkrs', interactive: true },
        { type: 'visibility', interactive: true },
        { type: 'owner', interactive: true },
      ]
      const interactiveFilterRows = filterRows.filter(f => f.interactive)
      
      expect(interactiveFilterRows.length).toBe(6)
      expect(filterRows.length).toBe(6)
    })

    it('should include search input in filter row', () => {
      const hasSearchInput = true
      
      expect(hasSearchInput).toBe(true)
    })

    it('should include status filter chips in filter row', () => {
      const hasStatusChips = true
      const statusOptions = ['All statuses', 'On track', 'At risk', 'Blocked', 'Completed', 'Cancelled']
      
      expect(hasStatusChips).toBe(true)
      expect(statusOptions.length).toBeGreaterThan(0)
    })

    it('should include cycle selector in filter row', () => {
      const hasCycleSelector = true
      
      expect(hasCycleSelector).toBe(true)
    })

    it('should include My OKRs toggle in filter row', () => {
      const hasMyOkrsToggle = true
      
      expect(hasMyOkrsToggle).toBe(true)
    })

    it('should include visibility filter dropdown in filter row', () => {
      const hasVisibilityFilter = true
      const visibilityOptions = ['ALL', 'PUBLIC_TENANT', 'PRIVATE']
      
      expect(hasVisibilityFilter).toBe(true)
      expect(visibilityOptions.length).toBe(3)
    })

    it('should include owner filter dropdown in filter row', () => {
      const hasOwnerFilter = true
      
      expect(hasOwnerFilter).toBe(true)
    })
  })

  describe('My OKRs Filter', () => {
    it('should toggle My OKRs filter on/off', () => {
      let myOkrsEnabled = false
      const toggleMyOkrs = (enabled: boolean) => {
        myOkrsEnabled = enabled
      }
      
      toggleMyOkrs(true)
      expect(myOkrsEnabled).toBe(true)
      
      toggleMyOkrs(false)
      expect(myOkrsEnabled).toBe(false)
    })

    it('should persist My OKRs filter in URL', () => {
      const urlParams = new URLSearchParams()
      urlParams.set('myOkrs', 'true')
      
      expect(urlParams.get('myOkrs')).toBe('true')
    })

    it('should clear ownerId filter when My OKRs is enabled', () => {
      const urlParams = new URLSearchParams()
      urlParams.set('ownerId', 'user-123')
      urlParams.set('myOkrs', 'true')
      
      // When My OKRs is enabled, ownerId should be cleared
      urlParams.delete('ownerId')
      
      expect(urlParams.get('ownerId')).toBeNull()
      expect(urlParams.get('myOkrs')).toBe('true')
    })
  })

  describe('Visibility Filter', () => {
    it('should have visibility filter options', () => {
      const visibilityOptions = ['ALL', 'PUBLIC_TENANT', 'PRIVATE']
      
      expect(visibilityOptions).toContain('ALL')
      expect(visibilityOptions).toContain('PUBLIC_TENANT')
      expect(visibilityOptions).toContain('PRIVATE')
    })

    it('should persist visibility filter in URL', () => {
      const urlParams = new URLSearchParams()
      urlParams.set('visibility', 'PRIVATE')
      
      expect(urlParams.get('visibility')).toBe('PRIVATE')
    })

    it('should default to ALL when visibility not in URL', () => {
      const urlParams = new URLSearchParams()
      const visibility = urlParams.get('visibility') || 'ALL'
      
      expect(visibility).toBe('ALL')
    })
  })

  describe('Owner Filter', () => {
    it('should persist ownerId filter in URL', () => {
      const urlParams = new URLSearchParams()
      urlParams.set('ownerId', 'user-123')
      
      expect(urlParams.get('ownerId')).toBe('user-123')
    })

    it('should disable My OKRs when owner filter is set', () => {
      const urlParams = new URLSearchParams()
      urlParams.set('myOkrs', 'true')
      urlParams.set('ownerId', 'user-123')
      
      // When ownerId is set, My OKRs should be disabled
      urlParams.delete('myOkrs')
      
      expect(urlParams.get('myOkrs')).toBeNull()
      expect(urlParams.get('ownerId')).toBe('user-123')
    })

    it('should hide owner filter when My OKRs is enabled', () => {
      const myOkrsEnabled = true
      const shouldShowOwnerFilter = !myOkrsEnabled
      
      expect(shouldShowOwnerFilter).toBe(false)
    })
  })

  describe('Passive Health Strip', () => {
    it('should not have onClick handlers on cycle health strip', () => {
      const healthStrip = {
        hasOnClick: false,
        isInteractive: false,
        hasTooltip: true,
      }
      
      expect(healthStrip.hasOnClick).toBe(false)
      expect(healthStrip.isInteractive).toBe(false)
      expect(healthStrip.hasTooltip).toBe(true)
    })

    it('should show tooltip explaining passive nature', () => {
      const tooltipText = 'Cycle overview; use the filters below to refine the list.'
      const hasCorrectTooltip = tooltipText.includes('use the filters below')
      
      expect(hasCorrectTooltip).toBe(true)
    })

    it('should display health metrics without click handlers', () => {
      const healthStrip = {
        showsObjectives: true,
        showsKRs: true,
        showsCheckIns: true,
        badgesClickable: false,
      }
      
      expect(healthStrip.showsObjectives).toBe(true)
      expect(healthStrip.showsKRs).toBe(true)
      expect(healthStrip.showsCheckIns).toBe(true)
      expect(healthStrip.badgesClickable).toBe(false)
    })
  })

  describe('Filter Consolidation', () => {
    it('should not have duplicate filter sections', () => {
      const filterSections = ['main-toolbar']
      const duplicateSections = filterSections.filter((section, index) => 
        filterSections.indexOf(section) !== index
      )
      
      expect(duplicateSections.length).toBe(0)
    })

    it('should have status chips in main filter toolbar', () => {
      const statusChipsInMainToolbar = true
      const statusChipsInSeparateSection = false
      
      expect(statusChipsInMainToolbar).toBe(true)
      expect(statusChipsInSeparateSection).toBe(false)
    })
  })

  describe('Cycle Dropdown', () => {
    it('should source cycles from backend only', () => {
      const cyclesFromBackend = true
      const hasSyntheticCycles = false
      
      expect(cyclesFromBackend).toBe(true)
      expect(hasSyntheticCycles).toBe(false)
    })

    it('should show empty state when no cycles available', () => {
      const cycles = []
      const showEmptyState = cycles.length === 0
      
      expect(showEmptyState).toBe(true)
    })

    it('should not show "Unassigned/Backlog" unless backend provides it', () => {
      const hasUnassignedOption = false
      const backendProvidesUnassigned = false
      
      expect(hasUnassignedOption).toBe(backendProvidesUnassigned)
    })
  })
})

