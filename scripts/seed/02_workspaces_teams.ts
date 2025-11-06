#!/usr/bin/env ts-node

/**
 * Workspaces and Teams
 * 
 * Creates 6 workspaces and ~20 teams (3-4 per workspace).
 */

import { PrismaClient } from '@prisma/client';
import { generateWorkspaceId, slugify } from '../../services/core-api/prisma/factories/ids';
import { createTeam } from '../../services/core-api/prisma/factories/teams';

const prisma = new PrismaClient();

interface WorkspaceConfig {
  name: string;
  teams: string[];
}

const WORKSPACES: WorkspaceConfig[] = [
  {
    name: 'Sales',
    teams: ['Enterprise Sales', 'SMB Sales', 'Account Management'],
  },
  {
    name: 'Support',
    teams: ['Tier 1 Support', 'Tier 2 Support', 'Technical Support', 'Customer Success'],
  },
  {
    name: 'Marketing',
    teams: ['Content Marketing', 'Demand Generation', 'Product Marketing'],
  },
  {
    name: 'Product',
    teams: ['Product Management', 'User Research', 'Design'],
  },
  {
    name: 'Engineering',
    teams: ['Backend Engineering', 'Frontend Engineering', 'DevOps', 'Platform Engineering'],
  },
  {
    name: 'People',
    teams: ['HR Operations', 'Talent Acquisition', 'Learning & Development'],
  },
];

async function createWorkspacesAndTeams(orgId: string): Promise<{
  workspaceIds: Map<string, string>;
  teamIds: Map<string, string>;
}> {
  console.log('🏢 Creating workspaces and teams...');

  const workspaceIds = new Map<string, string>();
  const teamIds = new Map<string, string>();

  for (const workspace of WORKSPACES) {
    const slug = slugify(workspace.name);
    const workspaceId = generateWorkspaceId(orgId, slug);

    const existing = await prisma.workspace.findFirst({
      where: {
        organizationId: orgId,
        name: workspace.name,
      },
    });

    if (existing) {
      workspaceIds.set(workspace.name, existing.id);
      console.log(`✅ Workspace already exists: ${workspace.name} (${existing.id})`);
    } else {
      const created = await prisma.workspace.create({
        data: {
          id: workspaceId,
          organizationId: orgId,
          name: workspace.name,
        },
      });
      workspaceIds.set(workspace.name, created.id);
      console.log(`✅ Created workspace: ${workspace.name} (${created.id})`);
    }

    for (const teamName of workspace.teams) {
      const teamId = await createTeam(prisma, workspaceIds.get(workspace.name)!, {
        name: teamName,
      });
      teamIds.set(`${workspace.name}:${teamName}`, teamId);
      console.log(`  ✅ Created team: ${teamName} (${teamId})`);
    }
  }

  console.log(`✅ Created ${workspaceIds.size} workspaces and ${teamIds.size} teams`);
  return { workspaceIds, teamIds };
}

if (require.main === module) {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error('❌ Usage: ts-node 02_workspaces_teams.ts <orgId>');
    process.exit(1);
  }

  createWorkspacesAndTeams(orgId)
    .then(() => {
      console.log('✅ Workspaces and teams creation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { createWorkspacesAndTeams, WORKSPACES };

