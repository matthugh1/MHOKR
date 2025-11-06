# Database Schema Tenant Association Analysis

**Date**: 2025-01-XX  
**Analyst**: Senior Database Developer  
**Status**: Comprehensive Analysis Complete

---

## Executive Summary

This report provides a comprehensive analysis of tenant association across the entire database schema. The analysis identifies **critical issues** that could lead to tenant data leakage, data integrity problems, and security vulnerabilities.

### Key Findings

- ✅ **8 tables** have direct `tenantId` association with proper foreign keys
- ⚠️ **1 table** (`objectives`) has nullable `tenantId` - **CRITICAL ISSUE**
- ⚠️ **2 tables** (`activities`, `user_layouts`) have **NO tenant association** - **CRITICAL SECURITY RISK**
- ⚠️ **RLS policies** for `key_results` use indirect checks instead of direct `tenantId` - **PERFORMANCE & SECURITY ISSUE**
- ⚠️ **Several tables** rely on indirect tenant association which could be fragile

---

## 1. Tables with Direct Tenant Association

### ✅ Properly Configured Tables

#### 1.1 `organizations` (Root Tenant Table)
- **Status**: ✅ Root table - no tenant association needed
- **Primary Key**: `id`
- **Notes**: This is the tenant root table

#### 1.2 `workspaces`
- **Tenant Field**: `tenantId` (NOT NULL)
- **Foreign Key**: `workspaces_tenantId_fkey` → `organizations(id)` ON DELETE CASCADE
- **Index**: `@@index([tenantId])`
- **RLS**: ✅ Enabled with proper policies
- **Status**: ✅ **PROPERLY CONFIGURED**

#### 1.3 `strategic_pillars`
- **Tenant Field**: `tenantId` (NOT NULL)
- **Foreign Key**: `strategic_pillars_tenantId_fkey` → `organizations(id)` ON DELETE CASCADE
- **Index**: `@@index([tenantId])`
- **RLS**: ✅ Enabled with proper policies
- **Status**: ✅ **PROPERLY CONFIGURED**

#### 1.4 `cycles`
- **Tenant Field**: `tenantId` (NOT NULL)
- **Foreign Key**: `cycles_tenantId_fkey` → `organizations(id)` ON DELETE CASCADE
- **Index**: `@@index([tenantId])`
- **RLS**: ✅ Enabled with proper policies
- **Status**: ✅ **PROPERLY CONFIGURED**

#### 1.5 `key_results`
- **Tenant Field**: `tenantId` (NOT NULL)
- **Foreign Key**: `key_results_tenantId_fkey` → `organizations(id)` ON DELETE CASCADE
- **Index**: `@@index([tenantId])`
- **RLS**: ✅ Enabled BUT uses indirect checks (see Issue #3)
- **Status**: ⚠️ **CONFIGURED BUT SUBOPTIMAL**

#### 1.6 `initiatives`
- **Tenant Field**: `tenantId` (NOT NULL)
- **Foreign Key**: `initiatives_tenantId_fkey` → `organizations(id)` ON DELETE CASCADE
- **Index**: `@@index([tenantId])`
- **RLS**: ❌ **NOT ENABLED** (see Issue #4)
- **Status**: ⚠️ **MISSING RLS POLICIES**

#### 1.7 `check_in_requests`
- **Tenant Field**: `tenantId` (NOT NULL)
- **Foreign Key**: `check_in_requests_tenantId_fkey` → `organizations(id)` ON DELETE CASCADE
- **Index**: `@@index([tenantId])`
- **RLS**: ✅ Enabled with proper policies
- **Status**: ✅ **PROPERLY CONFIGURED**

---

## 2. Tables with Indirect Tenant Association

These tables derive tenant association through foreign key relationships:

#### 2.1 `teams`
- **Tenant Association**: Via `workspaceId` → `workspaces.tenantId`
- **Foreign Key**: `teams_workspaceId_fkey` → `workspaces(id)` ON DELETE CASCADE
- **RLS**: ✅ Enabled (checks via workspace join)
- **Status**: ✅ **ACCEPTABLE** (indirect association is appropriate here)

#### 2.2 `check_ins`
- **Tenant Association**: Via `keyResultId` → `key_results.tenantId`
- **Foreign Key**: `check_ins_keyResultId_fkey` → `key_results(id)` ON DELETE CASCADE
- **RLS**: ❌ **NOT ENABLED** (see Issue #5)
- **Status**: ⚠️ **MISSING RLS POLICIES**

#### 2.3 `check_in_responses`
- **Tenant Association**: Via `requestId` → `check_in_requests.tenantId`
- **Foreign Key**: `check_in_responses_requestId_fkey` → `check_in_requests(id)` ON DELETE CASCADE
- **RLS**: ❌ **NOT ENABLED** (see Issue #5)
- **Status**: ⚠️ **MISSING RLS POLICIES**

#### 2.4 `objective_key_results` (Junction Table)
- **Tenant Association**: Via `objectiveId` → `objectives.tenantId` OR `keyResultId` → `key_results.tenantId`
- **Foreign Keys**: Both relationships cascade
- **RLS**: ❌ **NOT ENABLED** (see Issue #6)
- **Status**: ⚠️ **MISSING RLS POLICIES**

#### 2.5 `ai_conversations`
- **Tenant Association**: Via `workspaceId` → `workspaces.tenantId`
- **Foreign Key**: `ai_conversations_workspaceId_fkey` → `workspaces(id)` ON DELETE CASCADE
- **RLS**: ❌ **NOT ENABLED** (see Issue #7)
- **Status**: ⚠️ **MISSING RLS POLICIES**

#### 2.6 `ai_messages`
- **Tenant Association**: Via `conversationId` → `ai_conversations.workspaceId` → `workspaces.tenantId`
- **Foreign Key**: `ai_messages_conversationId_fkey` → `ai_conversations(id)` ON DELETE CASCADE
- **RLS**: ❌ **NOT ENABLED** (see Issue #7)
- **Status**: ⚠️ **MISSING RLS POLICIES**

#### 2.7 `kr_integrations`
- **Tenant Association**: Via `keyResultId` → `key_results.tenantId`
- **Foreign Key**: `kr_integrations_keyResultId_fkey` → `key_results(id)` ON DELETE CASCADE
- **RLS**: ❌ **NOT ENABLED** (see Issue #8)
- **Status**: ⚠️ **MISSING RLS POLICIES**

---

## 3. Tables WITHOUT Tenant Association

### ❌ CRITICAL SECURITY RISKS

#### 3.1 `objectives` - NULLABLE tenantId
- **Tenant Field**: `tenantId` (NULLABLE ❌)
- **Issue**: Can have NULL tenantId, allowing cross-tenant data leakage
- **Current State**: 
  - Foreign key exists but allows NULL
  - Migration attempted to backfill but nullable constraint remains
  - RLS policies handle NULL but this is a data integrity issue
- **Risk Level**: 🔴 **CRITICAL**
- **Impact**: Objectives can exist without tenant association, breaking tenant isolation
- **Recommendation**: 
  ```sql
  -- Add NOT NULL constraint after backfilling
  ALTER TABLE objectives ALTER COLUMN "tenantId" SET NOT NULL;
  ```

#### 3.2 `activities` - NO Tenant Association
- **Tenant Association**: ❌ **NONE**
- **Issue**: Activity records track actions on tenant-scoped entities but have no direct tenant association
- **Current State**: 
  - References `entityType` and `entityId` (OBJECTIVE, KEY_RESULT, INITIATIVE, CHECK_IN)
  - No direct tenantId field
  - Application code filters via joins (see `activity.service.ts`)
- **Risk Level**: 🔴 **CRITICAL**
- **Impact**: 
  - Cross-tenant data leakage if application filtering fails
  - No RLS protection
  - Performance issues from complex joins
- **Recommendation**: 
  ```sql
  -- Add tenantId column
  ALTER TABLE activities ADD COLUMN "tenantId" TEXT;
  
  -- Backfill from entity relationships
  UPDATE activities a
  SET "tenantId" = (
    CASE a."entityType"
      WHEN 'OBJECTIVE' THEN (SELECT "tenantId" FROM objectives WHERE id = a."entityId")
      WHEN 'KEY_RESULT' THEN (SELECT "tenantId" FROM key_results WHERE id = a."entityId")
      WHEN 'INITIATIVE' THEN (SELECT "tenantId" FROM initiatives WHERE id = a."entityId")
      WHEN 'CHECK_IN' THEN (
        SELECT kr."tenantId" 
        FROM check_ins ci
        JOIN key_results kr ON ci."keyResultId" = kr.id
        WHERE ci.id = a."entityId"
      )
    END
  );
  
  -- Add NOT NULL constraint
  ALTER TABLE activities ALTER COLUMN "tenantId" SET NOT NULL;
  
  -- Add foreign key
  ALTER TABLE activities 
    ADD CONSTRAINT "activities_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES organizations(id) ON DELETE CASCADE;
  
  -- Add index
  CREATE INDEX "activities_tenantId_idx" ON activities("tenantId");
  
  -- Enable RLS
  ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
  
  -- Add RLS policies (similar to other tables)
  ```

#### 3.3 `user_layouts` - NO Tenant Association
- **Tenant Association**: ❌ **NONE**
- **Issue**: User layout preferences stored without tenant context
- **Current State**: 
  - References `entityType` and `entityId` (OBJECTIVE, KEY_RESULT, INITIATIVE)
  - No tenantId field
- **Risk Level**: 🟡 **MEDIUM**
- **Impact**: 
  - Users could potentially access layouts for entities from other tenants
  - No RLS protection
- **Recommendation**: 
  ```sql
  -- Add tenantId column
  ALTER TABLE user_layouts ADD COLUMN "tenantId" TEXT;
  
  -- Backfill from entity relationships
  UPDATE user_layouts ul
  SET "tenantId" = (
    CASE ul."entityType"
      WHEN 'OBJECTIVE' THEN (SELECT "tenantId" FROM objectives WHERE id = ul."entityId")
      WHEN 'KEY_RESULT' THEN (SELECT "tenantId" FROM key_results WHERE id = ul."entityId")
      WHEN 'INITIATIVE' THEN (SELECT "tenantId" FROM initiatives WHERE id = ul."entityId")
    END
  );
  
  -- Add NOT NULL constraint
  ALTER TABLE user_layouts ALTER COLUMN "tenantId" SET NOT NULL;
  
  -- Add foreign key
  ALTER TABLE user_layouts 
    ADD CONSTRAINT "user_layouts_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES organizations(id) ON DELETE CASCADE;
  
  -- Add index
  CREATE INDEX "user_layouts_tenantId_idx" ON user_layouts("tenantId");
  
  -- Enable RLS
  ALTER TABLE user_layouts ENABLE ROW LEVEL SECURITY;
  
  -- Add RLS policies
  ```

#### 3.4 `audit_logs` - NO Tenant Association
- **Tenant Association**: ❌ **NONE**
- **Issue**: Audit logs track actions but have no tenant context
- **Current State**: 
  - References `targetType` and `targetId` (USER, ROLE_ASSIGNMENT, OKR, WORKSPACE, TEAM, TENANT, VISIBILITY_CHANGE)
  - No tenantId field
- **Risk Level**: 🟡 **MEDIUM**
- **Impact**: 
  - Cross-tenant audit log access possible
  - No RLS protection
- **Recommendation**: 
  ```sql
  -- Add tenantId column (nullable for platform-level actions)
  ALTER TABLE audit_logs ADD COLUMN "tenantId" TEXT;
  
  -- Backfill from target relationships
  UPDATE audit_logs al
  SET "tenantId" = (
    CASE al."targetType"
      WHEN 'TENANT' THEN al."targetId"
      WHEN 'WORKSPACE' THEN (SELECT "tenantId" FROM workspaces WHERE id = al."targetId")
      WHEN 'TEAM' THEN (
        SELECT w."tenantId" 
        FROM teams t
        JOIN workspaces w ON t."workspaceId" = w.id
        WHERE t.id = al."targetId"
      )
      WHEN 'OKR' THEN (SELECT "tenantId" FROM objectives WHERE id = al."targetId")
      WHEN 'ROLE_ASSIGNMENT' THEN (
        SELECT CASE 
          WHEN ra."scopeType" = 'TENANT' THEN ra."scopeId"
          WHEN ra."scopeType" = 'WORKSPACE' THEN (SELECT "tenantId" FROM workspaces WHERE id = ra."scopeId")
          WHEN ra."scopeType" = 'TEAM' THEN (
            SELECT w."tenantId" 
            FROM teams t
            JOIN workspaces w ON t."workspaceId" = w.id
            WHERE t.id = ra."scopeId"
          )
          ELSE NULL
        END
        FROM role_assignments ra
        WHERE ra.id = al."targetId"
      )
      ELSE NULL -- USER, VISIBILITY_CHANGE may not have tenant context
    END
  );
  
  -- Add index (tenantId can be NULL for platform-level actions)
  CREATE INDEX "audit_logs_tenantId_idx" ON audit_logs("tenantId");
  
  -- Add foreign key (nullable)
  ALTER TABLE audit_logs 
    ADD CONSTRAINT "audit_logs_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES organizations(id) ON DELETE CASCADE;
  
  -- Enable RLS
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  
  -- Add RLS policies (allow NULL for platform-level actions)
  ```

#### 3.5 `permission_audits` - NO Tenant Association
- **Tenant Association**: ❌ **NONE**
- **Issue**: Permission audit logs have no tenant context
- **Current State**: 
  - References `entityType` and `entityId` (ORGANIZATION, WORKSPACE, TEAM)
  - No tenantId field
- **Risk Level**: 🟡 **MEDIUM**
- **Impact**: Cross-tenant audit access possible
- **Recommendation**: Similar to `audit_logs` - add tenantId based on entityType

#### 3.6 `role_assignments` - Indirect Tenant Association
- **Tenant Association**: Via `scopeType` and `scopeId` (conditional)
- **Issue**: No direct tenantId field, relies on conditional logic
- **Current State**: 
  - Has trigger-based validation for scopeId references
  - No direct tenantId field
- **Risk Level**: 🟢 **LOW** (has validation trigger)
- **Impact**: Minor - trigger ensures referential integrity
- **Recommendation**: Consider adding computed column or view for easier tenant queries

---

## 4. Critical Issues Summary

### 🔴 CRITICAL Issues

1. **`objectives.tenantId` is NULLABLE**
   - **Impact**: Data integrity violation, potential cross-tenant leakage
   - **Fix**: Add NOT NULL constraint after data cleanup
   - **Priority**: P0

2. **`activities` table has NO tenant association**
   - **Impact**: Critical security risk - cross-tenant data leakage
   - **Fix**: Add tenantId column, backfill, enable RLS
   - **Priority**: P0

3. **`user_layouts` table has NO tenant association**
   - **Impact**: Security risk - potential cross-tenant access
   - **Fix**: Add tenantId column, backfill, enable RLS
   - **Priority**: P1

### 🟡 MEDIUM Priority Issues

4. **`key_results` RLS policies use indirect checks**
   - **Current**: Policies check via `objective_key_results` join
   - **Issue**: Performance overhead, complexity
   - **Fix**: Update RLS policies to use direct `tenantId` check
   - **Priority**: P1

5. **Missing RLS on several tables**:
   - `initiatives` - Has tenantId but no RLS
   - `check_ins` - Indirect tenant association, no RLS
   - `check_in_responses` - Indirect tenant association, no RLS
   - `objective_key_results` - Junction table, no RLS
   - `ai_conversations` - Indirect tenant association, no RLS
   - `ai_messages` - Indirect tenant association, no RLS
   - `kr_integrations` - Indirect tenant association, no RLS
   - **Priority**: P1

6. **`audit_logs` and `permission_audits` have no tenant association**
   - **Impact**: Cross-tenant audit log access
   - **Fix**: Add tenantId (nullable for platform actions), enable RLS
   - **Priority**: P2

---

## 5. Recommendations

### Immediate Actions (P0)

1. **Fix `objectives.tenantId` NULLABLE issue**
   ```sql
   -- Verify no NULL values exist
   SELECT COUNT(*) FROM objectives WHERE "tenantId" IS NULL;
   
   -- If count > 0, backfill using existing migration logic
   -- Then add NOT NULL constraint
   ALTER TABLE objectives ALTER COLUMN "tenantId" SET NOT NULL;
   ```

2. **Add tenant association to `activities` table**
   - Add `tenantId` column
   - Backfill from entity relationships
   - Add NOT NULL constraint
   - Add foreign key and index
   - Enable RLS with proper policies

### Short-term Actions (P1)

3. **Add tenant association to `user_layouts` table**
   - Similar approach to `activities`

4. **Enable RLS on all tenant-scoped tables**
   - `initiatives`
   - `check_ins`
   - `check_in_responses`
   - `objective_key_results`
   - `ai_conversations`
   - `ai_messages`
   - `kr_integrations`

5. **Optimize `key_results` RLS policies**
   - Update to use direct `tenantId` check instead of join

### Long-term Actions (P2)

6. **Add tenant association to audit tables**
   - `audit_logs` (nullable for platform actions)
   - `permission_audits`

7. **Consider computed columns or views**
   - For `role_assignments` to simplify tenant queries
   - For indirect associations to improve query performance

---

## 6. Data Integrity Checks

Run these queries to verify tenant association integrity:

```sql
-- Check for NULL tenantId in objectives
SELECT COUNT(*) as null_tenant_count 
FROM objectives 
WHERE "tenantId" IS NULL;

-- Check for orphaned key_results (should not exist due to FK)
SELECT COUNT(*) as orphaned_kr_count
FROM key_results kr
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.id = kr."tenantId"
);

-- Check for orphaned initiatives
SELECT COUNT(*) as orphaned_initiatives_count
FROM initiatives i
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.id = i."tenantId"
);

-- Check for activities without tenant association
SELECT COUNT(*) as activities_without_tenant
FROM activities a
WHERE NOT EXISTS (
  SELECT 1 FROM objectives o 
  WHERE o.id = a."entityId" AND a."entityType" = 'OBJECTIVE'
)
AND NOT EXISTS (
  SELECT 1 FROM key_results kr 
  WHERE kr.id = a."entityId" AND a."entityType" = 'KEY_RESULT'
)
AND NOT EXISTS (
  SELECT 1 FROM initiatives i 
  WHERE i.id = a."entityId" AND a."entityType" = 'INITIATIVE'
);

-- Check for user_layouts without tenant association
SELECT COUNT(*) as layouts_without_tenant
FROM user_layouts ul
WHERE NOT EXISTS (
  SELECT 1 FROM objectives o 
  WHERE o.id = ul."entityId" AND ul."entityType" = 'OBJECTIVE'
)
AND NOT EXISTS (
  SELECT 1 FROM key_results kr 
  WHERE kr.id = ul."entityId" AND ul."entityType" = 'KEY_RESULT'
)
AND NOT EXISTS (
  SELECT 1 FROM initiatives i 
  WHERE i.id = ul."entityId" AND ul."entityType" = 'INITIATIVE'
);
```

---

## 7. Migration Priority

### Phase 1: Critical Fixes (Week 1)
1. Fix `objectives.tenantId` NULLABLE
2. Add tenant association to `activities`
3. Enable RLS on `activities`

### Phase 2: Security Hardening (Week 2)
4. Add tenant association to `user_layouts`
5. Enable RLS on all remaining tenant-scoped tables
6. Optimize `key_results` RLS policies

### Phase 3: Audit & Compliance (Week 3)
7. Add tenant association to audit tables
8. Enable RLS on audit tables
9. Add monitoring/alerting for tenant isolation violations

---

## 8. Testing Requirements

After implementing fixes, verify:

1. **RLS Policy Testing**
   - Test SUPERUSER can read all tenants (read-only)
   - Test normal users can only access their tenant
   - Test users with no tenant get empty results

2. **Data Integrity Testing**
   - Verify no NULL tenantId values exist
   - Verify all foreign keys are valid
   - Verify cascade deletes work correctly

3. **Performance Testing**
   - Verify RLS policies don't significantly impact query performance
   - Verify indexes are being used
   - Monitor query execution plans

4. **Security Testing**
   - Attempt cross-tenant data access (should fail)
   - Verify application-level checks still work
   - Test edge cases (NULL values, orphaned records)

---

## Conclusion

The database schema has **good foundation** for tenant isolation with most tables properly configured. However, there are **critical gaps** that must be addressed:

1. **2 critical security risks** (`objectives.tenantId` nullable, `activities` no tenant association)
2. **1 medium security risk** (`user_layouts` no tenant association)
3. **7 tables missing RLS policies** despite having tenant association
4. **2 audit tables** missing tenant association

**Recommendation**: Address P0 issues immediately before production deployment. P1 issues should be resolved within 2 weeks. P2 issues can be scheduled for next quarter.

---

**Report Generated**: 2025-01-XX  
**Next Review**: After P0 fixes are implemented

