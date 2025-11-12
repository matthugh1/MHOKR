/**
 * ID Generation Utilities
 * 
 * Deterministic UUIDv5 generation from natural keys for idempotent seeding.
 */

import { v5 as uuidv5 } from 'uuid';

// UUIDv5 namespaces for each entity type
const NAMESPACES = {
  organisation: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  workspace: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  team: '6ba7b813-9dad-11d1-80b4-00c04fd430c8',
  user: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
  cycle: '6ba7b815-9dad-11d1-80b4-00c04fd430c8',
  objective: '6ba7b816-9dad-11d1-80b4-00c04fd430c8',
  keyResult: '6ba7b817-9dad-11d1-80b4-00c04fd430c8',
  initiative: '6ba7b818-9dad-11d1-80b4-00c04fd430c8',
  strategicPillar: '6ba7b819-9dad-11d1-80b4-00c04fd430c8',
  roleAssignment: '6ba7b81a-9dad-11d1-80b4-00c04fd430c8',
} as const;

export function generateOrgId(slug: string): string {
  return uuidv5(slug, NAMESPACES.organisation);
}

export function generateWorkspaceId(orgId: string, slug: string): string {
  return uuidv5(`${orgId}:${slug}`, NAMESPACES.workspace);
}

export function generateTeamId(workspaceId: string, slug: string): string {
  return uuidv5(`${workspaceId}:${slug}`, NAMESPACES.team);
}

export function generateUserId(email: string): string {
  return uuidv5(email, NAMESPACES.user);
}

export function generateCycleId(orgId: string, name: string): string {
  return uuidv5(`${orgId}:${name}`, NAMESPACES.cycle);
}

export function generateObjectiveId(
  orgId: string,
  scopeType: 'tenant' | 'workspace' | 'team',
  scopeId: string | null,
  cycleId: string,
  title: string,
): string {
  const key = `${orgId}:${scopeType}:${scopeId || ''}:${cycleId}:${title}`;
  return uuidv5(key, NAMESPACES.objective);
}

export function generateKeyResultId(objectiveId: string, title: string): string {
  return uuidv5(`${objectiveId}:${title}`, NAMESPACES.keyResult);
}

export function generateInitiativeId(objectiveId: string, title: string): string {
  return uuidv5(`${objectiveId}:${title}`, NAMESPACES.initiative);
}

export function generateStrategicPillarId(orgId: string, name: string): string {
  return uuidv5(`${orgId}:${name}`, NAMESPACES.strategicPillar);
}

export function generateRoleAssignmentId(
  userId: string,
  role: string,
  scopeType: string,
  scopeId: string | null,
): string {
  const key = `${userId}:${role}:${scopeType}:${scopeId || ''}`;
  return uuidv5(key, NAMESPACES.roleAssignment);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

