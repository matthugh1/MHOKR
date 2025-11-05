/**
 * User Factory
 * 
 * Generates deterministic user data for seeding.
 */

import { PrismaClient } from '@prisma/client';
import { generateUserId } from './ids';
import bcrypt from 'bcrypt';

export interface UserSeedData {
  email: string;
  name: string;
  role: string;
  scopeType: 'PLATFORM' | 'TENANT' | 'WORKSPACE' | 'TEAM';
  scopeId?: string;
  isSuperuser?: boolean;
  managerEmail?: string;
  rbacInspector?: boolean;
}

const DEFAULT_PASSWORD = 'changeme';

export async function createUser(
  prisma: PrismaClient,
  data: UserSeedData,
): Promise<string> {
  const userId = generateUserId(data.email);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  
  const settings = data.rbacInspector
    ? { debug: { rbacInspectorEnabled: true } }
    : {};

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  // Look up manager if managerEmail is provided
  let managerId: string | null = null;
  if (data.managerEmail) {
    const manager = await prisma.user.findUnique({
      where: { email: data.managerEmail },
    });
    if (manager) {
      managerId = manager.id;
    }
  }

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        isSuperuser: data.isSuperuser || false,
        settings: settings,
        managerId: managerId,
      },
    });
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      id: userId,
      email: data.email,
      name: data.name,
      passwordHash: passwordHash,
      isSuperuser: data.isSuperuser || false,
      settings: settings,
      managerId: managerId,
    },
  });

  return user.id;
}

export function generateEmail(
  role: string,
  index: number,
  workspaceSlug?: string,
  teamSlug?: string,
): string {
  const parts = [role];
  if (workspaceSlug) parts.push(workspaceSlug);
  if (teamSlug) parts.push(teamSlug);
  parts.push(index.toString());
  return `${parts.join('-')}@puzzelcx.local`;
}

export function generateUserName(
  role: string,
  index: number,
  workspaceName?: string,
  teamName?: string,
): string {
  const parts: string[] = [];
  if (teamName) parts.push(teamName);
  if (workspaceName) parts.push(workspaceName);
  parts.push(role);
  parts.push(index.toString());
  return parts.join(' ');
}

