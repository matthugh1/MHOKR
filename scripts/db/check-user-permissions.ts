#!/usr/bin/env ts-node

/**
 * Check User Permissions for Company OKRs
 * 
 * Checks if a specific user has the required permissions to see Company OKRs.
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const azureDbUrl = process.env.AZURE_DATABASE_URL || process.env.DATABASE_URL;
  const userEmail = process.env.USER_EMAIL || process.argv[2];

  if (!azureDbUrl) {
    console.error('❌ Error: AZURE_DATABASE_URL or DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!userEmail) {
    console.error('❌ Error: USER_EMAIL environment variable or email argument is required');
    console.error('Usage: USER_EMAIL="user@example.com" npx ts-node scripts/db/check-user-permissions.ts');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: azureDbUrl } },
  });

  try {
    console.log(`🔍 Checking permissions for: ${userEmail}\n`);

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
        primaryOrganizationId: true,
      },
    });

    if (!user) {
      console.error(`❌ User ${userEmail} not found`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.name || user.email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Superuser: ${user.isSuperuser}`);
    console.log(`   Primary Org ID: ${user.primaryOrganizationId || 'None'}\n`);

    if (!user.primaryOrganizationId) {
      console.log('❌ User has no primary organization - cannot see Company OKRs');
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.primaryOrganizationId },
      select: { id: true, name: true },
    });

    console.log(`📋 Organization: ${org?.name || user.primaryOrganizationId}\n`);

    // Check tenant roles
    const tenantRoles = await prisma.roleAssignment.findMany({
      where: {
        userId: user.id,
        scopeType: 'TENANT',
        scopeId: user.primaryOrganizationId,
      },
      select: {
        role: true,
      },
    });

    console.log(`🔐 TENANT ROLES:`);
    if (tenantRoles.length === 0 && !user.isSuperuser) {
      console.log(`   ❌ NO TENANT ROLES - User cannot see Company OKRs!`);
      console.log(`   → User needs TENANT_VIEWER, TENANT_ADMIN, or TENANT_OWNER role`);
    } else if (user.isSuperuser) {
      console.log(`   ✅ SUPERUSER - Can see all OKRs`);
    } else {
      console.log(`   ✅ Roles: ${tenantRoles.map(r => r.role).join(', ')}`);
    }

    // Check Annual 2025 cycle
    const annual2025 = await prisma.cycle.findFirst({
      where: {
        tenantId: user.primaryOrganizationId,
        name: 'Annual 2025',
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    console.log(`\n📅 ANNUAL 2025 CYCLE:`);
    if (!annual2025) {
      console.log(`   ❌ Not found`);
    } else {
      console.log(`   ✅ Found: ${annual2025.name} (${annual2025.status})`);
      
      // Check objectives
      const objectives = await prisma.objective.count({
        where: {
          tenantId: user.primaryOrganizationId,
          cycleId: annual2025.id,
          parentId: null,
        },
      });

      console.log(`   📊 Root objectives: ${objectives}`);
      
      if (objectives === 0) {
        console.log(`   ⚠️  No objectives found in this cycle`);
      }
    }

    // Summary
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`📊 SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════\n`);

    const canSeeCompanyOKRs = user.isSuperuser || tenantRoles.length > 0;
    
    if (!canSeeCompanyOKRs) {
      console.log(`❌ USER CANNOT SEE COMPANY OKRs`);
      console.log(`\n   Reason: No tenant-level roles assigned`);
      console.log(`   Fix: Grant TENANT_VIEWER, TENANT_ADMIN, or TENANT_OWNER role`);
      console.log(`\n   Run this to fix:`);
      console.log(`   npx ts-node scripts/admin/grant-default-viewer-roles.ts`);
    } else if (!annual2025) {
      console.log(`❌ ANNUAL 2025 CYCLE NOT FOUND`);
      console.log(`   → Create the cycle or check the name`);
    } else {
      console.log(`✅ User should be able to see Company OKRs`);
      console.log(`   → If data still doesn't display, check:`);
      console.log(`   1. Browser console for errors`);
      console.log(`   2. Network tab for API responses`);
      console.log(`   3. Backend logs for visibility check failures`);
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



