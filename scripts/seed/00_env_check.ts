#!/usr/bin/env ts-node

/**
 * Seed Environment Check
 * 
 * Verifies database connection and environment before seeding.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEnvironment(): Promise<void> {
  console.log('🔍 Checking environment...');

  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');

    const result = await prisma.$queryRaw`SELECT version()`;
    console.log(`✅ PostgreSQL version: ${JSON.stringify(result)}`);

    await prisma.$disconnect();
    console.log('✅ Environment check passed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Environment check failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkEnvironment();

