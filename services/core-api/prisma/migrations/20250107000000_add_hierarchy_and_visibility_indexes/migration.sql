-- Migration: Add Composite Indexes for Hierarchy and Visibility Queries
-- Date: 2025-01-07
-- Purpose: Add composite indexes for hierarchy queries and visibility filtering to improve performance
-- Phase: Performance Optimization

-- ==========================================
-- Composite Indexes for Objectives
-- ==========================================

-- Index for hierarchy queries: filtering objectives by tenant and parentId
-- Used in queries like: WHERE tenantId = ? AND parentId = ? (or parentId IS NULL)
-- This significantly improves performance when fetching root objectives and their descendants
CREATE INDEX IF NOT EXISTS "objectives_tenantId_parentId_idx" ON "objectives"("tenantId", "parentId");

-- Index for visibility filtering: filtering objectives by tenant and visibilityLevel
-- Used in queries like: WHERE tenantId = ? AND visibilityLevel = ?
-- This improves performance when filtering by visibility level (PUBLIC_TENANT, PRIVATE, etc.)
CREATE INDEX IF NOT EXISTS "objectives_tenantId_visibilityLevel_idx" ON "objectives"("tenantId", "visibilityLevel");

-- ==========================================
-- Migration Complete
-- ==========================================
-- Summary:
-- ✅ Added composite index (tenantId, parentId) on objectives for hierarchy queries
-- ✅ Added composite index (tenantId, visibilityLevel) on objectives for visibility filtering
-- 
-- These indexes will improve query performance for:
-- - Hierarchy view queries (fetching root objectives and descendants)
-- - Visibility-based filtering of objectives
-- - Company OKR loading performance



