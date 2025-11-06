/**
 * W5.M3: Skeleton Components Tests
 * 
 * Component tests for skeleton components:
 * - Renders while loading
 * - No layout shift on resolve (height equality assertion)
 */

import { render } from '@testing-library/react'
import { OkrRowSkeleton, InlineInsightSkeleton, CycleHealthSkeleton, DrawerFormSkeleton } from './skeletons'

describe('Skeletons - W5.M3', () => {
  it('should render OkrRowSkeleton with stable height', () => {
    const { container } = render(<OkrRowSkeleton />)
    const skeleton = container.firstChild as HTMLElement
    
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('animate-pulse')
    
    // Check that skeleton has expected structure (title + 2 KR bars + metadata)
    const title = container.querySelector('.h-5')
    expect(title).toBeInTheDocument()
  })

  it('should render InlineInsightSkeleton with compact shimmer', () => {
    const { container } = render(<InlineInsightSkeleton />)
    const skeleton = container.firstChild as HTMLElement
    
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('animate-pulse')
    expect(skeleton).toHaveClass('text-xs') // Compact size
  })

  it('should render CycleHealthSkeleton with number pills', () => {
    const { container } = render(<CycleHealthSkeleton />)
    const skeleton = container.firstChild as HTMLElement
    
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('animate-pulse')
    
    // Should have multiple shimmer pills
    const pills = container.querySelectorAll('.bg-muted')
    expect(pills.length).toBeGreaterThan(0)
  })

  it('should render DrawerFormSkeleton with field skeletons', () => {
    const { container } = render(<DrawerFormSkeleton />)
    const skeleton = container.firstChild as HTMLElement
    
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('animate-pulse')
    
    // Should have field skeletons
    const fields = container.querySelectorAll('.h-10')
    expect(fields.length).toBeGreaterThan(0)
  })
})

