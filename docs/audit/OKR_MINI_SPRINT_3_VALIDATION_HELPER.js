/**
 * OKR Mini Sprint 3 - Validation Helper Script
 * 
 * Run this in browser console to help with validation
 */

// 1. Telemetry Event Listener
window.addEventListener('analytics', e => {
  console.log('📊 ANALYTICS EVENT:', e.detail)
})

// 2. Check Governance Status Bar
const checkGovernanceStatusBar = () => {
  const statusBar = document.querySelector('[data-testid="gov-status-bar"]')
  if (!statusBar) {
    console.warn('⚠️ Governance Status Bar not found')
    return false
  }
  
  // Check for click handlers
  const hasClickHandlers = statusBar.querySelectorAll('[onclick], [role="button"]').length > 0
  if (hasClickHandlers) {
    console.warn('⚠️ Governance Status Bar has click handlers (should be non-interactive)')
    return false
  }
  
  console.log('✅ Governance Status Bar found and non-interactive')
  return true
}

// 3. Check Why Inspector Links
const checkWhyInspector = () => {
  const whyLinks = document.querySelectorAll('[data-testid="why-link"]')
  const whyPopovers = document.querySelectorAll('[data-testid="why-popover"]')
  
  console.log(`Found ${whyLinks.length} "Why?" links`)
  console.log(`Found ${whyPopovers.length} "Why?" popovers`)
  
  // Check if feature flag is enabled (assumes user context available)
  if (whyLinks.length === 0) {
    console.log('ℹ️ No "Why?" links found - this is expected if rbacInspector flag is disabled')
  }
  
  return { links: whyLinks.length, popovers: whyPopovers.length }
}

// 4. Check Inline Health Signals
const checkInlineHealthSignals = () => {
  const insightBars = document.querySelectorAll('[role="status"][aria-label="Objective insights"]')
  console.log(`Found ${insightBars.length} inline insight bars`)
  
  // Check for specific signals
  const atRiskSignals = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent?.includes('at risk') || el.textContent?.includes('KRs at risk')
  )
  const overdueSignals = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent?.includes('Overdue check-ins')
  )
  const noProgressSignals = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent?.includes('No progress 14 days')
  )
  
  console.log(`Found ${atRiskSignals.length} "at risk" signals`)
  console.log(`Found ${overdueSignals.length} "overdue check-ins" signals`)
  console.log(`Found ${noProgressSignals.length} "no progress 14 days" signals`)
  
  return {
    total: insightBars.length,
    atRisk: atRiskSignals.length,
    overdue: overdueSignals.length,
    noProgress: noProgressSignals.length,
  }
}

// 5. Check Performance
const checkPerformance = () => {
  const perfEntries = performance.getEntriesByType('measure')
  const longTasks = perfEntries.filter(entry => entry.duration > 200)
  
  if (longTasks.length > 0) {
    console.warn(`⚠️ Found ${longTasks.length} long tasks (>200ms):`, longTasks)
  } else {
    console.log('✅ No long tasks found')
  }
  
  return longTasks
}

// 6. Check for Duplicate Filter Bars
const checkDuplicateFilters = () => {
  const filterBars = document.querySelectorAll('[class*="filter"], [class*="Filter"]')
  const uniqueFilterBars = new Set()
  
  filterBars.forEach(bar => {
    const classes = Array.from(bar.classList).join(' ')
    uniqueFilterBars.add(classes)
  })
  
  console.log(`Found ${filterBars.length} potential filter elements`)
  console.log(`Unique filter patterns: ${uniqueFilterBars.size}`)
  
  // Check for OKRFilterBar specifically
  const okrFilterBar = document.querySelector('[class*="OKRFilterBar"]')
  const governanceStatusBar = document.querySelector('[data-testid="gov-status-bar"]')
  
  if (okrFilterBar && governanceStatusBar) {
    console.log('✅ OKRFilterBar (interactive) and GovernanceStatusBar (summary-only) found')
  }
  
  return { total: filterBars.length, unique: uniqueFilterBars.size }
}

// 7. Network Monitoring for Inline Insights
const monitorInlineInsights = () => {
  const originalFetch = window.fetch
  const insightCalls = []
  
  window.fetch = async function(...args) {
    const url = args[0]
    if (typeof url === 'string' && url.includes('/okr/insights/objective/')) {
      console.log('🔍 Inline insight fetch triggered:', url)
      insightCalls.push({
        url,
        timestamp: new Date().toISOString(),
      })
    }
    return originalFetch.apply(this, args)
  }
  
  console.log('✅ Monitoring inline insight fetches')
  return () => {
    window.fetch = originalFetch
    console.log('📊 Total insight fetches:', insightCalls.length)
    return insightCalls
  }
}

// Export functions for manual use
window.OKRValidation = {
  checkGovernanceStatusBar,
  checkWhyInspector,
  checkInlineHealthSignals,
  checkPerformance,
  checkDuplicateFilters,
  monitorInlineInsights,
}

console.log('✅ OKR Mini Sprint 3 Validation Helper loaded')
console.log('Usage:')
console.log('  - OKRValidation.checkGovernanceStatusBar()')
console.log('  - OKRValidation.checkWhyInspector()')
console.log('  - OKRValidation.checkInlineHealthSignals()')
console.log('  - OKRValidation.checkPerformance()')
console.log('  - OKRValidation.checkDuplicateFilters()')
console.log('  - const stopMonitoring = OKRValidation.monitorInlineInsights()')

