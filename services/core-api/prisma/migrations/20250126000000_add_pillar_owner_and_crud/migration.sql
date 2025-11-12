-- Migration: Add ownerId to StrategicPillar and PILLAR to EntityType
-- This enables pillar ownership and CRUD operations with proper activity logging.

-- Add ownerId column to StrategicPillar
ALTER TABLE "strategic_pillars" ADD COLUMN "ownerId" TEXT;

-- Add foreign key constraint for ownerId
ALTER TABLE "strategic_pillars" ADD CONSTRAINT "strategic_pillars_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add composite index for tenant + owner queries
CREATE INDEX "strategic_pillars_tenantId_ownerId_idx" ON "strategic_pillars"("tenantId", "ownerId");

-- Add PILLAR to EntityType enum
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PILLAR';


