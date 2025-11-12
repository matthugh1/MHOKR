/**
 * Error mapping utility
 * 
 * W5.M3: Standardises error messages for consistent UX
 */

export interface ErrorInfo {
  message: string
  variant?: 'default' | 'destructive' | 'warning'
}

export function mapErrorToMessage(error: any): ErrorInfo {
  // Handle HTTP errors
  if (error.response) {
    const status = error.response.status
    const data = error.response.data

    switch (status) {
      case 403:
        return {
          message: "You don't have permission to perform this action.",
          variant: 'destructive',
        }
      case 429:
        return {
          message: 'Too many requests. Please try again shortly.',
          variant: 'warning',
        }
      case 404:
        return {
          message: data?.message || 'Resource not found.',
          variant: 'destructive',
        }
      case 400:
        // Check for alignment validation errors
        if (data?.code === 'ALIGNMENT_DATE_OUT_OF_RANGE') {
          return {
            message: data.message || 'Child Objective dates must fall within parent Objective date range.',
            variant: 'destructive',
          }
        }
        if (data?.code === 'ALIGNMENT_CYCLE_MISMATCH') {
          return {
            message: data.message || 'Child Objective cycle must match parent Objective cycle.',
            variant: 'destructive',
          }
        }
        if (data?.code === 'INVALID_WEIGHT') {
          return {
            message: data.message || 'Weight must be between 0.0 and 3.0.',
            variant: 'destructive',
          }
        }
        // Check for governance errors in message
        if (data?.message) {
          const message = data.message.toLowerCase()
          if (message.includes('locked') || message.includes('cycle')) {
            return {
              message:
                'This cycle is locked for your role. Ask a Tenant Admin to publish changes.',
              variant: 'warning',
            }
          }
          if (message.includes('published') || message.includes('publish')) {
            return {
              message:
                'This item is published and cannot be changed. Ask a Tenant Admin for assistance.',
              variant: 'warning',
            }
          }
          return {
            message: data.message,
            variant: 'destructive',
          }
        }
        return {
          message: data?.message || 'Validation error. Please check your input.',
          variant: 'destructive',
        }
      default:
        // Check for governance errors in message
        if (data?.message) {
          const message = data.message.toLowerCase()
          if (message.includes('locked') || message.includes('cycle')) {
            return {
              message:
                'This cycle is locked for your role. Ask a Tenant Admin to publish changes.',
              variant: 'warning',
            }
          }
          if (message.includes('published') || message.includes('publish')) {
            return {
              message:
                'This item is published and cannot be changed. Ask a Tenant Admin for assistance.',
              variant: 'warning',
            }
          }
          return {
            message: data.message,
            variant: 'destructive',
          }
        }
    }
  }

  // Handle network errors
  if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
    return {
      message: 'Network error. Please check your connection and try again.',
      variant: 'destructive',
    }
  }

  // Default fallback
  return {
    message: 'Something went wrong. Please try again.',
    variant: 'destructive',
  }
}

