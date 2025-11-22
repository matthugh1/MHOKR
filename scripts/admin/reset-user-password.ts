import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.USER_EMAIL || 'founder@puzzelcx.local';
  const password = process.env.NEW_PASSWORD;
  
  if (!password || password.trim() === '') {
    console.error('❌ NEW_PASSWORD environment variable is not set.');
    console.error('Usage: NEW_PASSWORD=yourpassword USER_EMAIL=email@example.com ts-node reset-user-password.ts');
    process.exit(1);
  }

  console.log(`Resetting password for ${email}...`);

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    console.log(`✅ Password reset successfully for ${email}!`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`\nYou can now login with password: ${password}`);
  } catch (error: any) {
    console.error('\n❌ Error resetting password:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();






