import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// Parse command-line arguments
function parseArgs(): { email?: string; name?: string; password?: string } {
  const args = process.argv.slice(2);
  const parsed: { email?: string; name?: string; password?: string } = {};

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
    }
  }

  return parsed;
}

async function main() {
  console.log('🔐 Superuser Creation Script\n');
  console.log('This script will create a superuser account with system-wide admin privileges.\n');

  // Try to get values from command-line arguments first
  const args = parseArgs();
  let email = args.email;
  let name = args.name;
  let password = args.password;

  // If not provided via args, prompt interactively
  if (!email) {
    email = await question('Email: ');
  }
  if (!name) {
    name = await question('Full Name: ');
  }
  if (!password) {
    password = await question('Password: ');
  }

  if (!email || !name || !password) {
    console.error('❌ All fields are required');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.isSuperuser) {
        console.log(`\n⚠️  User ${email} is already a superuser!`);
        process.exit(0);
      }
      
      console.log(`\n⚠️  User ${email} already exists. Promoting to superuser...`);
      
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { isSuperuser: true },
      });

      console.log(`✅ User ${email} is now a superuser!`);
      console.log(`\nYou can now login with this account and use it to:`);
      console.log(`  - Create organizations`);
      console.log(`  - Assign users to organizations`);
      console.log(`  - Manage all users in the system`);
      console.log(`  - Access all OKRs system-wide`);
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create superuser
      const superuser = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: hashedPassword,
          isSuperuser: true,
        },
      });

      console.log(`\n✅ Superuser created successfully!`);
      console.log(`   Email: ${superuser.email}`);
      console.log(`   Name: ${superuser.name}`);
      console.log(`   ID: ${superuser.id}`);
      console.log(`\nYou can now login with this account and use it to:`);
      console.log(`  - Create organizations`);
      console.log(`  - Assign users to organizations`);
      console.log(`  - Manage all users in the system`);
      console.log(`  - Access all OKRs system-wide`);
    }
  } catch (error: any) {
    console.error('\n❌ Error creating superuser:', error.message);
    if (error.code === 'P2002') {
      console.error('   This email is already in use. If you want to promote this user, the script should have handled it.');
    }
    process.exit(1);
  } finally {
    if (rl) {
      rl.close();
    }
    await prisma.$disconnect();
  }
}

main();

