-- Migration: Add multiple owners support for Objectives and Key Results
-- This migration adds junction tables for multiple owners while maintaining
-- backward compatibility with existing ownerId fields

-- Create objective_owners table
CREATE TABLE "objective_owners" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "objective_owners_pkey" PRIMARY KEY ("id")
);

-- Create key_result_owners table
CREATE TABLE "key_result_owners" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "key_result_owners_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for objective_owners
ALTER TABLE "objective_owners" ADD CONSTRAINT "objective_owners_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objective_owners" ADD CONSTRAINT "objective_owners_objectiveId_fkey" 
    FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objective_owners" ADD CONSTRAINT "objective_owners_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objective_owners" ADD CONSTRAINT "objective_owners_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraints for key_result_owners
ALTER TABLE "key_result_owners" ADD CONSTRAINT "key_result_owners_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_result_owners" ADD CONSTRAINT "key_result_owners_keyResultId_fkey" 
    FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_result_owners" ADD CONSTRAINT "key_result_owners_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_result_owners" ADD CONSTRAINT "key_result_owners_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unique constraints (prevent duplicate owners)
CREATE UNIQUE INDEX "objective_owners_tenantId_objectiveId_userId_key" 
    ON "objective_owners"("tenantId", "objectiveId", "userId");
CREATE UNIQUE INDEX "key_result_owners_tenantId_keyResultId_userId_key" 
    ON "key_result_owners"("tenantId", "keyResultId", "userId");

-- Add indexes for efficient queries
CREATE INDEX "objective_owners_tenantId_idx" ON "objective_owners"("tenantId");
CREATE INDEX "objective_owners_objectiveId_idx" ON "objective_owners"("objectiveId");
CREATE INDEX "objective_owners_userId_idx" ON "objective_owners"("userId");

CREATE INDEX "key_result_owners_tenantId_idx" ON "key_result_owners"("tenantId");
CREATE INDEX "key_result_owners_keyResultId_idx" ON "key_result_owners"("keyResultId");
CREATE INDEX "key_result_owners_userId_idx" ON "key_result_owners"("userId");

