/**
 * Audit Logging
 * 
 * Provides audit logging functionality for sensitive actions in the system.
 * All permission changes, impersonation events, and critical operations must be logged.
 */

import { AuditLog, Action, Role } from './types';

/**
 * Actions that MUST be audited
 */
export const AUDITABLE_ACTIONS: Set<string> = new Set([
  // Role management
  'GRANT_ROLE',
  'REVOKE_ROLE',
  'CHANGE_ROLE',
  
  // OKR operations
  'PUBLISH_OKR',
  'CHANGE_VISIBILITY_LEVEL',
  'DELETE_OKR',
  
  // User management
  'IMPERSONATE_USER',
  'STOP_IMPERSONATION',
  'INVITE_USER',
  'REMOVE_USER',
  'UPDATE_USER_ROLE',
  
  // Workspace/Team management
  'CREATE_WORKSPACE',
  'DELETE_WORKSPACE',
  'ARCHIVE_WORKSPACE',
  'CREATE_TEAM',
  'DELETE_TEAM',
  
  // Tenant management
  'UPDATE_TENANT_SETTINGS',
  'CHANGE_TENANT_BILLING',
  
  // Access control
  'ACCESS_DENIED',
  'ACCESS_GRANTED',
]);

/**
 * Record an audit event
 * 
 * This is a placeholder function. In production, this should:
 * 1. Store the audit log in the database
 * 2. Send to external audit/logging service (e.g., CloudWatch, Datadog)
 * 3. Ensure immutability (append-only, no modifications)
 * 4. Include request context (IP address, user agent, timestamp)
 * 
 * @param event - The audit log event to record
 */
export async function recordAuditEvent(event: AuditLog): Promise<void> {
  // TODO: Implement actual audit logging
  // This should write to the database and/or external logging service
  
  // For now, log to console (in production, this should be removed or sent to logging service)
  console.log('[AUDIT]', {
    id: event.id,
    actorUserId: event.actorUserId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    timestamp: event.timestamp.toISOString(),
    metadata: event.metadata,
    previousRole: event.previousRole,
    newRole: event.newRole,
    impersonatedUserId: event.impersonatedUserId,
  });
  
  // Example implementation:
  // await prisma.auditLog.create({ data: event });
  // await sendToExternalLoggingService(event);
}

/**
 * Create an audit log entry for a role change
 */
export function createRoleChangeAuditLog(
  actorUserId: string,
  targetUserId: string,
  targetType: 'TENANT' | 'WORKSPACE' | 'TEAM',
  targetId: string,
  previousRole: Role | null,
  newRole: Role | null,
  metadata?: Record<string, any>,
): AuditLog {
  return {
    id: generateAuditLogId(),
    actorUserId,
    action: previousRole === null ? 'GRANT_ROLE' : newRole === null ? 'REVOKE_ROLE' : 'CHANGE_ROLE',
    targetType: 'ROLE_ASSIGNMENT',
    targetId: `${targetUserId}:${targetType}:${targetId}`,
    timestamp: new Date(),
    previousRole: previousRole || undefined,
    newRole: newRole || undefined,
    metadata: {
      targetUserId,
      targetType,
      targetId,
      ...metadata,
    },
  };
}

/**
 * Create an audit log entry for impersonation
 */
export function createImpersonationAuditLog(
  actorUserId: string,
  impersonatedUserId: string,
  action: 'IMPERSONATE_USER' | 'STOP_IMPERSONATION',
  metadata?: Record<string, any>,
): AuditLog {
  return {
    id: generateAuditLogId(),
    actorUserId,
    action,
    targetType: 'USER',
    targetId: impersonatedUserId,
    timestamp: new Date(),
    impersonatedUserId,
    metadata: {
      ...metadata,
    },
  };
}

/**
 * Create an audit log entry for OKR visibility change
 */
export function createVisibilityChangeAuditLog(
  actorUserId: string,
  okrId: string,
  previousVisibility: string,
  newVisibility: string,
  metadata?: Record<string, any>,
): AuditLog {
  return {
    id: generateAuditLogId(),
    actorUserId,
    action: 'CHANGE_VISIBILITY_LEVEL',
    targetType: 'OKR',
    targetId: okrId,
    timestamp: new Date(),
    metadata: {
      previousVisibility,
      newVisibility,
      ...metadata,
    },
  };
}

/**
 * Create an audit log entry for OKR publish
 */
export function createPublishOKRAuditLog(
  actorUserId: string,
  okrId: string,
  metadata?: Record<string, any>,
): AuditLog {
  return {
    id: generateAuditLogId(),
    actorUserId,
    action: 'PUBLISH_OKR',
    targetType: 'OKR',
    targetId: okrId,
    timestamp: new Date(),
    metadata: {
      ...metadata,
    },
  };
}

/**
 * Create an audit log entry for access denied
 */
export function createAccessDeniedAuditLog(
  actorUserId: string,
  action: Action | string,
  targetType: string,
  targetId: string,
  reason: string,
  metadata?: Record<string, any>,
): AuditLog {
  return {
    id: generateAuditLogId(),
    actorUserId,
    action: 'ACCESS_DENIED',
    targetType: targetType as any,
    targetId,
    timestamp: new Date(),
    metadata: {
      attemptedAction: action,
      reason,
      ...metadata,
    },
  };
}

/**
 * Generate a unique audit log ID
 * In production, this should use a proper ID generator (UUID, Snowflake ID, etc.)
 */
function generateAuditLogId(): string {
  // Simple ID generation - in production, use a proper UUID library
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an action should be audited
 */
export function shouldAuditAction(action: string): boolean {
  return AUDITABLE_ACTIONS.has(action);
}

/**
 * Helper to ensure all required audit fields are present
 */
export function validateAuditLog(event: Partial<AuditLog>): event is AuditLog {
  return !!(
    event.id &&
    event.actorUserId &&
    event.action &&
    event.targetType &&
    event.targetId &&
    event.timestamp
  );
}


