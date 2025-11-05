# Seed Data Plan

**Generated:** 2025-01-XX  
**Purpose:** Concrete data model with volumes and distributions for large-organisation seed suite

---

## Target Organisation: Puzzel CX Demo

**Tenant:** 1 organisation
- Name: "Puzzel CX Demo"
- Slug: `puzzel-cx-demo`
- Domain: `@puzzelcx.local`

---

## 1. Organisation Structure

### Workspaces (6 total)
1. **Sales** (slug: `sales`)
2. **Support** (slug: `support`)
3. **Marketing** (slug: `marketing`)
4. **Product** (slug: `product`)
5. **Engineering** (slug: `engineering`)
6. **People** (slug: `people`)

### Teams (~20 total, 3-4 per workspace)

**Sales** (3 teams):
- Enterprise Sales
- SMB Sales
- Account Management

**Support** (4 teams):
- Tier 1 Support
- Tier 2 Support
- Technical Support
- Customer Success

**Marketing** (3 teams):
- Content Marketing
- Demand Generation
- Product Marketing

**Product** (3 teams):
- Product Management
- User Research
- Design

**Engineering** (4 teams):
- Backend Engineering
- Frontend Engineering
- DevOps
- Platform Engineering

**People** (3 teams):
- HR Operations
- Talent Acquisition
- Learning & Development

**Total:** 20 teams

---

## 2. User Distribution (~200 users)

### Role Distribution

**Platform Level:**
- 1 SUPERUSER (read-only, outside tenant RBAC)
  - Email: `platform@puzzelcx.local`

**Tenant Level:**
- 1 TENANT_OWNER
  - Email: `founder@puzzelcx.local`
- 5 TENANT_ADMIN
  - Emails: `admin1@puzzelcx.local` through `admin5@puzzelcx.local`

**Workspace Level:**
- 24 WORKSPACE_LEAD (~4 per workspace)
  - 1 per workspace, plus 1 additional per larger workspaces (Support, Engineering)

**Team Level:**
- 24 TEAM_LEAD (~1-2 per team)
  - 1 per team, with some teams having 2 leads

**Remainder:**
- ~145 users distributed as:
  - WORKSPACE_MEMBER (majority)
  - TEAM_CONTRIBUTOR
  - TEAM_VIEWER (minority)

**Special Flags:**
- 5 users with `rbacInspector = true` (settings: `{ debug: { rbacInspectorEnabled: true } }`)
  - Include: founder, 2 admins, 2 workspace leads

### Org Chart Structure

**Manager Chain Depth:** 1-4 levels

**Top Level (C-Level):**
- Founder (TENANT_OWNER) - manages 5 TENANT_ADMINs

**Level 2 (Department Heads):**
- 15 managers (WORKSPACE_LEADs)
  - Each manages 6-12 direct reports

**Level 3 (Team Leads):**
- 24 managers (TEAM_LEADs)
  - Each manages 4-8 direct reports

**Level 4 (Individual Contributors):**
- Remainder report to team leads or workspace leads

**Total Manager Count:** ~40 managers (15 workspace leads + 24 team leads + 1 founder)

---

## 3. Cycles

### Q4 2025 (ACTIVE)
- **Name:** "Q4 2025"
- **Status:** ACTIVE
- **Start Date:** 2025-10-01
- **End Date:** 2025-12-31
- **isStandard:** true

### Q1 2026 (ACTIVE)
- **Name:** "Q1 2026"
- **Status:** ACTIVE
- **Start Date:** 2026-01-01
- **End Date:** 2026-03-31
- **isStandard:** true

### Q2 2026 (PLANNED)
- **Name:** "Q2 2026"
- **Status:** DRAFT
- **Start Date:** 2026-04-01
- **End Date:** 2026-06-30
- **isStandard:** true

### Q3 2026 (ARCHIVED)
- **Name:** "Q3 2026"
- **Status:** ARCHIVED
- **Start Date:** 2026-07-01
- **End Date:** 2026-09-30
- **isStandard:** true

**Note:** No "Unassigned/Backlog" cycles

---

## 4. OKR Distribution

### Tenant-Level OKRs (6-8 total)

**Q4 2025:**
- 6 tenant-level OKRs
  - 5 PUBLIC_TENANT
  - 1 PRIVATE (Exec/HR confidential)

**Q1 2026:**
- 7 tenant-level OKRs
  - 6 PUBLIC_TENANT
  - 1 PRIVATE

**Q2 2026:**
- 8 tenant-level OKRs (all DRAFT, isPublished = false)
  - 7 PUBLIC_TENANT
  - 1 PRIVATE

**Q3 2026 (ARCHIVED):**
- 6 tenant-level OKRs (all completed, isPublished = true)
  - All PUBLIC_TENANT

### Workspace-Level OKRs (3-5 per workspace)

**Per Workspace:**
- Q4 2025: 4 OKRs (70% published)
- Q1 2026: 4 OKRs (70% published)
- Q2 2026: 3 OKRs (all drafts)
- Q3 2026: 4 OKRs (archived, completed)

**Total Workspace OKRs:** 6 workspaces × 4 cycles × ~4 OKRs = ~96 OKRs

### Team-Level OKRs (2-3 per team)

**Per Team:**
- Q4 2025: 2 OKRs (70% published)
- Q1 2026: 2 OKRs (70% published)
- Q2 2026: 2 OKRs (all drafts)
- Q3 2026: 2 OKRs (archived)

**Total Team OKRs:** 20 teams × 4 cycles × 2 OKRs = ~160 OKRs

### Objective Composition

**Each Objective:**
- 2-4 Key Results (average: 3)
- 1-3 Initiatives (average: 2)

**Publish State Distribution (ACTIVE cycles):**
- ~70% published (`isPublished = true`)
- ~30% draft (`isPublished = false`)

**PLANNED cycles:**
- 100% draft (`isPublished = false`)

**ARCHIVED cycles:**
- 100% published (`isPublished = true`)

### Visibility Distribution

**Default:** PUBLIC_TENANT (majority)

**PRIVATE Objectives:**
- Tenant-level: 1-2 per cycle (Exec/HR confidential)
- Workspace-level: 0-1 per workspace per cycle
- Team-level: 0-1 per team per cycle

**Total PRIVATE Objectives:** ~15-20 across all cycles

**Whitelist Coverage:**
- PRIVATE objectives whitelist: Include founder, 2-3 admins, relevant workspace leads

---

## 5. Key Results Distribution

**Total KRs:** ~780 (260 objectives × 3 KRs average)

**Per Cycle:**
- Q4 2025: ~195 KRs (65 objectives × 3)
- Q1 2026: ~195 KRs (65 objectives × 3)
- Q2 2026: ~174 KRs (58 objectives × 3)
- Q3 2026: ~216 KRs (72 objectives × 3)

**Check-in Cadence Distribution:**
- WEEKLY: 40%
- BIWEEKLY: 35%
- MONTHLY: 20%
- NONE: 5%

**Status Distribution (ACTIVE cycles):**
- ON_TRACK: 60%
- AT_RISK: 25%
- OFF_TRACK: 5%
- COMPLETED: 10%

---

## 6. Initiatives Distribution

**Total Initiatives:** ~520 (260 objectives × 2 initiatives average)

**Per Cycle:**
- Q4 2025: ~130 initiatives
- Q1 2026: ~130 initiatives
- Q2 2026: ~116 initiatives
- Q3 2026: ~144 initiatives

**Status Distribution (ACTIVE cycles):**
- IN_PROGRESS: 60%
- NOT_STARTED: 25%
- COMPLETED: 10%
- BLOCKED: 5%

---

## 7. Check-ins & Attention Items

### Check-in Distribution

**Total Check-ins:** ~2000 check-ins across all cycles

**Per Active Cycle:**
- Q4 2025: ~500 check-ins
- Q1 2026: ~500 check-ins

**Check-in Distribution:**
- Recent (within 7 days): 60%
- Overdue (14+ days for WEEKLY cadence): 10-15%
- No progress (14+ days since last check-in): 15-25%
- Normal (7-14 days): 20-25%

### Attention Items (Designed)

**Overdue KRs (10-15%):**
- WEEKLY cadence KRs with last check-in > 7 days ago
- BIWEEKLY cadence KRs with last check-in > 14 days ago
- MONTHLY cadence KRs with last check-in > 30 days ago

**No Progress (15-25%):**
- KRs with last check-in > 14 days ago
- No status change in 14 days

**Manager-Requested Check-ins:**
- ~10-15 check-in requests per cycle
- Status: OPEN (60%), SUBMITTED (30%), LATE (10%)

---

## 8. Summary Counts

| Entity | Count | Notes |
|--------|-------|-------|
| **Organisations** | 1 | Puzzel CX Demo |
| **Workspaces** | 6 | Sales, Support, Marketing, Product, Engineering, People |
| **Teams** | 20 | 3-4 per workspace |
| **Users** | ~200 | Distributed across roles |
| **Cycles** | 4 | Q4 2025 (ACTIVE), Q1 2026 (ACTIVE), Q2 2026 (DRAFT), Q3 2026 (ARCHIVED) |
| **Objectives** | ~260 | Mix of tenant, workspace, team level |
| **Key Results** | ~780 | 2-4 per objective |
| **Initiatives** | ~520 | 1-3 per objective |
| **Check-ins** | ~2000 | Distributed across active cycles |
| **Check-in Requests** | ~30 | Manager-requested check-ins |
| **Role Assignments** | ~250 | Overlapping roles allowed |
| **Strategic Pillars** | 4-6 | Tenant-level strategic themes |

---

## 9. Data Generation Strategy

### Deterministic Generation
- All IDs generated via UUIDv5 from natural keys
- Names, emails, slugs generated deterministically
- Dates anchored to real calendar (Europe/London timezone)
- Randomness via seeded PRNG (seedrandom) for reproducible results

### Realistic Content
- OKR titles reference realistic business goals
- KRs include realistic metrics (percentages, counts, timeframes)
- Check-in notes include realistic blockers and progress updates
- Manager chains reflect realistic org structures

### Volume Distribution
- Tenant-level: Strategic OKRs (fewer, higher visibility)
- Workspace-level: Department goals (medium volume)
- Team-level: Tactical OKRs (higher volume, focused scope)

---

## 10. Validation Targets

After seed completion, verify:
- ✅ ~200 users created
- ✅ 6 workspaces, 20 teams
- ✅ 4 cycles with correct statuses
- ✅ ~260 objectives across levels
- ✅ ~780 KRs with check-in cadences
- ✅ ~520 initiatives
- ✅ Attention feed shows > 0 items
- ✅ Overdue KRs present (10-15% of active KRs)
- ✅ PRIVATE objectives visible only to whitelisted users
- ✅ SUPERUSER cannot mutate OKRs
- ✅ Cycle selector shows all 4 cycles correctly

