# Seed Idempotency Strategy

**Generated:** 2025-01-XX  
**Purpose:** Document deterministic ID generation and idempotent seed execution strategy

---

## 1. ID Generation Strategy

### UUIDv5 Namespace

**Base Namespace UUID:** `6ba7b810-9dad-11d1-80b4-00c04fd430c8` (DNS namespace)

**Custom Namespace UUIDs:**
- **Organisation:** `6ba7b811-9dad-11d1-80b4-00c04fd430c8`
- **Workspace:** `6ba7b812-9dad-11d1-80b4-00c04fd430c8`
- **Team:** `6ba7b813-9dad-11d1-80b4-00c04fd430c8`
- **User:** `6ba7b814-9dad-11d1-80b4-00c04fd430c8`
- **Cycle:** `6ba7b815-9dad-11d1-80b4-00c04fd430c8`
- **Objective:** `6ba7b816-9dad-11d1-80b4-00c04fd430c8`
- **KeyResult:** `6ba7b817-9dad-11d1-80b4-00c04fd430c8`
- **Initiative:** `6ba7b818-9dad-11d1-80b4-00c04fd430c8`
- **StrategicPillar:** `6ba7b819-9dad-11d1-80b4-00c04fd430c8`

### Natural Key Patterns

**Organisation:**
- Input: `slug` (e.g., `"puzzel-cx-demo"`)
- UUIDv5: `uuidv5(organisationNamespace, slug)`

**Workspace:**
- Input: `organisationId + ":" + slug` (e.g., `"<org-id>:sales"`)
- UUIDv5: `uuidv5(workspaceNamespace, orgId + ":" + slug)`

**Team:**
- Input: `workspaceId + ":" + slug` (e.g., `"<workspace-id>:enterprise-sales"`)
- UUIDv5: `uuidv5(teamNamespace, workspaceId + ":" + slug)`

**User:**
- Input: `email` (e.g., `"founder@puzzelcx.local"`)
- UUIDv5: `uuidv5(userNamespace, email)`

**Cycle:**
- Input: `organisationId + ":" + name` (e.g., `"<org-id>:Q4 2025"`)
- UUIDv5: `uuidv5(cycleNamespace, orgId + ":" + name)`

**Objective:**
- Input: `organisationId + ":" + scopeType + ":" + scopeId + ":" + cycleId + ":" + title` (e.g., `"<org-id>:tenant::<cycle-id>:Improve Customer Satisfaction"`)
- UUIDv5: `uuidv5(objectiveNamespace, compositeKey)`
- **Note:** For tenant-level: `scopeType = "tenant"`, `scopeId = ""`
- **Note:** For workspace-level: `scopeType = "workspace"`, `scopeId = workspaceId`
- **Note:** For team-level: `scopeType = "team"`, `scopeId = teamId`

**KeyResult:**
- Input: `objectiveId + ":" + title` (e.g., `"<obj-id>:Raise NPS from 60 to 75"`)
- UUIDv5: `uuidv5(keyResultNamespace, objectiveId + ":" + title)`

**Initiative:**
- Input: `objectiveId + ":" + title` (e.g., `"<obj-id>:Deploy Customer Feedback Portal"`)
- UUIDv5: `uuidv5(initiativeNamespace, objectiveId + ":" + title)`

**StrategicPillar:**
- Input: `organisationId + ":" + name` (e.g., `"<org-id>:Customer Experience Quality"`)
- UUIDv5: `uuidv5(strategicPillarNamespace, orgId + ":" + name)`

---

## 2. Idempotent Upsert Patterns

### Organisation

```typescript
await prisma.organization.upsert({
  where: { slug: 'puzzel-cx-demo' },
  update: {
    name: 'Puzzel CX Demo',
    // Preserve existing metadata if present
  },
  create: {
    id: generateOrgId('puzzel-cx-demo'),
    slug: 'puzzel-cx-demo',
    name: 'Puzzel CX Demo',
    // ... other fields
  },
});
```

### Workspace

```typescript
await prisma.workspace.upsert({
  where: {
    organizationId_slug: {
      organizationId: orgId,
      slug: 'sales',
    },
  },
  update: {
    name: 'Sales',
  },
  create: {
    id: generateWorkspaceId(orgId, 'sales'),
    organizationId: orgId,
    name: 'Sales',
    slug: 'sales',
  },
});
```

**Note:** If `organizationId_slug` unique constraint doesn't exist, use `findFirst` + `create`/`update` pattern:

```typescript
const existing = await prisma.workspace.findFirst({
  where: { organizationId: orgId, name: 'Sales' },
});

if (existing) {
  await prisma.workspace.update({
    where: { id: existing.id },
    data: { /* updates */ },
  });
} else {
  await prisma.workspace.create({
    data: {
      id: generateWorkspaceId(orgId, 'sales'),
      /* ... */
    },
  });
}
```

### User

```typescript
await prisma.user.upsert({
  where: { email: 'founder@puzzelcx.local' },
  update: {
    name: 'Founder',
    isSuperuser: false,
    // Preserve passwordHash if exists
  },
  create: {
    id: generateUserId('founder@puzzelcx.local'),
    email: 'founder@puzzelcx.local',
    name: 'Founder',
    isSuperuser: false,
    passwordHash: await hashPassword('changeme'),
  },
});
```

### Cycle

```typescript
await prisma.cycle.upsert({
  where: {
    organizationId_name: {
      organizationId: orgId,
      name: 'Q4 2025',
    },
  },
  update: {
    status: 'ACTIVE',
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-12-31'),
  },
  create: {
    id: generateCycleId(orgId, 'Q4 2025'),
    organizationId: orgId,
    name: 'Q4 2025',
    status: 'ACTIVE',
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-12-31'),
    isStandard: true,
  },
});
```

**Note:** If unique constraint doesn't exist, use `findFirst` + `create`/`update`.

### Objective

```typescript
// Use findFirst with composite key
const existing = await prisma.objective.findFirst({
  where: {
    organizationId: orgId,
    workspaceId: workspaceId || null,
    teamId: teamId || null,
    cycleId: cycleId,
    title: 'Improve Customer Satisfaction',
  },
});

if (existing) {
  await prisma.objective.update({
    where: { id: existing.id },
    data: { /* updates */ },
  });
} else {
  await prisma.objective.create({
    data: {
      id: generateObjectiveId(orgId, scopeType, scopeId, cycleId, title),
      /* ... */
    },
  });
}
```

### Role Assignment

```typescript
await prisma.roleAssignment.upsert({
  where: {
    userId_role_scopeType_scopeId: {
      userId: userId,
      role: 'TENANT_OWNER',
      scopeType: 'TENANT',
      scopeId: orgId,
    },
  },
  update: {}, // No updates needed for role assignments
  create: {
    id: generateRoleAssignmentId(userId, role, scopeType, scopeId),
    userId: userId,
    role: 'TENANT_OWNER',
    scopeType: 'TENANT',
    scopeId: orgId,
  },
});
```

---

## 3. Date Generation Strategy

### Anchored Dates

**Timezone:** Europe/London (UTC+0/+1)

**Cycle Dates:**
- Q4 2025: 2025-10-01 to 2025-12-31
- Q1 2026: 2026-01-01 to 2026-03-31
- Q2 2026: 2026-04-01 to 2026-06-30
- Q3 2026: 2026-07-01 to 2026-09-30

**Objective Dates:**
- Inherit from cycle start/end dates
- Can add small offsets for realistic distribution

**Check-in Dates:**
- Use `Date.now()` minus deterministic offsets (days ago)
- Overdue: 14+ days ago
- Recent: 0-7 days ago
- No progress: 14+ days ago

### Randomness via Seeded PRNG

**Library:** `seedrandom` (or similar)

**Seed:** Fixed seed value (e.g., `"puzzel-cx-demo-seed-2025"`)

**Usage:**
```typescript
import seedrandom from 'seedrandom';

const rng = seedrandom('puzzel-cx-demo-seed-2025');

// Generate reproducible random numbers
const randomValue = rng(); // Always same sequence
```

**Applications:**
- Progress percentages (0-100)
- Status distributions (ON_TRACK, AT_RISK, etc.)
- Check-in date offsets
- Manager chain assignments

---

## 4. Deterministic Email Generation

**Pattern:** `{role}-{index}@puzzelcx.local`

**Examples:**
- `founder@puzzelcx.local`
- `admin1@puzzelcx.local` through `admin5@puzzelcx.local`
- `workspace-lead-sales-1@puzzelcx.local`
- `team-lead-enterprise-sales-1@puzzelcx.local`
- `member-sales-1@puzzelcx.local` through `member-sales-50@puzzelcx.local`

**Superuser:**
- `platform@puzzelcx.local` (outside tenant)

---

## 5. Manager Chain Assignment

**Strategy:** Deterministic based on user index

**Algorithm:**
1. Sort users by email (deterministic order)
2. Assign managerId based on index pattern:
   - Top 1: No manager (founder)
   - Next 5: Manager = founder
   - Next 15: Manager = one of first 5 (round-robin)
   - Next 24: Manager = one of next 15 (round-robin)
   - Remainder: Manager = one of next 24 (round-robin)

**Result:** Consistent org chart structure across seed runs

---

## 6. Slug Generation

**Pattern:** Convert name to slug (lowercase, hyphens)

**Examples:**
- "Enterprise Sales" → `enterprise-sales`
- "Tier 1 Support" → `tier-1-support`
- "Q4 2025" → `q4-2025`

**Function:**
```typescript
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

---

## 7. Batch Operations & Transactions

### Chunking Strategy

**Chunk Size:** 1000 rows maximum

**Bulk Inserts:**
```typescript
async function createManyChunked<T>(
  prisma: PrismaClient,
  model: string,
  data: T[],
  chunkSize: number = 1000,
): Promise<void> {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${model} ... VALUES ...`,
      // Or use createMany if supported
    );
  }
}
```

### Transaction Wrapping

**Pattern:** Wrap related entities in transactions

```typescript
await prisma.$transaction(async (tx) => {
  // Create objective
  const objective = await tx.objective.create({ ... });
  
  // Create key results
  await tx.keyResult.createMany({ data: keyResults });
  
  // Create initiatives
  await tx.initiative.createMany({ data: initiatives });
  
  // Link KRs to objective
  await tx.objectiveKeyResult.createMany({ data: links });
});
```

**Benefits:**
- Atomicity: All or nothing
- Performance: Single round-trip
- Consistency: Referential integrity maintained

---

## 8. Idempotency Validation

### Pre-Seed Checks

```typescript
// Check if tenant already exists
const existing = await prisma.organization.findUnique({
  where: { slug: 'puzzel-cx-demo' },
});

if (existing && !options.purge) {
  throw new Error('Tenant already exists. Use --purge to remove first.');
}
```

### Post-Seed Verification

```typescript
// Verify counts match expected
const userCount = await prisma.user.count({
  where: { email: { contains: '@puzzelcx.local' } },
});

if (userCount !== 200) {
  throw new Error(`Expected 200 users, found ${userCount}`);
}
```

---

## 9. Error Handling & Retries

### Lock Contention

**Detection:** PostgreSQL lock timeout errors

**Strategy:** Retry with exponential backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === '40P01' && i < maxRetries - 1) { // Lock timeout
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
}
```

### Deadlock Prevention

**Order:** Always insert in dependency order:
1. Organisation
2. Workspaces
3. Teams
4. Users
5. Cycles
6. Strategic Pillars
7. Objectives
8. Key Results
9. Initiatives
10. Check-ins
11. Role Assignments

---

## 10. Seed Execution Modes

### Dry Run

**Behaviour:** Calculate counts, print plan, no database writes

**Output:** `docs/audit/SEED_DRY_RUN_REPORT.md`

### Full Seed

**Behaviour:** Execute all seed scripts, create/update data

**Idempotency:** Re-runnable without duplicates

### Purge

**Behaviour:** Delete seeded tenant and all related data

**Safety:** Only delete tenant with matching slug

**Order:** Delete in reverse dependency order (respects CASCADE deletes)

---

## 11. Methods Used in Implementation

### Upsert Patterns
- `prisma.organization.upsert()` - Uses `slug` unique constraint
- `prisma.roleAssignment.upsert()` - Uses `userId_role_scopeType_scopeId` unique constraint
- `prisma.objectiveKeyResult.upsert()` - Uses `objectiveId_keyResultId` unique constraint

### Find-First + Create/Update Pattern
- Used for entities without unique constraints on natural keys:
  - Workspaces: `findFirst({ organizationId, name })` + `create`/`update`
  - Teams: `findFirst({ workspaceId, name })` + `create`/`update`
  - Cycles: `findFirst({ organizationId, name })` + `create`/`update`
  - Objectives: `findFirst({ organizationId, workspaceId, teamId, cycleId, title })` + `create`/`update`
  - Key Results: `findFirst({ title, ownerId, cycleId })` + `create`/`update`
  - Initiatives: `findFirst({ objectiveId, title })` + `create`/`update`

### Transaction Wrapping
- Objective + KRs + Initiatives wrapped in `prisma.$transaction()`
- Ensures atomicity for related entities
- Prevents partial OKR creation

### Batch Operations
- Role assignments: Individual upserts (small volume, needs idempotency)
- Check-ins: Individual creates (moderate volume, deterministic dates)
- Future optimisation: Use `createMany` with `skipDuplicates` where possible

### Retry Logic
- Not yet implemented (can be added for lock contention)
- Recommended: Exponential backoff for PostgreSQL error code `40P01`

---

## Summary

- **ID Generation:** UUIDv5 from natural keys (email, slug, composite keys)
- **Upsert Pattern:** `upsert` where unique constraints exist, `findFirst` + `create`/`update` otherwise
- **Dates:** Anchored to real calendar (Europe/London)
- **Randomness:** Seeded PRNG for reproducible results
- **Batch Operations:** Chunked at 1000 rows, wrapped in transactions
- **Idempotency:** Re-runnable without duplicates
- **Error Handling:** Retry with backoff for lock contention

