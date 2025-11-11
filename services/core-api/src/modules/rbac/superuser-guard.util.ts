/**
 * Superuser Guard Utility
 * 
 * Helper functions for enforcing SUPERUSER read-only rules.
 * SUPERUSER accounts are platform-level auditors and cannot mutate tenant data.
 */

import { ForbiddenException } from '@nestjs/common';

/**
 * Assert that the requester is not a SUPERUSER attempting to mutate tenant data.
 * 
 * SUPERUSER accounts are read-only and cannot modify any tenant resources.
 * 
 * @param isSuperuser - Whether the requester is a SUPERUSER
 * @throws ForbiddenException if the requester is a SUPERUSER
 */
export function assertNotSuperuserWrite(isSuperuser: boolean): void {
  if (isSuperuser) {
    throw new ForbiddenException('SUPERUSER is read-only and cannot mutate tenant data');
  }
}





