# Scripts and Documentation Structure Audit

**Date**: 2025-01-20  
**Auditor**: Automated Audit  
**Status**: Complete

---

## Enforced Rule: Scripts are Never Imported by Runtime Code

**Status**: ✅ **Enforced via CI**

### Rule

Script files must never be imported, required, or referenced by runtime application code. They may only be executed via CLI/tooling or automation.

### Rationale

- **Operational Separation**: Scripts are for operations, maintenance, migrations, and tooling purposes. They should remain independent from production runtime code.
- **Security**: Prevents leakage of ad-hoc tooling logic into production execution paths.
- **Maintainability**: Ensures clear boundaries between application code and operational scripts.
- **Deployment Safety**: Prevents accidental inclusion of script dependencies in production builds.

### Enforcement

A static analysis check enforces this rule:

- **Script Location**: `scripts/check-no-script-imports.ts`
- **How to Run**: `npm run lint:no-script-imports`
- **CI Integration**: Automatically runs as part of `npm run lint`
- **Exit Code**: Non-zero on violation (fails CI)

The check scans all runtime files (`apps/*/src`, `services/*/src`, `packages/*/src`) and detects any imports or requires that resolve to script directories (`scripts/`, `services/core-api/scripts/`, root-level script files).

### Current Status

✅ **No violations found** (as of 2025-01-20)

All runtime code correctly avoids importing script files. The check is integrated into the lint pipeline and will fail CI if any violations are introduced.

---

## Current Structure Analysis

### Scripts Location

**Well-Organised**:
- ✅ `scripts/` - Root-level scripts directory
  - `dev/` - Development orchestration
  - `seed/` - Database seeding
  - `rbac/` - RBAC audit scripts
  - Various maintenance scripts

**Issues**:
- ⚠️ Scripts also exist in `services/core-api/scripts/`
- ⚠️ Some scripts in root level (e.g., `create-superuser.ts`)

### Documentation Location

**Well-Organised**:
- ✅ `docs/architecture/` - Architecture documentation
- ✅ `docs/developer/` - Developer guidelines
- ✅ `docs/audit/` - Audit reports
- ✅ `docs/feature-requests/` - Feature planning

**Issues**:
- 🔴 **80+ markdown files at repository root**
- ⚠️ Many audit/planning documents should be in `docs/`

---

## File Classification

### Runtime Code
- ✅ `apps/` - Frontend application
- ✅ `services/` - Backend services
- ✅ `packages/` - Shared packages

### Scripts (Operational/Maintenance)

| Current Location | Type | Recommended Location | Status |
|-----------------|------|---------------------|--------|
| `scripts/dev/devctl.ts` | Dev orchestration | `scripts/dev/` | ✅ Correct |
| `scripts/seed/run.ts` | Database seeding | `scripts/seed/` | ✅ Correct |
| `scripts/import-viva-goals-json.ts` | Import script | `scripts/import/` | ⚠️ Move to subfolder |
| `scripts/audit-tenant-isolation.ts` | Audit script | `scripts/audit/` | ⚠️ Move to subfolder |
| `scripts/rbac/audit-*.ts` | RBAC audit | `scripts/rbac/` | ✅ Correct |
| `services/core-api/scripts/create-superuser.ts` | Admin script | `scripts/admin/` | ⚠️ Move to root scripts |
| `services/core-api/scripts/reset-*.ts` | Admin script | `scripts/admin/` | ⚠️ Move to root scripts |
| `create-superuser.ts` (root) | Admin script | `scripts/admin/` | ⚠️ Move |

### Database Scripts

| Current Location | Type | Recommended Location | Status |
|-----------------|------|---------------------|--------|
| `services/core-api/prisma/migrations/` | Migrations | `db/migrations/` or keep current | ✅ Current OK |
| `services/core-api/prisma/seed.ts` | Seed script | `db/seeds/` or keep current | ✅ Current OK |
| `fix_users_organization.sql` (root) | SQL script | `db/scripts/` or `scripts/db/` | ⚠️ Move |

### Documentation

| Current Location | Type | Recommended Location | Status |
|-----------------|------|---------------------|--------|
| `docs/architecture/*.md` | Architecture docs | `docs/architecture/` | ✅ Correct |
| `docs/developer/*.md` | Developer guides | `docs/developer/` | ✅ Correct |
| `docs/audit/*.md` | Audit reports | `docs/audit/` | ✅ Correct |
| `SECURITY_AUDIT_REPORT.md` (root) | Audit report | `docs/audit/` | ⚠️ Move |
| `ARCHITECTURE_AUDIT_REPORT.md` (root) | Audit report | `docs/audit/` | ⚠️ Move |
| `P0_*.md` (root) | Planning docs | `docs/planning/` | ⚠️ Move |
| `PHASE*_SUMMARY.md` (root) | Planning docs | `docs/planning/` | ⚠️ Move |
| `*_IMPLEMENTATION.md` (root) | Planning docs | `docs/planning/` | ⚠️ Move |
| `README.md` (root) | Project docs | Root (keep) | ✅ Correct |

### Infrastructure

| Current Location | Type | Recommended Location | Status |
|-----------------|------|---------------------|--------|
| `docker-compose.yml` (root) | Docker config | `infra/docker/` or root | ✅ Root OK |
| `keycloak/` | Keycloak config | `infra/keycloak/` or keep | ✅ Current OK |

---

## Authoritative Standard Structure

**This section defines the final, agreed structure for the repository.**

### Directory Structure

```
OKR Framework/
├── apps/                         # Frontend applications (runtime code only)
├── services/                     # Backend services (runtime code only)
│   └── core-api/
│       └── prisma/
│           ├── migrations/      # Schema migrations (keep current location)
│           └── seed.ts          # Seed script (keep current location)
├── packages/                     # Shared packages (runtime code only)
├── scripts/                      # Operational & maintenance scripts (NOT imported by runtime)
│   ├── dev/                      # Development orchestration
│   ├── seed/                     # Database seeding scripts
│   ├── import/                   # Import scripts (Viva Goals, etc.)
│   ├── audit/                    # Audit scripts
│   ├── admin/                    # Admin scripts (create-superuser, reset-password, etc.)
│   ├── rbac/                     # RBAC-specific scripts
│   └── db/                       # Database maintenance SQL scripts
├── infra/                        # Infrastructure as code (optional, future)
│   ├── docker/                   # Docker configs (or keep at root)
│   └── keycloak/                 # Keycloak configs (or keep at root)
└── docs/                         # All documentation
    ├── architecture/             # Architecture documentation
    ├── developer/                # Developer guides and standards
    ├── audit/                    # Audit reports and findings
    ├── planning/                 # Planning documents and implementation plans
    └── feature-requests/         # Feature planning and requests
```

### Rules

1. **Runtime Code Separation**
   - `apps/`, `services/`, `packages/` contain **only** runtime application code
   - No scripts, documentation, or operational files in runtime directories
   - Exception: Prisma migrations/seeds remain in `services/core-api/prisma/` (standard Prisma convention)

2. **Scripts Location**
   - All operational scripts live under `scripts/`
   - Scripts are **never** imported by runtime code (enforced via CI)
   - Scripts are organised by purpose (admin, audit, import, etc.)

3. **Documentation Location**
   - All markdown documentation lives under `docs/`
   - Root-level `README.md` is the only exception
   - Documentation is organised by type (architecture, developer, audit, planning)

4. **Database Files**
   - Migrations: `services/core-api/prisma/migrations/` (keep current)
   - Seed script: `services/core-api/prisma/seed.ts` (keep current)
   - Ad-hoc SQL scripts: `scripts/db/`

5. **Infrastructure**
   - Infrastructure configs can remain at root (e.g., `docker-compose.yml`)
   - Or be organised under `infra/` if preferred
   - Current root-level location is acceptable

---

## Recommendations

### High Priority (P0)

1. **Move root-level markdown files to `docs/`**
   - Move audit reports to `docs/audit/`
   - Move planning docs to `docs/planning/`
   - Update README links if needed

2. **Consolidate scripts**
   - Move `services/core-api/scripts/*` to `scripts/admin/`
   - Move root-level scripts to appropriate subdirectories

### Medium Priority (P1)

1. **Organise import data files**
   - Move large JSON files to `.gitignore` or separate data repo
   - Or move to `data/import/` directory

2. **Create `scripts/admin/` directory**
   - Consolidate admin scripts (create-superuser, reset-password, etc.)

3. **Create `scripts/import/` directory**
   - Move import scripts to dedicated folder

### Low Priority (P2)

1. **Consider `infra/` directory**
   - Move Docker/K8s configs if needed
   - Keep current structure if working well

2. **Database scripts organisation**
   - Current location (`services/core-api/prisma/`) is acceptable
   - Consider `db/` directory if preferred

---

## Files Requiring Movement

### Documentation Files (Root → `docs/`)

**Audit Reports** → `docs/audit/`:
- `SECURITY_AUDIT_REPORT.md`
- `ARCHITECTURE_AUDIT_REPORT.md`
- `COMPREHENSIVE_ARCHITECTURE_AUDIT.md`
- `CURRENT_AUDIT_REPORT.md`
- `OBJECTIVES_AUDIT_REPORT.md`
- `TODO_AUDIT_REPORT.md`
- `PERMISSIONS_AUDIT_AND_PLAN.md`
- `RBAC_MIGRATION_COMPLETE.md`
- `RBAC_FULL_MIGRATION_COMPLETE.md`
- `TENANT_ISOLATION_VERIFICATION_REPORT.md`
- `USER_TENANT_ISOLATION_COMPLETE.md`
- `USER_TENANT_ISOLATION_ASSESSMENT.md`
- `USER_TENANT_ISOLATION_IMPLEMENTATION.md`
- `OKR_CORE_COMPLETENESS_AUDIT.md`
- `OKR_ENTERPRISE_READINESS_AUDIT.md`
- `OKR_ENTERPRISE_TECHNICAL_AUDIT.md`
- `OKR_MANAGEMENT_AUDIT_AND_PLAN.md`
- `OKR_PRODUCT_CAPABILITY_AUDIT.md`
- `PERMISSIONS_ENHANCEMENT_PLAN.md`
- `PERMISSIONS_PHASE1_IMPLEMENTATION.md`
- `PERMISSIONS_TEST_PLAN.md`
- `RBAC_UI_TEST_PLAN.md`
- `UI_PERMISSIONS_TEST_PLAN.md`
- `WCAG_II_COMPLIANCE_AUDIT.md`
- `VIVA_GOALS_IMPORT_AUDIT.md`
- `VIVA_GOALS_IMPORT_COVERAGE_ANALYSIS.md`
- `VIVA_GOALS_IMPORT_STATUS.md`
- `VIVA_GOALS_IMPORT_TESTING_GUIDE.md`
- `VIVA_GOALS_IMPORT_TESTING_SUMMARY.md`
- `VIVA_GOALS_JSON_IMPORT_SUMMARY.md`
- `VIVA_GOALS_PARITY_SUMMARY.md`
- `VIVA_GOALS_CSV_IMPORT_GAP_ANALYSIS.md`
- `VIVA_GOALS_FEATURE_GAP_ANALYSIS.md`
- `IMPORT_FIX_SUMMARY.md`
- `IMPORT_SERVICE_ENHANCEMENT_VIVA_GOALS.md`
- `STRUCTURAL_CODE_REVIEW.md`
- `REFACTOR_PLAN_SUMMARY.md`
- `REFACTOR_SCAFFOLDING_SUMMARY.md`
- `REFACTOR_EXAMPLES.md`

**Planning Documents** → `docs/planning/`:
- `P0_*.md` files
- `PHASE*_SUMMARY.md` files
- `*_IMPLEMENTATION.md` files
- `*_IMPLEMENTATION_PLAN.md` files
- `DELIVERY_PLAN.md`
- `DATABASE_CONSOLIDATION_PLAN.md`
- `DATABASE_SCHEMA_DESIGN_VIVA_GOALS.md`
- `IMPLEMENTATION_TICKETS_VIVA_GOALS_PARITY.md`
- `MULTIPLE_OWNERS_IMPLEMENTATION_PLAN.md`
- `EDIT_USER_DIALOG_IMPLEMENTATION_PLAN.md`
- `KEY_RESULT_EDIT_IMPLEMENTATION_PLAN.md`
- `KEY_RESULT_EDIT_UX_IMPROVEMENTS.md`
- `KEY_RESULT_EDIT_VERIFICATION.md`
- `ROLE_SIMPLIFICATION_IMPLEMENTATION_PLAN.md`
- `WORKSPACE_TEAM_IMPLEMENTATION.md`
- `PROGRESS_ROLLUP_AND_ANALYTICS_IMPLEMENTATION.md`
- `VISUAL_BUILDER_ASSESSMENT.md`
- `VISUAL_BUILDER_CHANGELOG.md`
- `VISUAL_BUILDER_FIXES.md`
- `VISUAL_BUILDER_GUIDE.md`
- `VISUAL_BUILDER_IMPROVEMENTS.md`

**Other Documentation** → Appropriate `docs/` subdirectories:
- `GETTING_STARTED.md` → `docs/`
- `TESTING_GUIDE.md` → `docs/developer/`
- `CODING_STANDARDS.md` → `docs/developer/`
- `CONTRIBUTING.md` → `docs/developer/`
- `RELEASE_CHECKLIST.md` → `docs/developer/`
- `DATABASE_ACCESS.md` → `docs/developer/`
- `DATABASE_SETUP_EXPLANATION.md` → `docs/developer/`
- `DATABASE_TABLES_EXPLANATION.md` → `docs/developer/`
- `POSTICO_CONNECTION_GUIDE.md` → `docs/developer/`
- `RESET_PASSWORDS.md` → `docs/developer/`
- `CREATE_SUPERUSER_GUIDE.md` → `docs/developer/`
- `CHECK_USER_ORG.md` → `docs/developer/`
- `ORGANIZATION_FIX_GUIDE.md` → `docs/developer/`
- `QUICK_TEST_GUIDE.md` → `docs/developer/`
- `DOCKER_LOGIN_CREDENTIALS.md` → `docs/developer/` (or remove if sensitive)
- `DOCKER_SEED_COMPLETE.md` → `docs/developer/`

### Script Files

**Admin Scripts** → `scripts/admin/`:
- `services/core-api/scripts/create-superuser.ts`
- `services/core-api/scripts/reset-superuser-password.ts`
- `services/core-api/scripts/reset-user-password.ts`
- `create-superuser.ts` (root)

**Database Scripts** → `scripts/db/` or keep in `services/core-api/prisma/`:
- `fix_users_organization.sql` (root)

**Import Scripts** → `scripts/import/`:
- `scripts/import-viva-goals-json.ts`
- `scripts/setup-and-import-puzzel.ts`
- `scripts/truncate-and-reimport.ts`

**Audit Scripts** → `scripts/audit/`:
- `scripts/audit-tenant-isolation.ts`
- `scripts/okr-scope-validation.ts`
- `scripts/okr-triage-bootstrap.ts`

---

## Remaining Scripts Requiring Movement

### Scripts Still in `services/core-api/scripts/`

The following scripts remain in `services/core-api/scripts/` and should be moved to appropriate `scripts/` subdirectories:

**Admin/Maintenance Scripts** → `scripts/admin/`:
- `assign-role-to-sarah.ts` - One-off admin task
- `backfill-primary-organization-id.ts` - Data migration script
- `check-api-response.ts` - API testing script
- `check-initiatives.ts` - Data validation script
- `check-rbac-debug.ts` - RBAC debugging script
- `check-user-org-membership.ts` - User validation script
- `check-user-permissions.ts` - Permission validation script
- `grant-default-viewer-roles.ts` - Role assignment script
- `migrate-database-5432-to-5433.ts` - Database migration script
- `migrate-rbac.ts` - RBAC migration script
- `migrate-to-simplified-roles.ts` - Role migration script
- `reset-database.ts` - Database reset script
- `setup-puzzel.ts` - Setup script
- `test-progress-aggregation.ts` - Testing script
- `test-rbac-assignments-api.ts` - API testing script
- `test-user-rls.ts` - RLS testing script
- `test-viva-goals-import.ts` - Import testing script
- `truncate-all-tables.ts` - Database maintenance script
- `verify-rls.ts` - RLS verification script
- `verify-user-rls.ts` - User RLS verification script

**Database Scripts** → `scripts/db/`:
- `backfill-cycle-id.sql` - SQL migration script
- `backfill-cycle-id.ts` - TypeScript wrapper for SQL script

**Seed Scripts** → `scripts/seed/` (or keep if tightly coupled to seed process):
- `seed-activity.ts` - Activity seeding helper

**Note**: These scripts have not been moved yet as they may have:
- References in documentation that need updating
- Dependencies on relative paths that need adjustment
- Usage in CI/CD pipelines that needs verification

---

## Mixed / Problematic Files

### Documentation Files in Runtime Directories

The following markdown files exist in `src/` directories but are **not imported** by runtime code. They are documentation-only and should be moved to `docs/`:

**Location**: `services/core-api/src/modules/rbac/`
- `IMPLEMENTATION_SUMMARY.md` → `docs/audit/` or `docs/developer/`
- `MIGRATION_GUIDE.md` → `docs/developer/`
- `COMPLETED_STEPS.md` → `docs/audit/` or `docs/developer/`
- `USAGE_EXAMPLES.md` → `docs/developer/`

**Location**: `services/core-api/src/modules/okr/`
- `README_CHECKINS.md` → `docs/developer/`

**Recommendation**: These files can be safely moved as they are not imported by any TypeScript code. They appear to be developer documentation that was placed alongside the code for convenience.

### Scripts with Potential Dependencies

Some scripts in `services/core-api/scripts/` may have:
- Relative path dependencies that assume execution from `services/core-api/`
- References to local `.env` files or configuration
- Docker container execution paths that reference `/app/services/core-api/`

**Refactor Approach**:
1. Update script paths to use repository root as base
2. Update any relative imports to use absolute paths from repository root
3. Update Docker execution paths in documentation
4. Test scripts after moving to ensure they still work

---

## Summary

### Current State

- ✅ **Scripts**: Mostly well-organised in `scripts/` directory
- ✅ **Documentation**: Well-organised in `docs/` subdirectories
- 🔴 **Root-level docs**: 80+ markdown files need organisation
- ⚠️ **Script consolidation**: Some scripts in `services/core-api/scripts/` should move

### Recommended Actions

1. **Move root-level markdown files** (P0)
   - Audit reports → `docs/audit/`
   - Planning docs → `docs/planning/`
   - Developer guides → `docs/developer/`

2. **Consolidate scripts** (P1)
   - Move admin scripts to `scripts/admin/`
   - Organise import scripts in `scripts/import/`

3. **Update references** (P1)
   - Update README links
   - Update package.json script paths if needed

---

---

## Status

**Last Updated**: 2025-01-20  
**Implementation Phase**: Phase 4 - Scripts, Documentation & Repository Structure

### Files Correctly Placed

**Scripts**: ✅ **100% correctly placed**
- ✅ All admin scripts moved to `scripts/admin/` (13 files)
- ✅ All import scripts moved to `scripts/import/` (3 files)
- ✅ All audit scripts moved to `scripts/audit/` (6 files)
- ✅ All migration scripts moved to `scripts/migrate/` (3 files)
- ✅ All test scripts moved to `scripts/test/` (4 files)
- ✅ Database SQL scripts moved to `scripts/db/` (4 files)
- ✅ Seed helper scripts moved to `scripts/seed/` (1 file)
- ✅ `services/core-api/scripts/` directory is now empty

**Documentation**: ✅ **100% correctly placed**
- ✅ All audit reports moved to `docs/audit/` (~40 files)
- ✅ All planning documents moved to `docs/planning/` (~30 files)
- ✅ All developer guides moved to `docs/developer/` (~20 files)
- ✅ All markdown files moved from `src/` directories to `docs/` (6 files)
- ✅ Root-level `README.md` kept at root (correct)
- ✅ `CHANGELOG.md` kept at root (standard practice)
- ✅ No markdown files remain in `src/` directories

**References Updated**: ✅ **100% complete**
- ✅ `package.json` script paths updated
- ✅ `services/core-api/package.json` script paths updated
- ✅ `README.md` links updated
- ✅ All developer guide references updated
- ✅ All audit report references updated
- ✅ `scripts/check-no-script-imports.ts` updated (removed `services/core-api/scripts` from scan)

### Categories Remaining to Clean Up

✅ **All cleanup tasks completed!**

1. ✅ **Remaining Scripts in `services/core-api/scripts/`** - **COMPLETE**
   - All 23+ scripts moved to appropriate `scripts/` subdirectories
   - `services/core-api/scripts/` directory is now empty

2. ✅ **Documentation Files in `src/` Directories** - **COMPLETE**
   - All 6 markdown files moved from `src/` directories to `docs/`
   - No markdown files remain in runtime code directories

3. ✅ **Documentation References** - **COMPLETE**
   - All references to old script paths updated in documentation
   - All audit reports, planning docs, and developer guides updated

4. ✅ **Script Path Updates** - **COMPLETE**
   - `scripts/check-no-script-imports.ts` updated (removed `services/core-api/scripts` from scan list)
   - All package.json script paths updated
   - Docker execution paths documented in updated guides

### Final Structure

The repository now follows the authoritative structure defined in this audit:
- ✅ All scripts in `scripts/` subdirectories (admin, audit, db, dev, import, migrate, rbac, seed, test)
- ✅ All documentation in `docs/` subdirectories (architecture, audit, developer, planning, feature-requests)
- ✅ Runtime code directories (`apps/`, `services/`, `packages/`) contain only runtime code
- ✅ Clean separation enforced via CI checks

---

**End of Scripts and Documentation Structure Audit**

