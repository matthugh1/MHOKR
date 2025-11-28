#!/usr/bin/env ts-node

/**
 * Compare Role Assignments Between Local and Azure Databases
 * 
 * This script compares user role assignments between two database environments
 * to help diagnose why Company OKRs might not display in Azure but do locally.
 * 
 * Usage:
 *   LOCAL_DATABASE_URL="postgresql://..." AZURE_DATABASE_URL="postgresql://..." ts-node scripts/db/compare-role-assignments.ts
 * 
 * Or set environment variables in your shell:
 *   export LOCAL_DATABASE_URL="postgresql://user:pass@localhost:5432/db"
 *   export AZURE_DATABASE_URL="postgresql://user:pass@azure-host:5432/db"
 *   ts-node scripts/db/compare-role-assignments.ts
 */

import { PrismaClient } from '@prisma/client';

interface RoleAssignment {
  userId: string;
  userEmail: string;
  userName: string;
  role: string;
  scopeType: string;
  scopeId: string;
  scopeName?: string;
  createdAt: Date;
}

interface UserSummary {
  userId: string;
  email: string;
  name: string;
  isSuperuser: boolean;
  primaryOrganizationId: string | null;
  primaryOrganizationName: string | null;
  roleAssignments: RoleAssignment[];
}

async function getRoleAssignments(prisma: PrismaClient, environment: string): Promise<UserSummary[]> {
  console.log(`\n📊 Fetching role assignments from ${environment}...`);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isSuperuser: true,
      primaryOrganizationId: true,
    },
    orderBy: {
      email: 'asc',
    },
  });

  console.log(`   Found ${users.length} users`);

  const userSummaries: UserSummary[] = [];

  for (const user of users) {
    const roleAssignments = await prisma.roleAssignment.findMany({
      where: { userId: user.id },
      orderBy: [
        { scopeType: 'asc' },
        { role: 'asc' },
      ],
    });

    // Get organization name if primaryOrganizationId exists
    let primaryOrganizationName: string | null = null;
    if (user.primaryOrganizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: user.primaryOrganizationId },
        select: { name: true },
      });
      primaryOrganizationName = org?.name || null;
    }

    // Enrich role assignments with scope names
    const enrichedAssignments: RoleAssignment[] = await Promise.all(
      roleAssignments
        .filter(ra => ra.scopeId !== null) // Filter out null scopeIds
        .map(async (ra) => {
          let scopeName: string | undefined;
          
          if (ra.scopeType === 'TENANT' && ra.scopeId) {
            const org = await prisma.organization.findUnique({
              where: { id: ra.scopeId },
              select: { name: true },
            });
            scopeName = org?.name || undefined;
          } else if (ra.scopeType === 'WORKSPACE' && ra.scopeId) {
            const workspace = await prisma.workspace.findUnique({
              where: { id: ra.scopeId },
              select: { name: true },
            });
            scopeName = workspace?.name || undefined;
          } else if (ra.scopeType === 'TEAM' && ra.scopeId) {
            const team = await prisma.team.findUnique({
              where: { id: ra.scopeId },
              select: { name: true },
            });
            scopeName = team?.name || undefined;
          }

          return {
            userId: ra.userId,
            userEmail: user.email,
            userName: user.name || '',
            role: ra.role,
            scopeType: ra.scopeType,
            scopeId: ra.scopeId!, // Non-null assertion since we filtered above
            scopeName,
            createdAt: ra.createdAt,
          };
        })
    );

    userSummaries.push({
      userId: user.id,
      email: user.email,
      name: user.name || '',
      isSuperuser: user.isSuperuser,
      primaryOrganizationId: user.primaryOrganizationId,
      primaryOrganizationName,
      roleAssignments: enrichedAssignments,
    });
  }

  return userSummaries;
}

function compareRoleAssignments(local: UserSummary[], azure: UserSummary[]): void {
  console.log('\n🔍 Comparing role assignments...\n');

  // Create maps by email for easier comparison
  const localByEmail = new Map<string, UserSummary>();
  const azureByEmail = new Map<string, UserSummary>();

  local.forEach(u => localByEmail.set(u.email, u));
  azure.forEach(u => azureByEmail.set(u.email, u));

  // Find users in both environments
  const allEmails = new Set([...localByEmail.keys(), ...azureByEmail.keys()]);
  
  const differences: Array<{
    email: string;
    issue: string;
    local?: any;
    azure?: any;
  }> = [];

  for (const email of allEmails) {
    const localUser = localByEmail.get(email);
    const azureUser = azureByEmail.get(email);

    if (!localUser && azureUser) {
      differences.push({
        email,
        issue: 'User exists in Azure but not in local',
        azure: { userId: azureUser.userId, name: azureUser.name },
      });
      continue;
    }

    if (localUser && !azureUser) {
      differences.push({
        email,
        issue: 'User exists in local but not in Azure',
        local: { userId: localUser.userId, name: localUser.name },
      });
      continue;
    }

    if (!localUser || !azureUser) continue;

    // Compare primary organization
    if (localUser.primaryOrganizationId !== azureUser.primaryOrganizationId) {
      differences.push({
        email,
        issue: 'Different primary organization',
        local: {
          orgId: localUser.primaryOrganizationId,
          orgName: localUser.primaryOrganizationName,
        },
        azure: {
          orgId: azureUser.primaryOrganizationId,
          orgName: azureUser.primaryOrganizationName,
        },
      });
    }

    // Compare superuser status
    if (localUser.isSuperuser !== azureUser.isSuperuser) {
      differences.push({
        email,
        issue: 'Different superuser status',
        local: { isSuperuser: localUser.isSuperuser },
        azure: { isSuperuser: azureUser.isSuperuser },
      });
    }

    // Compare role assignments
    const localRoles = new Set(
      localUser.roleAssignments.map(ra => `${ra.role}:${ra.scopeType}:${ra.scopeId}`)
    );
    const azureRoles = new Set(
      azureUser.roleAssignments.map(ra => `${ra.role}:${ra.scopeType}:${ra.scopeId}`)
    );

    // Find missing roles in Azure
    for (const roleKey of localRoles) {
      if (!azureRoles.has(roleKey)) {
        const ra = localUser.roleAssignments.find(
          r => `${r.role}:${r.scopeType}:${r.scopeId}` === roleKey
        );
        differences.push({
          email,
          issue: `Missing role in Azure: ${ra?.role} (${ra?.scopeType}: ${ra?.scopeName || ra?.scopeId})`,
          local: {
            role: ra?.role,
            scopeType: ra?.scopeType,
            scopeId: ra?.scopeId,
            scopeName: ra?.scopeName,
          },
        });
      }
    }

    // Find extra roles in Azure
    for (const roleKey of azureRoles) {
      if (!localRoles.has(roleKey)) {
        const ra = azureUser.roleAssignments.find(
          r => `${r.role}:${r.scopeType}:${r.scopeId}` === roleKey
        );
        differences.push({
          email,
          issue: `Extra role in Azure: ${ra?.role} (${ra?.scopeType}: ${ra?.scopeName || ra?.scopeId})`,
          azure: {
            role: ra?.role,
            scopeType: ra?.scopeType,
            scopeId: ra?.scopeId,
            scopeName: ra?.scopeName,
          },
        });
      }
    }
  }

  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 COMPARISON SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Local users: ${local.length}`);
  console.log(`   Azure users: ${azure.length}`);
  console.log(`   Total unique users: ${allEmails.size}`);
  console.log(`   Differences found: ${differences.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (differences.length === 0) {
    console.log('✅ No differences found! Role assignments match between environments.\n');
    return;
  }

  // Group differences by user
  const differencesByUser = new Map<string, typeof differences>();
  differences.forEach(diff => {
    if (!differencesByUser.has(diff.email)) {
      differencesByUser.set(diff.email, []);
    }
    differencesByUser.get(diff.email)!.push(diff);
  });

  // Print detailed differences
  console.log('⚠️  DIFFERENCES FOUND:\n');
  
  for (const [email, userDiffs] of differencesByUser.entries()) {
    console.log(`📧 ${email}`);
    userDiffs.forEach(diff => {
      console.log(`   ❌ ${diff.issue}`);
      if (diff.local) {
        console.log(`      Local:  ${JSON.stringify(diff.local, null, 2).split('\n').join('\n      ')}`);
      }
      if (diff.azure) {
        console.log(`      Azure: ${JSON.stringify(diff.azure, null, 2).split('\n').join('\n      ')}`);
      }
    });
    console.log('');
  }

  // Focus on tenant-level roles (most relevant for Company OKRs)
  console.log('\n🎯 TENANT-LEVEL ROLE ANALYSIS (Most relevant for Company OKRs):\n');
  
  const tenantRoleDiffs = differences.filter(
    d => d.local?.scopeType === 'TENANT' || d.azure?.scopeType === 'TENANT'
  );

  if (tenantRoleDiffs.length === 0) {
    console.log('   ✅ No tenant-level role differences found.');
  } else {
    console.log(`   ⚠️  Found ${tenantRoleDiffs.length} tenant-level role differences:\n`);
    tenantRoleDiffs.forEach(diff => {
      console.log(`   📧 ${diff.email}: ${diff.issue}`);
      if (diff.local?.role) {
        console.log(`      Missing in Azure: ${diff.local.role} in ${diff.local.scopeName || diff.local.scopeId}`);
      }
      if (diff.azure?.role) {
        console.log(`      Extra in Azure: ${diff.azure.role} in ${diff.azure.scopeName || diff.azure.scopeId}`);
      }
    });
  }
}

async function main() {
  const localDbUrl = process.env.LOCAL_DATABASE_URL;
  const azureDbUrl = process.env.AZURE_DATABASE_URL;

  if (!localDbUrl) {
    console.error('❌ Error: LOCAL_DATABASE_URL environment variable is required');
    console.error('   Example: LOCAL_DATABASE_URL="postgresql://user:pass@localhost:5432/db"');
    process.exit(1);
  }

  if (!azureDbUrl) {
    console.error('❌ Error: AZURE_DATABASE_URL environment variable is required');
    console.error('   Example: AZURE_DATABASE_URL="postgresql://user:pass@azure-host:5432/db"');
    process.exit(1);
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     ROLE ASSIGNMENT COMPARISON TOOL                      ║');
  console.log('║     Local vs Azure Database                              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Create Prisma clients for both databases
  const localPrisma = new PrismaClient({
    datasources: {
      db: {
        url: localDbUrl,
      },
    },
  });

  const azurePrisma = new PrismaClient({
    datasources: {
      db: {
        url: azureDbUrl,
      },
    },
  });

  try {
    // Fetch role assignments from both databases
    const localUsers = await getRoleAssignments(localPrisma, 'LOCAL');
    const azureUsers = await getRoleAssignments(azurePrisma, 'AZURE');

    // Compare and report differences
    compareRoleAssignments(localUsers, azureUsers);

    // Print detailed role assignments for users with tenant roles
    console.log('\n📋 DETAILED TENANT ROLE ASSIGNMENTS:\n');
    
    console.log('LOCAL Environment:');
    localUsers
      .filter(u => u.roleAssignments.some(ra => ra.scopeType === 'TENANT'))
      .forEach(user => {
        console.log(`\n   👤 ${user.email} (${user.name})`);
        console.log(`      Primary Org: ${user.primaryOrganizationName || user.primaryOrganizationId || 'None'}`);
        console.log(`      Superuser: ${user.isSuperuser}`);
        const tenantRoles = user.roleAssignments.filter(ra => ra.scopeType === 'TENANT');
        tenantRoles.forEach(ra => {
          console.log(`      - ${ra.role} in ${ra.scopeName || ra.scopeId}`);
        });
      });

    console.log('\n\nAZURE Environment:');
    azureUsers
      .filter(u => u.roleAssignments.some(ra => ra.scopeType === 'TENANT'))
      .forEach(user => {
        console.log(`\n   👤 ${user.email} (${user.name})`);
        console.log(`      Primary Org: ${user.primaryOrganizationName || user.primaryOrganizationId || 'None'}`);
        console.log(`      Superuser: ${user.isSuperuser}`);
        const tenantRoles = user.roleAssignments.filter(ra => ra.scopeType === 'TENANT');
        tenantRoles.forEach(ra => {
          console.log(`      - ${ra.role} in ${ra.scopeName || ra.scopeId}`);
        });
      });

  } catch (error: any) {
    console.error('\n❌ Error comparing databases:', error.message);
    if (error.message.includes('connect')) {
      console.error('\n💡 Tip: Check your DATABASE_URL connection strings are correct.');
      console.error('   Make sure you can connect to both databases from your machine.');
    }
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await azurePrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

