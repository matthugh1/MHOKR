-- Migration: Add Objective review signals
-- This migration adds:
-- 1. ReviewFrequency enum (WEEKLY, MONTHLY, QUARTERLY)
-- 2. confidence field (Int, 0-100) on Objective
-- 3. reviewFrequency field (ReviewFrequency enum) on Objective
-- 4. lastReviewedAt field (DateTime) on Objective
-- 5. REVIEWED action to ActivityAction enum

-- Create ReviewFrequency enum
CREATE TYPE "ReviewFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY');

-- Add review fields to Objective table
ALTER TABLE "objectives" ADD COLUMN "confidence" SMALLINT;
ALTER TABLE "objectives" ADD COLUMN "reviewFrequency" "ReviewFrequency";
ALTER TABLE "objectives" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);

-- Add REVIEWED to ActivityAction enum
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'REVIEWED';


