-- AlterEnum: Add PRIVATE to VisibilityLevel enum
-- This migration adds the PRIVATE visibility level for confidential OKRs (HR, legal, M&A)

ALTER TYPE "VisibilityLevel" ADD VALUE 'PRIVATE';

