# Seed Suite README

**Purpose:** Large-organisation seed suite for provisioning realistic OKR data (~200 users, 6 workspaces, ~20 teams)

---

## Quick Start

```bash
# Dry run (no database writes)
npm run seed:dry

# Run seed
npm run seed:run -- --tenant=puzzel-cx-demo

# Purge seeded tenant
npm run seed:purge -- --tenant=puzzel-cx-demo

# Generate report
npm run seed:report
```

---

## Structure

```
scripts/seed/
  00_env_check.ts               # Verifies DB connection
  01_bootstrap_tenant.ts        # Tenant + owner + superuser
  02_workspaces_teams.ts        # Workspaces and teams
  03_users_and_roles.ts         # Users and RBAC assignments
  04_cycles.ts                  # OKR cycles
  05_okrs_objectives_krs.ts     # Objectives, Key Results, Initiatives
  06_initiatives.ts             # Initiatives (created with OKRs)
  07_checkins_and_requests.ts   # Check-ins and attention items
  08_rbac_whitelists.ts         # PRIVATE visibility whitelists
  09_feature_flags.ts           # Feature flags (rbacInspector)
  10_sanity_probes.sql          # SQL validation queries
  run.ts                        # Orchestrator
  README.md                     # This file

prisma/factories/
  ids.ts                        # UUIDv5 ID generation
  rng.ts                        # Seeded random number generator
  users.ts                      # User factory
  cycles.ts                     # Cycle factory
  teams.ts                      # Team factory
  okrs.ts                       # OKR factory
```

---

## Features

- **Idempotent:** Re-runnable without duplicates
- **Deterministic:** UUIDv5 IDs from natural keys
- **Realistic:** ~200 users, org chart, OKRs across levels
- **Governance:** Publish locks, PRIVATE visibility, cycle states
- **Attention:** Overdue check-ins, no-progress signals

---

## Target Data

- **1 tenant:** Puzzel CX Demo
- **6 workspaces:** Sales, Support, Marketing, Product, Engineering, People
- **20 teams:** 3-4 per workspace
- **~200 users:** Distributed roles, org chart
- **4 cycles:** Q4 2025 (ACTIVE), Q1 2026 (ACTIVE), Q2 2026 (DRAFT), Q3 2026 (ARCHIVED)
- **~260 objectives:** Tenant, workspace, team levels
- **~780 key results:** With check-in cadences
- **~520 initiatives:** Linked to objectives
- **~2000 check-ins:** With overdue items
- **~30 check-in requests:** Manager-requested

---

## Validation

After seeding, run SQL probes from `10_sanity_probes.sql`:

```bash
psql $DATABASE_URL -f scripts/seed/10_sanity_probes.sql
```

See `docs/audit/SEED_VALIDATION_GUIDE.md` for manual checks.

---

## Notes

- All users have password: `changeme`
- SUPERUSER: `platform@puzzelcx.local` (read-only, outside tenant)
- TENANT_OWNER: `founder@puzzelcx.local`
- Seed respects tenant isolation and RBAC rules
- No TODO/FIXME/HACK comments in production code

