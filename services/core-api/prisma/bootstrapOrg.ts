// bootstrapOrg.ts
// This script creates a baseline tenant (organisation, workspace, seed users, memberships)
// so that `prisma/seed.ts` can run without throwing.
// Run this ONCE on a fresh database:
//   cd services/core-api
//   npx ts-node prisma/bootstrapOrg.ts
// Then run:
//   npx prisma db seed

import { PrismaClient, MemberRole } from '@prisma/client';

const prisma = new PrismaClient();

// Baseline tenant data constants
const ORG_ID = 'cmhesnyvx00004xhjjxs272gs';
const ORG_SLUG = 'puzzel-cx';
const WORKSPACE_CX_ID = 'cmhesnyxl00024xhjlkpwnhzr'; // Customer Experience & AI
const WORKSPACE_REVOPS_ID = 'cmhesnyxo00044xhjhqw8ycib'; // Revenue Operations

const CYCLE_Q3_2025_ID = 'cmhesnyzo00104xhjwqnemyfe'; // Q3 2025 - ARCHIVED
const CYCLE_Q4_2025_ID = 'cmhesnyzr00124xhjtmx1ak82'; // Q4 2025 - ACTIVE
const CYCLE_Q1_2026_ID = 'cmhesnyzs00144xhjd8gqpyti'; // Q1 2026 - DRAFT

const USERS = [
  { id: 'cmhesnyxo00054xhjb6h2qm1v', email: 'founder@puzzelcx.local', displayName: 'Founder User' },
  { id: 'cmhesnyxt00064xhjwh8jy6g7', email: 'agent@puzzelcx.local', displayName: 'Agent User' },
];

/**
 * Ensures an organisation member exists with the specified role.
 * Uses findFirst + create pattern since id is auto-generated.
 */
async function ensureOrgMember(userId: string, role: MemberRole): Promise<void> {
  const existing = await prisma.organizationMember.findFirst({
    where: {
      organizationId: ORG_ID,
      userId: userId,
    },
  });

  if (existing) {
    // Update role if membership exists but role differs
    if (existing.role !== role) {
      await prisma.organizationMember.update({
        where: { id: existing.id },
        data: { role },
      });
      console.log(`  ✓ Updated organisation membership for user ${userId} to role ${role}`);
    } else {
      console.log(`  ✓ Organisation membership already exists for user ${userId} with role ${role}`);
    }
  } else {
    await prisma.organizationMember.create({
      data: {
        userId,
        organizationId: ORG_ID,
        role,
      },
    });
    console.log(`  ✓ Created organisation membership for user ${userId} with role ${role}`);
  }
}

/**
 * Ensures a workspace member exists with the specified role.
 * Uses findFirst + create pattern since id is auto-generated.
 */
async function ensureWorkspaceMember(workspaceId: string, userId: string, role: MemberRole): Promise<void> {
  const existing = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspaceId,
      userId: userId,
    },
  });

  if (existing) {
    // Update role if membership exists but role differs
    if (existing.role !== role) {
      await prisma.workspaceMember.update({
        where: { id: existing.id },
        data: { role },
      });
      console.log(`  ✓ Updated workspace membership for user ${userId} to role ${role}`);
    } else {
      console.log(`  ✓ Workspace membership already exists for user ${userId} with role ${role}`);
    }
  } else {
    await prisma.workspaceMember.create({
      data: {
        userId,
        workspaceId: workspaceId,
        role,
      },
    });
    console.log(`  ✓ Created workspace membership for user ${userId} with role ${role}`);
  }
}

async function main() {
  console.log('🌱 Bootstrapping baseline tenant data for Puzzel CX...\n');

  // Upsert Organisation
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {
      name: 'Puzzel CX',
      slug: ORG_SLUG,
    },
    create: {
      id: ORG_ID,
      name: 'Puzzel CX',
      slug: ORG_SLUG,
      allowTenantAdminExecVisibility: false,
    },
  });
  console.log(`✓ Ensured organisation: ${ORG_ID} (${ORG_SLUG})`);

  // Upsert Workspaces
  await prisma.workspace.upsert({
    where: { id: WORKSPACE_CX_ID },
    update: {
      name: 'Customer Experience & AI',
      organizationId: ORG_ID,
    },
    create: {
      id: WORKSPACE_CX_ID,
      name: 'Customer Experience & AI',
      organizationId: ORG_ID,
    },
  });
  console.log(`✓ Ensured workspace: ${WORKSPACE_CX_ID} (Customer Experience & AI)`);

  await prisma.workspace.upsert({
    where: { id: WORKSPACE_REVOPS_ID },
    update: {
      name: 'Revenue Operations',
      organizationId: ORG_ID,
    },
    create: {
      id: WORKSPACE_REVOPS_ID,
      name: 'Revenue Operations',
      organizationId: ORG_ID,
    },
  });
  console.log(`✓ Ensured workspace: ${WORKSPACE_REVOPS_ID} (Revenue Operations)`);

  // Upsert Cycles
  await prisma.cycle.upsert({
    where: { id: CYCLE_Q3_2025_ID },
    update: {
      name: 'Q3 2025',
      organizationId: ORG_ID,
      status: 'ARCHIVED',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-09-30'),
    },
    create: {
      id: CYCLE_Q3_2025_ID,
      name: 'Q3 2025',
      organizationId: ORG_ID,
      status: 'ARCHIVED',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-09-30'),
    },
  });
  console.log(`✓ Ensured cycle: ${CYCLE_Q3_2025_ID} (Q3 2025 - ARCHIVED)`);

  await prisma.cycle.upsert({
    where: { id: CYCLE_Q4_2025_ID },
    update: {
      name: 'Q4 2025',
      organizationId: ORG_ID,
      status: 'ACTIVE',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-12-31'),
    },
    create: {
      id: CYCLE_Q4_2025_ID,
      name: 'Q4 2025',
      organizationId: ORG_ID,
      status: 'ACTIVE',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-12-31'),
    },
  });
  console.log(`✓ Ensured cycle: ${CYCLE_Q4_2025_ID} (Q4 2025 - ACTIVE)`);

  await prisma.cycle.upsert({
    where: { id: CYCLE_Q1_2026_ID },
    update: {
      name: 'Q1 2026',
      organizationId: ORG_ID,
      status: 'DRAFT',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
    create: {
      id: CYCLE_Q1_2026_ID,
      name: 'Q1 2026',
      organizationId: ORG_ID,
      status: 'DRAFT',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
  });
  console.log(`✓ Ensured cycle: ${CYCLE_Q1_2026_ID} (Q1 2026 - DRAFT)`);

  // Upsert Users
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.displayName,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.displayName,
        passwordHash: 'DEV_PLACEHOLDER_HASH', // Placeholder for development only
        isSuperuser: false,
      },
    });
    console.log(`✓ Ensured user: ${user.id} (${user.email})`);
  }

  // Ensure Organisation Memberships
  console.log('\n📋 Ensuring organisation memberships...');
  await ensureOrgMember(USERS[0].id, 'ORG_ADMIN'); // Founder user
  await ensureOrgMember(USERS[1].id, 'MEMBER'); // Agent user

  // Ensure Workspace Memberships
  console.log('\n📋 Ensuring workspace memberships...');
  await ensureWorkspaceMember(WORKSPACE_CX_ID, USERS[0].id, 'WORKSPACE_OWNER'); // Founder user
  await ensureWorkspaceMember(WORKSPACE_CX_ID, USERS[1].id, 'MEMBER'); // Agent user

  console.log('\n✅ Bootstrap complete! Baseline tenant data is ready.');
  console.log('   You can now run: npx prisma db seed');
}

main()
  .catch((e) => {
    console.error('❌ Error bootstrapping database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

