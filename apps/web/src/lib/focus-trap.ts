/**
 * Focus trap utility for drawers and modals
 * 
 * W5.M3: Provides focus trapping and return focus functionality
 * for accessibility compliance (WCAG 2.1 AA).
 */

/**
 * Traps focus within a container element
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  const getFocusableElements = () => {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
      (el) => {
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden'
      },
    )
  }

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }
  }

  container.addEventListener('keydown', handleTab)

  // Focus first element
  const focusableElements = getFocusableElements()
  if (focusableElements.length > 0) {
    focusableElements[0].focus()
  }

  return () => {
    container.removeEventListener('keydown', handleTab)
  }
}

/**
 * Returns focus to a previously focused element
 */
export function returnFocus(previousElement: HTMLElement | null): void {
  if (previousElement && typeof previousElement.focus === 'function') {
    previousElement.focus()
  }
}

/**
 * Gets the currently focused element
 */
export function getActiveElement(): HTMLElement | null {
  return document.activeElement as HTMLElement | null
}

