# Seed Performance Notes

**Generated:** 2025-01-XX  
**Purpose:** Performance considerations and optimisations for seed execution

---

## 1. Bulk Operations

### Chunking Strategy

**Chunk Size:** 1000 rows maximum

**Rationale:**
- Prevents PostgreSQL lock timeouts
- Avoids memory pressure
- Allows progress tracking

**Implementation:**
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
    );
  }
}
```

---

## 2. Transaction Wrapping

### Pattern

Wrap related entities in transactions for atomicity:

```typescript
await prisma.$transaction(async (tx) => {
  const objective = await tx.objective.create({ ... });
  await tx.keyResult.createMany({ data: keyResults });
  await tx.initiative.createMany({ data: initiatives });
  await tx.objectiveKeyResult.createMany({ data: links });
});
```

**Benefits:**
- Atomicity: All or nothing
- Performance: Single round-trip
- Consistency: Referential integrity maintained

**Limitations:**
- Transaction size limit (~10k rows)
- Use for related entities only

---

## 3. Index Usage

### Critical Indexes

Seed leverages existing indexes:
- `users.email` (unique)
- `organizations.slug` (unique)
- `role_assignments.userId_role_scopeType_scopeId` (unique)
- `objectives.organizationId`
- `key_results.cycleId`
- `check_ins.keyResultId`

**Impact:**
- Fast lookups for idempotency checks
- Efficient joins for validation queries

---

## 4. Referential Integrity

### Insert Order

**Critical:** Insert parents before children:

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

**Foreign Keys:**
- Cascade deletes: Safe for cleanup
- Set null: Preserves data integrity

---

## 5. Error Handling & Retries

### Lock Contention

**Detection:** PostgreSQL error code `40P01` (lock timeout)

**Strategy:** Exponential backoff retry

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === '40P01' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
}
```

### Deadlock Prevention

**Order:** Always insert in dependency order
**Locks:** Use row-level locks where possible
**Timeout:** 5-10s backoff on contention

---

## 6. Database Connection Pooling

### Configuration

**Prisma Client:**
- Connection limit: 10 (default)
- Timeout: 20s

**Considerations:**
- Multiple concurrent seeds: Increase pool size
- Long-running seeds: Enable connection keep-alive

---

## 7. Memory Usage

### Stream Processing

**Pattern:** Process data in batches to avoid memory pressure

```typescript
const BATCH_SIZE = 1000;
for (let i = 0; i < allData.length; i += BATCH_SIZE) {
  const batch = allData.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
}
```

### Large Datasets

**For ~200 users, ~260 objectives:**
- Memory usage: ~50-100MB
- Processing time: ~2-5 minutes

---

## 8. Performance Targets

### Seed Execution Time

**Target:** < 5 minutes for full seed

**Breakdown:**
- Bootstrap tenant: < 5s
- Workspaces/teams: < 10s
- Users/roles: < 60s
- Cycles: < 5s
- OKRs: < 120s
- Check-ins: < 60s
- Validation: < 10s

**Total:** ~4-5 minutes

### Query Performance

**Targets:**
- Idempotency checks: < 100ms
- Bulk inserts: < 500ms per 1000 rows
- Validation queries: < 1s

---

## 9. Optimisations

### Pre-computed IDs

**Benefit:** Avoid UUID generation overhead

**Implementation:**
- Generate IDs upfront using UUIDv5
- Store in memory for reuse
- Faster than per-row generation

### Batch Upserts

**Pattern:** Use `createMany` with `skipDuplicates` where possible

```typescript
await prisma.objective.createMany({
  data: objectives,
  skipDuplicates: true,
});
```

**Note:** Requires unique constraint on natural key

---

## 10. Monitoring

### Progress Tracking

**Implementation:**
- Log progress after each major step
- Estimate remaining time
- Track errors and retries

### Metrics

**Track:**
- Total execution time
- Per-step timing
- Database query count
- Error rate
- Retry count

---

## Summary

- **Chunking:** 1000 rows max per batch
- **Transactions:** Wrap related entities
- **Indexes:** Leverage existing indexes
- **Order:** Insert parents before children
- **Retries:** Exponential backoff for locks
- **Memory:** Process in batches
- **Target:** < 5 minutes total execution
- **Monitoring:** Track progress and errors

