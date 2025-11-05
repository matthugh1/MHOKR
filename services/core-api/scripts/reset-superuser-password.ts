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
function parseArgs(): { email?: string; password?: string } {
  const args = process.argv.slice(2);
  const parsed: { email?: string; password?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      parsed.email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      parsed.password = args[i + 1];
      i++;
    }
  }

  return parsed;
}

async function main() {
  console.log('🔐 Superuser Password Reset Script\n');
  console.log('This script will reset the password for a superuser account.\n');

  // Try to get values from command-line arguments first
  const args = parseArgs();
  let email = args.email;
  let password = args.password;

  // If not provided via args, prompt interactively
  if (!email) {
    email = await question('Superuser Email: ');
  }
  if (!password) {
    password = await question('New Password: ');
  }

  if (!email || !password) {
    console.error('❌ Email and password are required');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    if (!user.isSuperuser) {
      console.error(`❌ User ${email} is not a superuser`);
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    console.log(`\n✅ Password reset successfully for superuser ${email}!`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`\nYou can now login with the new password.`);
  } catch (error: any) {
    console.error('\n❌ Error resetting password:', error.message);
    process.exit(1);
  } finally {
    if (rl) {
      rl.close();
    }
    await prisma.$disconnect();
  }
}

main();





