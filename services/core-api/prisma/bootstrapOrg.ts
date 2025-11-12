// bootstrapOrg.ts
// This script creates a baseline tenant (organisation, workspace, seed users, memberships)
// so that `prisma/seed.ts` can run without throwing.
// Run this ONCE on a fresh database:
//   cd services/core-api
//   npx ts-node prisma/bootstrapOrg.ts
// Then run:
//   npx prisma db seed

import { PrismaClient, MemberRole, RBACRole, ScopeType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
 * Maps legacy MemberRole to RBAC Role for tenant scope
 */
function mapLegacyOrgRoleToRBAC(legacyRole: MemberRole): RBACRole {
  switch (legacyRole) {
    case 'ORG_ADMIN':
      return 'TENANT_ADMIN';
    case 'VIEWER':
      return 'TENANT_VIEWER';
    case 'MEMBER':
    default:
      return 'TENANT_VIEWER'; // Default to VIEWER for MEMBER
  }
}

/**
 * Ensures an organisation member exists with the specified role.
 * Uses RBAC system (Phase 4: RBAC only)
 */
async function ensureOrgMember(userId: string, role: MemberRole): Promise<void> {
  const rbacRole = mapLegacyOrgRoleToRBAC(role);
  
  const existing = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      scopeType: 'TENANT' as ScopeType,
      scopeId: ORG_ID,
    },
  });

  if (existing) {
    // Update role if membership exists but role differs
    if (existing.role !== rbacRole) {
      await prisma.roleAssignment.update({
        where: { id: existing.id },
        data: { role: rbacRole },
      });
      console.log(`  ✓ Updated organisation membership for user ${userId} to role ${rbacRole} (${role})`);
    } else {
      console.log(`  ✓ Organisation membership already exists for user ${userId} with role ${rbacRole} (${role})`);
    }
  } else {
    await prisma.roleAssignment.create({
      data: {
        userId,
        role: rbacRole,
        scopeType: 'TENANT' as ScopeType,
        scopeId: ORG_ID,
      },
    });
    console.log(`  ✓ Created organisation membership for user ${userId} with role ${rbacRole} (${role})`);
  }
}

/**
 * Maps legacy MemberRole to RBAC Role for workspace scope
 */
function mapLegacyWorkspaceRoleToRBAC(legacyRole: MemberRole): RBACRole {
  switch (legacyRole) {
    case 'WORKSPACE_OWNER':
      return 'WORKSPACE_LEAD';
    case 'MEMBER':
      return 'WORKSPACE_MEMBER';
    case 'VIEWER':
    default:
      return 'WORKSPACE_MEMBER'; // VIEWER becomes MEMBER in RBAC
  }
}

/**
 * Ensures a workspace member exists with the specified role.
 * Uses RBAC system (Phase 4: RBAC only)
 */
async function ensureWorkspaceMember(workspaceId: string, userId: string, role: MemberRole): Promise<void> {
  const rbacRole = mapLegacyWorkspaceRoleToRBAC(role);
  
  const existing = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      scopeType: 'WORKSPACE' as ScopeType,
      scopeId: workspaceId,
    },
  });

  if (existing) {
    // Update role if membership exists but role differs
    if (existing.role !== rbacRole) {
      await prisma.roleAssignment.update({
        where: { id: existing.id },
        data: { role: rbacRole },
      });
      console.log(`  ✓ Updated workspace membership for user ${userId} to role ${rbacRole} (${role})`);
    } else {
      console.log(`  ✓ Workspace membership already exists for user ${userId} with role ${rbacRole} (${role})`);
    }
  } else {
    await prisma.roleAssignment.create({
      data: {
        userId,
        role: rbacRole,
        scopeType: 'WORKSPACE' as ScopeType,
        scopeId: workspaceId,
      },
    });
    console.log(`  ✓ Created workspace membership for user ${userId} with role ${rbacRole} (${role})`);
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
  // Default password for all seeded users: 'test123'
  const defaultPassword = 'test123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.displayName,
        passwordHash: hashedPassword, // Set proper password hash
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.displayName,
        passwordHash: hashedPassword, // Set proper password hash
        isSuperuser: false,
      },
    });
    console.log(`✓ Ensured user: ${user.id} (${user.email}) - password: ${defaultPassword}`);
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

