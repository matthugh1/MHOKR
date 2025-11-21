/**
 * Setup Script for Puzzel Organization
 * 
 * Creates a superuser and the "Puzzel" organization.
 * 
 * Usage:
 *   ts-node scripts/setup-puzzel.ts
 * 
 * Or with custom values:
 *   ts-node scripts/setup-puzzel.ts --email admin@puzzel.com --password admin123 --org-name "Puzzel"
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Parse command-line arguments
function parseArgs(): { 
  email?: string; 
  name?: string; 
  password?: string;
  orgName?: string;
  orgSlug?: string;
} {
  const args = process.argv.slice(2);
  const parsed: { 
    email?: string; 
    name?: string; 
    password?: string;
    orgName?: string;
    orgSlug?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      parsed.email = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      parsed.name = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      parsed.password = args[i + 1];
      i++;
    } else if (args[i] === '--org-name' && args[i + 1]) {
      parsed.orgName = args[i + 1];
      i++;
    } else if (args[i] === '--org-slug' && args[i + 1]) {
      parsed.orgSlug = args[i + 1];
      i++;
    }
  }

  return parsed;
}

async function main() {
  console.log('🚀 Setting up Puzzel organization...\n');

  const args = parseArgs();
  const email = args.email || 'admin@puzzel.com';
  const name = args.name || 'Admin User';
  const password = args.password || 'admin123';
  const orgName = args.orgName || 'Puzzel';
  const orgSlug = args.orgSlug || 'puzzel';

  try {
    // Step 1: Create or get superuser
    console.log('📝 Step 1: Creating superuser...');
    let superuser = await prisma.user.findUnique({
      where: { email },
    });

    if (superuser) {
      if (superuser.isSuperuser) {
        console.log(`   ✅ User ${email} is already a superuser`);
      } else {
        console.log(`   ⚠️  User ${email} exists. Promoting to superuser...`);
        superuser = await prisma.user.update({
          where: { id: superuser.id },
          data: { isSuperuser: true },
        });
        console.log(`   ✅ User ${email} is now a superuser`);
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      superuser = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: hashedPassword,
          isSuperuser: true,
        },
      });
      console.log(`   ✅ Superuser created: ${email}`);
    }

    console.log(`   User ID: ${superuser.id}\n`);

    // Step 2: Create or get organization
    console.log('📝 Step 2: Creating organization...');
    let organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (organization) {
      console.log(`   ✅ Organization "${orgName}" already exists`);
      console.log(`   Organization ID: ${organization.id}`);
    } else {
      organization = await prisma.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
        },
      });
      console.log(`   ✅ Organization "${orgName}" created`);
      console.log(`   Organization ID: ${organization.id}`);
    }

    console.log(`   Organization Slug: ${organization.slug}\n`);

    // Summary
    console.log('✅ Setup complete!\n');
    console.log('📋 Summary:');
    console.log(`   Superuser Email: ${email}`);
    console.log(`   Superuser Password: ${password}`);
    console.log(`   Superuser ID: ${superuser.id}`);
    console.log(`   Organization: ${orgName}`);
    console.log(`   Organization ID: ${organization.id}`);
    console.log(`   Organization Slug: ${organization.slug}\n`);

    console.log('🎯 Next steps:');
    console.log(`   1. Login with: ${email} / ${password}`);
    console.log(`   2. Import CSV: npx ts-node scripts/test-viva-goals-import.ts ../../import/vivagoals.csv ${organization.id} ${superuser.id}`);

  } catch (error: any) {
    console.error('\n❌ Error during setup:', error.message);
    if (error.code === 'P2002') {
      console.error('   A unique constraint violation occurred. Check if email or slug already exists.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

