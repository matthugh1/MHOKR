-- Migration: Add ObjectiveState and KeyResultState enums and state fields
-- Backfill: Map isPublished=true → PUBLISHED, status=COMPLETED → COMPLETED, status=CANCELLED → CANCELLED

-- Create enums (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ObjectiveState') THEN
    CREATE TYPE "ObjectiveState" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KeyResultState') THEN
    CREATE TYPE "KeyResultState" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
  END IF;
END $$;

-- Add state columns with default DRAFT (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'objectives' AND column_name = 'state') THEN
    ALTER TABLE "objectives" ADD COLUMN "state" "ObjectiveState" NOT NULL DEFAULT 'DRAFT';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'key_results' AND column_name = 'state') THEN
    ALTER TABLE "key_results" ADD COLUMN "state" "KeyResultState" NOT NULL DEFAULT 'DRAFT';
  END IF;
END $$;

-- Backfill state based on isPublished and status (only if state column exists and needs backfilling)
DO $$
BEGIN
  -- Backfill objectives if state is still default DRAFT and we have status/isPublished data
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'objectives' AND column_name = 'state') THEN
    UPDATE "objectives"
    SET "state" = CASE
      WHEN "status" = 'COMPLETED' THEN 'COMPLETED'::"ObjectiveState"
      WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"ObjectiveState"
      WHEN "isPublished" = true THEN 'PUBLISHED'::"ObjectiveState"
      ELSE 'DRAFT'::"ObjectiveState"
    END
    WHERE "state" = 'DRAFT'::"ObjectiveState" OR "state" IS NULL;
  END IF;
  
  -- Backfill key_results if state is still default DRAFT and we have status/isPublished data
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'key_results' AND column_name = 'state') THEN
    UPDATE "key_results"
    SET "state" = CASE
      WHEN "status" = 'COMPLETED' THEN 'COMPLETED'::"KeyResultState"
      WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"KeyResultState"
      WHEN "isPublished" = true THEN 'PUBLISHED'::"KeyResultState"
      ELSE 'DRAFT'::"KeyResultState"
    END
    WHERE "state" = 'DRAFT'::"KeyResultState" OR "state" IS NULL;
  END IF;
END $$;

-- Create indexes (only if they don't exist)
CREATE INDEX IF NOT EXISTS "objectives_state_idx" ON "objectives"("state");
CREATE INDEX IF NOT EXISTS "key_results_state_idx" ON "key_results"("state");

