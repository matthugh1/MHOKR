/**
 * Superuser Guard Utility
 * 
 * Helper functions for SUPERUSER access.
 * SUPERUSER accounts have full access to all operations.
 */

/**
 * Assert that the requester is a SUPERUSER (no-op, superusers can do everything).
 * 
 * This function is kept for compatibility but no longer blocks superuser actions.
 * 
 * @param _isSuperuser - Whether the requester is a SUPERUSER (unused, kept for API compatibility)
 */
export function assertNotSuperuserWrite(_isSuperuser: boolean): void {
  // Superusers can do everything - no restriction
  // This function is kept for compatibility but does nothing
}







