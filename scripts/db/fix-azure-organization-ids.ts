#!/usr/bin/env ts-node

/**
 * Fix Azure Organization IDs
 * 
 * This script updates all users' primaryOrganizationId in Azure to match the local organization ID.
 * This fixes the issue where Company OKRs don't display because users are assigned to the wrong organization.
 * 
 * Usage:
 *   LOCAL_DATABASE_URL="postgresql://..." AZURE_DATABASE_URL="postgresql://..." npx ts-node scripts/db/fix-azure-organization-ids.ts
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const localDbUrl = process.env.LOCAL_DATABASE_URL;
  const azureDbUrl = process.env.AZURE_DATABASE_URL;

  if (!localDbUrl || !azureDbUrl) {
    console.error('❌ Error: Both LOCAL_DATABASE_URL and AZURE_DATABASE_URL are required');
    process.exit(1);
  }

  const localPrisma = new PrismaClient({
    datasources: { db: { url: localDbUrl } },
  });

  const azurePrisma = new PrismaClient({
    datasources: { db: { url: azureDbUrl } },
  });

  try {
    console.log('🔍 Finding correct organization ID from local database...');
    
    // Find the Puzzel organization in local
    const localOrg = await localPrisma.organization.findFirst({
      where: { name: 'Puzzel' },
      select: { id: true, name: true },
    });

    if (!localOrg) {
      console.error('❌ Error: Could not find "Puzzel" organization in local database');
      process.exit(1);
    }

    console.log(`✅ Found local organization: ${localOrg.name} (ID: ${localOrg.id})`);

    // Find the Puzzel organization in Azure
    const azureOrg = await azurePrisma.organization.findFirst({
      where: { name: 'Puzzel' },
      select: { id: true, name: true },
    });

    if (!azureOrg) {
      console.error('❌ Error: Could not find "Puzzel" organization in Azure database');
      process.exit(1);
    }

    console.log(`✅ Found Azure organization: ${azureOrg.name} (ID: ${azureOrg.id})`);

    if (localOrg.id === azureOrg.id) {
      console.log('✅ Organization IDs already match! No fix needed.');
      return;
    }

    console.log(`\n⚠️  Organization IDs differ:`);
    console.log(`   Local:  ${localOrg.id}`);
    console.log(`   Azure:  ${azureOrg.id}`);

    // Count users that need updating
    const usersToUpdate = await azurePrisma.user.count({
      where: { primaryOrganizationId: azureOrg.id },
    });

    console.log(`\n📊 Found ${usersToUpdate} users with primaryOrganizationId = ${azureOrg.id}`);

    if (usersToUpdate === 0) {
      console.log('✅ No users need updating.');
      return;
    }

    // Update all users' primaryOrganizationId
    console.log(`\n🔄 Updating users' primaryOrganizationId to ${localOrg.id}...`);
    
    const result = await azurePrisma.user.updateMany({
      where: { primaryOrganizationId: azureOrg.id },
      data: { primaryOrganizationId: localOrg.id },
    });

    console.log(`✅ Updated ${result.count} users`);

    // Also update role assignments that reference the old organization ID
    console.log(`\n🔄 Updating role assignments...`);
    
    const roleAssignmentsUpdated = await azurePrisma.roleAssignment.updateMany({
      where: {
        scopeType: 'TENANT',
        scopeId: azureOrg.id,
      },
      data: {
        scopeId: localOrg.id,
      },
    });

    console.log(`✅ Updated ${roleAssignmentsUpdated.count} role assignments`);

    // Update objectives, key results, etc. that reference the old organization
    console.log(`\n🔄 Updating objectives...`);
    const objectivesUpdated = await azurePrisma.objective.updateMany({
      where: { tenantId: azureOrg.id },
      data: { tenantId: localOrg.id },
    });
    console.log(`✅ Updated ${objectivesUpdated.count} objectives`);

    console.log(`\n🔄 Updating key results...`);
    const keyResultsUpdated = await azurePrisma.keyResult.updateMany({
      where: { tenantId: azureOrg.id },
      data: { tenantId: localOrg.id },
    });
    console.log(`✅ Updated ${keyResultsUpdated.count} key results`);

    console.log(`\n🔄 Updating cycles...`);
    const cyclesUpdated = await azurePrisma.cycle.updateMany({
      where: { tenantId: azureOrg.id },
      data: { tenantId: localOrg.id },
    });
    console.log(`✅ Updated ${cyclesUpdated.count} cycles`);

    console.log(`\n✅ Fix complete! All users and data now reference organization ID: ${localOrg.id}`);
    console.log(`\n⚠️  Note: You may want to delete the old organization (${azureOrg.id}) if it's no longer needed.`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
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



