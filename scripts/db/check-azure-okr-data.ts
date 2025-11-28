#!/usr/bin/env ts-node

/**
 * Check Azure OKR Data
 * 
 * Investigates why Company OKRs for Annual 2025 don't display in Azure.
 * Checks cycles, objectives, and user permissions.
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const azureDbUrl = process.env.AZURE_DATABASE_URL || process.env.DATABASE_URL;

  if (!azureDbUrl) {
    console.error('❌ Error: AZURE_DATABASE_URL or DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: azureDbUrl } },
  });

  try {
    console.log('🔍 Checking Azure database for OKR data...\n');

    // 1. Check organizations
    console.log('1️⃣  ORGANIZATIONS:');
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
    });
    console.log(`   Found ${orgs.length} organizations:`);
    orgs.forEach(org => {
      console.log(`   - ${org.name} (${org.id})`);
    });

    if (orgs.length === 0) {
      console.log('   ⚠️  No organizations found!');
      return;
    }

    const puzzelOrg = orgs.find(o => o.name === 'Puzzel');
    if (!puzzelOrg) {
      console.log('   ⚠️  Puzzel organization not found!');
      return;
    }

    console.log(`\n   ✅ Using Puzzel organization: ${puzzelOrg.id}\n`);

    // 2. Check cycles, especially Annual 2025
    console.log('2️⃣  CYCLES:');
    const cycles = await prisma.cycle.findMany({
      where: { tenantId: puzzelOrg.id },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { name: 'asc' },
    });
    console.log(`   Found ${cycles.length} cycles:`);
    cycles.forEach(cycle => {
      console.log(`   - ${cycle.name} (${cycle.status}) - ID: ${cycle.id}`);
    });

    const annual2025 = cycles.find(c => c.name === 'Annual 2025' || c.name.includes('Annual 2025'));
    if (!annual2025) {
      console.log('\n   ⚠️  Annual 2025 cycle not found!');
      console.log('   This could be why Company OKRs don\'t display.');
    } else {
      console.log(`\n   ✅ Found Annual 2025 cycle: ${annual2025.name} (ID: ${annual2025.id})`);
    }

    // 3. Check objectives in Annual 2025 cycle
    console.log('\n3️⃣  OBJECTIVES:');
    let annual2025Objectives: any[] = [];
    if (annual2025) {
      annual2025Objectives = await prisma.objective.findMany({
        where: {
          tenantId: puzzelOrg.id,
          cycleId: annual2025.id,
          parentId: null, // Root objectives only
        },
        select: {
          id: true,
          title: true,
          status: true,
          visibilityLevel: true,
          ownerId: true,
          owner: {
            select: { email: true, name: true },
          },
        },
      });
      console.log(`   Found ${annual2025Objectives.length} root objectives in ${annual2025.name}:`);
      if (annual2025Objectives.length === 0) {
        console.log('   ⚠️  No objectives found! This is why nothing displays.');
      } else {
        annual2025Objectives.slice(0, 10).forEach(obj => {
          console.log(`   - ${obj.title} (${obj.status}, ${obj.visibilityLevel}) - Owner: ${obj.owner?.email || 'Unassigned'}`);
        });
        if (annual2025Objectives.length > 10) {
          console.log(`   ... and ${annual2025Objectives.length - 10} more`);
        }
      }
    } else {
      console.log('   ⏭️  Skipping (no Annual 2025 cycle found)');
    }

    // 4. Check all objectives (any cycle)
    const allObjectives = await prisma.objective.findMany({
      where: {
        tenantId: puzzelOrg.id,
        parentId: null,
      },
      select: {
        id: true,
        title: true,
        cycleId: true,
        cycle: {
          select: { name: true },
        },
      },
    });
    console.log(`\n   Total root objectives in Puzzel org: ${allObjectives.length}`);

    // 5. Check user role assignments
    console.log('\n4️⃣  USER ROLE ASSIGNMENTS:');
    const usersWithRoles = await prisma.user.findMany({
      where: {
        primaryOrganizationId: puzzelOrg.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
        primaryOrganizationId: true,
        roleAssignments: {
          where: {
            scopeType: 'TENANT',
            scopeId: puzzelOrg.id,
          },
          select: {
            role: true,
          },
        },
      },
      take: 10,
    });

    console.log(`   Sample of ${usersWithRoles.length} users with tenant roles:`);
    usersWithRoles.forEach(user => {
      const roles = user.roleAssignments.map(ra => ra.role).join(', ');
      console.log(`   - ${user.email}: ${roles || 'NO TENANT ROLES'} ${user.isSuperuser ? '(SUPERUSER)' : ''}`);
    });

    const usersWithoutTenantRoles = await prisma.user.count({
      where: {
        primaryOrganizationId: puzzelOrg.id,
        isSuperuser: false,
        roleAssignments: {
          none: {
            scopeType: 'TENANT',
            scopeId: puzzelOrg.id,
          },
        },
      },
    });
    console.log(`\n   ⚠️  ${usersWithoutTenantRoles} users without tenant roles (may not see Company OKRs)`);

    // 6. Check visibility levels
    console.log('\n5️⃣  VISIBILITY LEVELS:');
    if (annual2025) {
      const visibilityBreakdown = await prisma.objective.groupBy({
        by: ['visibilityLevel'],
        where: {
          tenantId: puzzelOrg.id,
          cycleId: annual2025.id,
        },
        _count: true,
      });
      console.log(`   Objectives in ${annual2025.name} by visibility level:`);
      visibilityBreakdown.forEach(item => {
        console.log(`   - ${item.visibilityLevel}: ${item._count}`);
      });
      
      // Also check root vs child objectives
      const rootCount = await prisma.objective.count({
        where: {
          tenantId: puzzelOrg.id,
          cycleId: annual2025.id,
          parentId: null,
        },
      });
      const totalCount = await prisma.objective.count({
        where: {
          tenantId: puzzelOrg.id,
          cycleId: annual2025.id,
        },
      });
      console.log(`\n   Root objectives: ${rootCount}`);
      console.log(`   Total objectives (including children): ${totalCount}`);
    }

    // 7. Summary and recommendations
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY & RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!annual2025) {
      console.log('❌ ISSUE: Annual 2025 cycle not found');
      console.log('   → Create the cycle or check if it has a different name\n');
    } else if (annual2025 && annual2025Objectives.length === 0) {
      console.log('❌ ISSUE: No objectives found in Annual 2025 cycle');
      console.log('   → Check if objectives exist but are assigned to a different cycle');
      console.log('   → Check if objectives have parentId set (should be null for root objectives)\n');
    } else {
      console.log('✅ Data appears to exist');
      console.log('   → Issue may be with visibility filtering or user permissions');
      console.log('   → Check browser console and network requests for errors\n');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

