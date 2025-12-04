#!/usr/bin/env ts-node

/**
 * Test API Call - Simulate Frontend Request
 * 
 * Simulates the exact API call the hierarchy page makes to diagnose the issue.
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const azureDbUrl = process.env.AZURE_DATABASE_URL || process.env.DATABASE_URL;

  if (!azureDbUrl) {
    console.error('❌ Error: AZURE_DATABASE_URL or DATABASE_URL required');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: azureDbUrl } },
  });

  try {
    // Get Frederic's user and org
    const user = await prisma.user.findUnique({
      where: { email: 'frederic.laziou@puzzel.com' },
      select: {
        id: true,
        email: true,
        primaryOrganizationId: true,
      },
    });

    if (!user || !user.primaryOrganizationId) {
      console.error('❌ User or organization not found');
      return;
    }

    const orgId = user.primaryOrganizationId;
    console.log(`👤 User: ${user.email}`);
    console.log(`🏢 Organization ID: ${orgId}\n`);

    // Get Annual 2025 cycle
    const cycle = await prisma.cycle.findFirst({
      where: {
        tenantId: orgId,
        name: 'Annual 2025',
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!cycle) {
      console.error('❌ Annual 2025 cycle not found');
      return;
    }

    console.log(`📅 Cycle: ${cycle.name} (ID: ${cycle.id})\n`);

    // Simulate the backend query with scope=tenant
    console.log('🔍 Simulating backend query with scope=tenant...\n');

    // Step 1: Build where clause (as backend does)
    const where: any = {
      tenantId: orgId,
      parentId: null, // Root objectives only
      cycleId: cycle.id,
    };

    // Step 2: Fetch objectives (before visibility filtering)
    const allObjectives = await prisma.objective.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        visibilityLevel: true,
        ownerId: true,
        tenantId: true,
        cycleId: true,
      },
    });

    console.log(`📊 Found ${allObjectives.length} objectives before visibility filtering:`);
    allObjectives.slice(0, 5).forEach(obj => {
      console.log(`   - ${obj.title} (${obj.visibilityLevel})`);
    });
    if (allObjectives.length > 5) {
      console.log(`   ... and ${allObjectives.length - 5} more`);
    }

    // Step 3: Check visibility (simplified - backend does more complex checks)
    console.log(`\n🔐 Checking visibility...`);
    
    // Get user's tenant roles
    const tenantRoles = await prisma.roleAssignment.findMany({
      where: {
        userId: user.id,
        scopeType: 'TENANT',
        scopeId: orgId,
      },
      select: {
        role: true,
      },
    });

    console.log(`   User roles: ${tenantRoles.map(r => r.role).join(', ') || 'NONE'}`);

    // Check which objectives would pass visibility
    const visibleObjectives = allObjectives.filter(obj => {
      // PUBLIC_TENANT should be visible to anyone with tenant role
      if (obj.visibilityLevel === 'PUBLIC_TENANT') {
        return tenantRoles.length > 0; // Any tenant role can see
      }
      // PRIVATE needs owner or admin
      if (obj.visibilityLevel === 'PRIVATE') {
        return obj.ownerId === user.id || tenantRoles.some(r => r.role.includes('ADMIN') || r.role.includes('OWNER'));
      }
      // Default: visible
      return true;
    });

    console.log(`\n✅ After visibility filtering: ${visibleObjectives.length} objectives`);
    
    if (visibleObjectives.length === 0 && allObjectives.length > 0) {
      console.log(`\n❌ ISSUE FOUND: All objectives filtered out by visibility checks!`);
      console.log(`   This explains why nothing displays.`);
    } else if (visibleObjectives.length > 0) {
      console.log(`\n✅ Objectives should be visible. Issue may be elsewhere.`);
    }

    // Check if there's a pagination issue
    console.log(`\n📄 Pagination check:`);
    console.log(`   Total objectives: ${visibleObjectives.length}`);
    console.log(`   Page 1 (first 20): ${Math.min(20, visibleObjectives.length)}`);
    
    if (visibleObjectives.length > 20) {
      console.log(`   ⚠️  Note: Backend paginates, so only first 20 would be returned`);
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






