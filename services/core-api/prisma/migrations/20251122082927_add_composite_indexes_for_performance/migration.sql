-- Migration: Add Composite Indexes for Performance
-- Date: 2025-11-22
-- Purpose: Add composite indexes for common filter combinations to improve query performance
-- Phase: Phase 1.1 - Scalability & Performance

-- ==========================================
-- Composite Indexes for Objectives
-- ==========================================

-- Index for filtering objectives by tenant and status
-- Used in queries like: WHERE tenantId = ? AND status = ?
CREATE INDEX IF NOT EXISTS "objectives_tenantId_status_idx" ON "objectives"("tenantId", "status");

-- Index for filtering objectives by tenant, cycle, and status
-- Used in queries like: WHERE tenantId = ? AND cycleId = ? AND status = ?
CREATE INDEX IF NOT EXISTS "objectives_tenantId_cycleId_status_idx" ON "objectives"("tenantId", "cycleId", "status");

-- Index for filtering objectives by tenant and owner
-- Used in queries like: WHERE tenantId = ? AND ownerId = ?
CREATE INDEX IF NOT EXISTS "objectives_tenantId_ownerId_idx" ON "objectives"("tenantId", "ownerId");

-- ==========================================
-- Composite Indexes for Key Results
-- ==========================================

-- Index for filtering key results by tenant and status
-- Used in queries like: WHERE tenantId = ? AND status = ?
CREATE INDEX IF NOT EXISTS "key_results_tenantId_status_idx" ON "key_results"("tenantId", "status");

-- Index for filtering key results by tenant and cycle
-- Used in queries like: WHERE tenantId = ? AND cycleId = ?
CREATE INDEX IF NOT EXISTS "key_results_tenantId_cycleId_idx" ON "key_results"("tenantId", "cycleId");

-- ==========================================
-- Migration Complete
-- ==========================================
-- Summary:
-- ✅ Added composite index (tenantId, status) on objectives
-- ✅ Added composite index (tenantId, cycleId, status) on objectives
-- ✅ Added composite index (tenantId, ownerId) on objectives
-- ✅ Added composite index (tenantId, status) on key_results
-- ✅ Added composite index (tenantId, cycleId) on key_results
-- 
-- These indexes will improve query performance for:
-- - Filtered OKR lists by tenant and status
-- - Cycle-based views with status filters
-- - User-specific objective lists
-- - Cycle-based key result queries

