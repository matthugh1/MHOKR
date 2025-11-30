/**
 * Error tracking service for capturing errors in the application
 * Captures console errors, promise rejections, and provides API for retrieving errors
 */

export interface TrackedError {
  type: 'console' | 'promise' | 'api' | 'react';
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
  url?: string;
  statusCode?: number;
  response?: any;
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  private maxErrors = 10; // Keep last 10 errors
  private initialized = false;

  /**
   * Initialize error tracking by setting up global error handlers
   */
  init() {
    if (this.initialized) {
      return;
    }

    // Capture console errors
    window.addEventListener('error', (event) => {
      this.trackError({
        type: 'console',
        message: event.message || 'Unknown error',
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now(),
        url: window.location.href,
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      
      // Skip cancellation errors - these are expected when requests are cancelled
      if (
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError' ||
        error?.code === 'ERR_CANCELED' ||
        error?.message?.toLowerCase().includes('canceled') ||
        error?.message?.toLowerCase().includes('aborted')
      ) {
        return; // Don't track cancellation errors
      }

      const message = error?.message || String(error) || 'Unhandled promise rejection';
      const stack = error?.stack;

      this.trackError({
        type: 'promise',
        message,
        stack,
        timestamp: Date.now(),
        url: window.location.href,
      });
    });

    this.initialized = true;
  }

  /**
   * Track an error
   */
  trackError(error: TrackedError) {
    this.errors.push(error);
    
    // Keep only the last maxErrors errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  /**
   * Track an API error
   */
  trackApiError(error: any, url?: string) {
    // Skip cancellation errors - these are expected when components unmount or requests are cancelled
    if (
      error?.name === 'CanceledError' ||
      error?.name === 'AbortError' ||
      error?.code === 'ERR_CANCELED' ||
      error?.message?.toLowerCase().includes('canceled') ||
      error?.message?.toLowerCase().includes('aborted')
    ) {
      return; // Don't track cancellation errors
    }

    const trackedError: TrackedError = {
      type: 'api',
      message: error?.message || error?.response?.data?.message || 'API request failed',
      statusCode: error?.response?.status,
      response: error?.response?.data,
      stack: error?.stack,
      timestamp: Date.now(),
      url: url || window.location.href,
    };

    this.trackError(trackedError);
  }

  /**
   * Get all tracked errors
   */
  getErrors(): TrackedError[] {
    return [...this.errors];
  }

  /**
   * Get recent errors (last N errors)
   */
  getRecentErrors(count: number = 10): TrackedError[] {
    return this.errors.slice(-count);
  }

  /**
   * Clear all tracked errors
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Get browser context information
   */
  getBrowserContext() {
    return {
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      url: window.location.href,
      timestamp: Date.now(),
    };
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

