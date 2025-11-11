-- Migration: Add weight column to ObjectiveKeyResult junction table
-- This enables weighted progress roll-up for Objectives based on their linked Key Results.
-- Default weight of 1.0 ensures backward compatibility (equal weights for all KRs).

-- AlterTable
ALTER TABLE "objective_key_results" ADD COLUMN "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

