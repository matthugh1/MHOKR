/**
 * Team Factory
 * 
 * Generates deterministic team data for seeding.
 */

import { PrismaClient } from '@prisma/client';
import { generateTeamId, slugify } from './ids';

export interface TeamSeedData {
  name: string;
  slug?: string;
}

export async function createTeam(
  prisma: PrismaClient,
  workspaceId: string,
  data: TeamSeedData,
): Promise<string> {
  const slug = data.slug || slugify(data.name);
  const teamId = generateTeamId(workspaceId, slug);

  const existing = await prisma.team.findFirst({
    where: {
      workspaceId: workspaceId,
      name: data.name,
    },
  });

  if (existing) {
    await prisma.team.update({
      where: { id: existing.id },
      data: {
        name: data.name,
      },
    });
    return existing.id;
  }

  const team = await prisma.team.create({
    data: {
      id: teamId,
      workspaceId: workspaceId,
      name: data.name,
    },
  });

  return team.id;
}

