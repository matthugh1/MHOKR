-- Migration: Add Phased Targets / Milestones for Objectives and Key Results
-- This migration adds support for phased targets (milestones) with intervals and target dates

-- Create enum for phased target intervals
CREATE TYPE "PhasedTargetInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'CUSTOM');

-- Create phased_targets table
CREATE TABLE "phased_targets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "keyResultId" TEXT,
    "interval" "PhasedTargetInterval" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phased_targets_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_objectiveId_fkey" 
    FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_keyResultId_fkey" 
    FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes for efficient queries
CREATE INDEX "phased_targets_tenantId_idx" ON "phased_targets"("tenantId");
CREATE INDEX "phased_targets_objectiveId_idx" ON "phased_targets"("objectiveId");
CREATE INDEX "phased_targets_keyResultId_idx" ON "phased_targets"("keyResultId");
CREATE INDEX "phased_targets_targetDate_idx" ON "phased_targets"("targetDate");
CREATE INDEX "phased_targets_order_idx" ON "phased_targets"("order");

-- Add check constraint: Must belong to either Objective or Key Result (not both, not neither)
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_objective_or_keyresult_check" 
    CHECK (
        ("objectiveId" IS NOT NULL AND "keyResultId" IS NULL) OR
        ("objectiveId" IS NULL AND "keyResultId" IS NOT NULL)
    );

