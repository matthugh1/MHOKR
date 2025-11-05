#!/usr/bin/env ts-node

/**
 * Users and Roles
 * 
 * Creates ~200 users with realistic role distributions and org chart.
 */

import { PrismaClient } from '@prisma/client';
import { createUser } from '../../services/core-api/prisma/factories/users';
import { WORKSPACES } from './02_workspaces_teams';

const prisma = new PrismaClient();

async function createUsersAndRoles(
  orgId: string,
  workspaceIds: Map<string, string>,
  teamIds: Map<string, string>,
): Promise<Map<string, string>> {
  console.log('👥 Creating users and roles...');

  const userIds = new Map<string, string>();
  const userEmails: string[] = [];

  const founderEmail = 'founder@puzzelcx.local';
  const founderId = await createUser(prisma, {
    email: founderEmail,
    name: 'Founder',
    role: 'TENANT_OWNER',
    scopeType: 'TENANT',
    scopeId: orgId,
    rbacInspector: true,
  });
  userIds.set(founderEmail, founderId);
  userEmails.push(founderEmail);

  const adminEmails: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const email = `admin${i}@puzzelcx.local`;
    const userId = await createUser(prisma, {
      email: email,
      name: `Admin ${i}`,
      role: 'TENANT_ADMIN',
      scopeType: 'TENANT',
      scopeId: orgId,
      managerEmail: founderEmail,
      rbacInspector: i <= 2,
    });
    userIds.set(email, userId);
    userEmails.push(email);
    adminEmails.push(email);

    await prisma.roleAssignment.upsert({
      where: {
        userId_role_scopeType_scopeId: {
          userId: userId,
          role: 'TENANT_ADMIN',
          scopeType: 'TENANT',
          scopeId: orgId,
        },
      },
      update: {},
      create: {
        userId: userId,
        role: 'TENANT_ADMIN',
        scopeType: 'TENANT',
        scopeId: orgId,
      },
    });
  }

  for (const workspace of WORKSPACES) {
    const workspaceId = workspaceIds.get(workspace.name)!;
    const workspaceSlug = workspace.name.toLowerCase();

    for (let i = 0; i < 4; i++) {
      const email = `workspace-lead-${workspaceSlug}-${i + 1}@puzzelcx.local`;
      const userId = await createUser(prisma, {
        email: email,
        name: `${workspace.name} Lead ${i + 1}`,
        role: 'WORKSPACE_LEAD',
        scopeType: 'WORKSPACE',
        scopeId: workspaceId,
        managerEmail: i === 0 ? adminEmails[0] : founderEmail,
      });
      userIds.set(email, userId);
      userEmails.push(email);

      await prisma.roleAssignment.upsert({
        where: {
          userId_role_scopeType_scopeId: {
            userId: userId,
            role: 'WORKSPACE_LEAD',
            scopeType: 'WORKSPACE',
            scopeId: workspaceId,
          },
        },
        update: {},
        create: {
          userId: userId,
          role: 'WORKSPACE_LEAD',
          scopeType: 'WORKSPACE',
          scopeId: workspaceId,
        },
      });
    }

    for (const teamName of workspace.teams) {
      const teamId = teamIds.get(`${workspace.name}:${teamName}`)!;
      const teamSlug = teamName.toLowerCase().replace(/\s+/g, '-');

      const leadEmail = `team-lead-${teamSlug}@puzzelcx.local`;
      const leadId = await createUser(prisma, {
        email: leadEmail,
        name: `${teamName} Lead`,
        role: 'TEAM_LEAD',
        scopeType: 'TEAM',
        scopeId: teamId,
        managerEmail: userEmails[userEmails.length - 1],
      });
      userIds.set(leadEmail, leadId);
      userEmails.push(leadEmail);

      await prisma.roleAssignment.upsert({
        where: {
          userId_role_scopeType_scopeId: {
            userId: leadId,
            role: 'TEAM_LEAD',
            scopeType: 'TEAM',
            scopeId: teamId,
          },
        },
        update: {},
        create: {
          userId: leadId,
          role: 'TEAM_LEAD',
          scopeType: 'TEAM',
          scopeId: teamId,
        },
      });

      const membersPerTeam = 8;
      for (let j = 1; j <= membersPerTeam; j++) {
        const email = `member-${teamSlug}-${j}@puzzelcx.local`;
        const userId = await createUser(prisma, {
          email: email,
          name: `${teamName} Member ${j}`,
          role: 'TEAM_CONTRIBUTOR',
          scopeType: 'TEAM',
          scopeId: teamId,
          managerEmail: leadEmail,
        });
        userIds.set(email, userId);
        userEmails.push(email);

        await prisma.roleAssignment.upsert({
          where: {
            userId_role_scopeType_scopeId: {
              userId: userId,
              role: 'TEAM_CONTRIBUTOR',
              scopeType: 'TEAM',
              scopeId: teamId,
            },
          },
          update: {},
          create: {
            userId: userId,
            role: 'TEAM_CONTRIBUTOR',
            scopeType: 'TEAM',
            scopeId: teamId,
          },
        });
      }
    }
  }

  const totalUsers = userIds.size;
  console.log(`✅ Created ${totalUsers} users with role assignments`);

  return userIds;
}

if (require.main === module) {
  console.error('❌ This script should be run via the orchestrator');
  process.exit(1);
}

export { createUsersAndRoles };

