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

async function main() {
  console.log('🔐 Superuser Creation Script\n');

  // Get user details
  const email = await question('Email: ');
  const name = await question('Full Name: ');
  const password = await question('Password: ');

  if (!email || !name || !password) {
    console.error('❌ All fields are required');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`\n⚠️  User ${email} already exists. Promoting to superuser...`);
      
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { isSuperuser: true },
      });

      console.log(`✅ User ${email} is now a superuser!`);
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
    }
  } catch (error: any) {
    console.error('\n❌ Error creating superuser:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();





