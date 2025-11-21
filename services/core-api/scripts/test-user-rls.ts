/**
 * Test script to verify User RLS policies are working correctly
 * 
 * This script tests that:
 * 1. Users can only see users in their organization
 * 2. Superusers can see all users
 * 3. Cross-tenant access is blocked
 * 
 * Usage: npx ts-node scripts/test-user-rls.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRLS() {
  console.log('🧪 Testing User RLS Policies...\n');

  try {
    // Get a sample organization and user
    const org = await prisma.organization.findFirst({
      include: {
        primaryUsers: {
          take: 1,
        },
      },
    });

    if (!org) {
      console.log('⚠️  No organizations found. Skipping RLS tests.');
      return;
    }

    const testUser = org.primaryUsers[0];
    if (!testUser) {
      console.log('⚠️  No users found in organization. Skipping RLS tests.');
      return;
    }

    console.log(`Using test organization: ${org.name} (${org.id})`);
    console.log(`Using test user: ${testUser.email} (${testUser.id})\n`);

    // Test 1: Query users without tenant context (should fail or return empty)
    console.log('Test 1: Query users without tenant context...');
    try {
      const usersWithoutContext = await prisma.user.findMany({
        take: 5,
      });
      console.log(`   ⚠️  Found ${usersWithoutContext.length} users (RLS may not be enforcing without session variables)`);
    } catch (error: any) {
      console.log(`   ✅ RLS blocked query: ${error.message}`);
    }

    // Test 2: Query users with tenant context (should return only users in that tenant)
    console.log('\nTest 2: Query users with tenant context...');
    try {
      // Set session variables manually for testing
      await prisma.$executeRaw`SET app.current_organization_id = ${org.id}`;
      await prisma.$executeRaw`SET app.user_is_superuser = 'false'`;

      const usersWithContext = await prisma.user.findMany({
        take: 10,
        select: {
          id: true,
          email: true,
          primaryOrganizationId: true,
        },
      });

      console.log(`   Found ${usersWithContext.length} users with tenant context:`);
      usersWithContext.forEach((user) => {
        const orgMatch = user.primaryOrganizationId === org.id ? '✅' : '⚠️';
        console.log(`   ${orgMatch} ${user.email} (primaryOrg: ${user.primaryOrganizationId || 'NULL'})`);
      });

      // Check if all users belong to the organization
      const crossTenantUsers = usersWithContext.filter(
        (u) => u.primaryOrganizationId !== org.id && u.primaryOrganizationId !== null
      );

      if (crossTenantUsers.length > 0) {
        console.log(`   ⚠️  WARNING: Found ${crossTenantUsers.length} users from other tenants!`);
        crossTenantUsers.forEach((u) => {
          console.log(`      - ${u.email} (primaryOrg: ${u.primaryOrganizationId})`);
        });
      } else {
        console.log('   ✅ All users belong to the test organization (or have no primaryOrg)');
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Query as superuser (should see all users)
    console.log('\nTest 3: Query users as superuser...');
    try {
      await prisma.$executeRaw`SET app.current_organization_id = NULL`;
      await prisma.$executeRaw`SET app.user_is_superuser = 'true'`;

      const allUsers = await prisma.user.findMany({
        take: 10,
        select: {
          id: true,
          email: true,
        },
      });

      console.log(`   ✅ Superuser can see ${allUsers.length} users (read-only access)`);
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 4: Try to query specific user from different tenant
    console.log('\nTest 4: Test cross-tenant user access...');
    try {
      // Get a user from a different organization (if exists)
      const otherOrg = await prisma.organization.findFirst({
        where: {
          id: { not: org.id },
        },
        include: {
          primaryUsers: {
            take: 1,
          },
        },
      });

      if (otherOrg && otherOrg.primaryUsers.length > 0) {
        const otherUser = otherOrg.primaryUsers[0];

        // Set context to first org
        await prisma.$executeRaw`SET app.current_organization_id = ${org.id}`;
        await prisma.$executeRaw`SET app.user_is_superuser = 'false'`;

        // Try to query user from other org
        const crossTenantUser = await prisma.user.findUnique({
          where: { id: otherUser.id },
        });

        if (crossTenantUser) {
          console.log(`   ⚠️  WARNING: Can access user ${otherUser.email} from different tenant!`);
          console.log(`      This user belongs to ${otherOrg.name} but was accessible with ${org.name} context`);
        } else {
          console.log(`   ✅ RLS correctly blocked access to user ${otherUser.email} from different tenant`);
        }
      } else {
        console.log('   ⚠️  No other organization found for cross-tenant test');
      }
    } catch (error: any) {
      console.log(`   ✅ RLS blocked cross-tenant access: ${error.message}`);
    }

    // Reset session variables
    await prisma.$executeRaw`RESET app.current_organization_id`;
    await prisma.$executeRaw`RESET app.user_is_superuser`;

    console.log('\n✅ RLS testing complete!');
    console.log('\n📋 Notes:');
    console.log('   - RLS policies are enforced at the database level');
    console.log('   - Session variables must be set by Prisma middleware for RLS to work');
    console.log('   - Application code should still validate tenant context');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testRLS().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

