/**
 * W5.M3: Error Mapping Tests
 * 
 * Unit tests for error mapping utility:
 * - Maps 403/429/governance errors correctly
 * - Provides correct variant (destructive/warning)
 */

import { mapErrorToMessage } from '@/lib/error-mapping'

describe('Error Mapping - W5.M3', () => {
  it('should map 403 error correctly', () => {
    const error = {
      response: {
        status: 403,
        data: { message: 'Permission denied' },
      },
    }

    const result = mapErrorToMessage(error)
    
    expect(result.message).toBe("You don't have permission to perform this action.")
    expect(result.variant).toBe('destructive')
  })

  it('should map 429 rate limit error correctly', () => {
    const error = {
      response: {
        status: 429,
        data: { message: 'Rate limit exceeded' },
      },
    }

    const result = mapErrorToMessage(error)
    
    expect(result.message).toBe('Too many requests. Please try again shortly.')
    expect(result.variant).toBe('warning')
  })

  it('should map governance errors (locked cycle) correctly', () => {
    const error = {
      response: {
        status: 400,
        data: { message: 'This cycle is locked' },
      },
    }

    const result = mapErrorToMessage(error)
    
    expect(result.message).toContain('This cycle is locked for your role')
    expect(result.variant).toBe('warning')
  })

  it('should map network errors correctly', () => {
    const error = {
      message: 'Network Error',
      code: 'ERR_NETWORK',
    }

    const result = mapErrorToMessage(error)
    
    expect(result.message).toContain('Network error')
    expect(result.variant).toBe('destructive')
  })

  it('should provide default fallback for unknown errors', () => {
    const error = {}

    const result = mapErrorToMessage(error)
    
    expect(result.message).toBe('Something went wrong. Please try again.')
    expect(result.variant).toBe('destructive')
  })
})

