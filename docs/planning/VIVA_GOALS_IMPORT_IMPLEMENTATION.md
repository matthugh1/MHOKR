# Viva Goals CSV Import Implementation

**Date:** 2025-01-20  
**Status:** ✅ **Complete** (Phase 1-3)

---

## Summary

Successfully implemented Viva Goals CSV import functionality for the OKR Framework application. The implementation includes database schema changes, CSV parsing, data transformation, and a REST API endpoint.

---

## What Was Implemented

### Phase 1: Database Schema ✅

**Files Modified:**
- `services/core-api/prisma/schema.prisma`
- `services/core-api/prisma/migrations/20250120000000_add_import_tracking_fields/migration.sql`

**Changes:**
- Added `externalId`, `source`, `importedAt`, `importedBy` fields to `Objective` model
- Added `externalId`, `source`, `importedAt`, `importedBy` fields to `KeyResult` model
- Added unique constraint: `@@unique([tenantId, source, externalId])` on both models
- Added indexes: `@@index([source, externalId])` on both models
- Added relations to `User` model for `importedBy` field

**Migration:**
- Created migration file with SQL to add columns, foreign keys, indexes, and unique constraints
- Uses partial unique index (WHERE clause) to allow NULL values

---

### Phase 2: CSV Parser Service ✅

**File Created:**
- `services/core-api/src/modules/okr/viva-goals-csv-parser.service.ts`

**Features:**
- Parses Viva Goals CSV format with proper handling of quoted fields
- Extracts all CSV columns including:
  - Basic fields: Id, Title, Team, Creator, Owner, Period, Dates, Description
  - Complex fields: "Aligned To (weight, Objective ID)" with regex parsing
  - Progress fields: Progress %, Actual Progress, Status
  - Object type routing: Objective, Key result, Deliverable
- Handles comma-separated owners
- Handles semicolon-separated teams (takes first)
- Parses "Aligned To" format: `"Title(weight: X%, Id: Y)"`
- Returns structured `ParsedVivaGoalsRow` objects

---

### Phase 3: Import Service ✅

**File Created:**
- `services/core-api/src/modules/okr/okr-import.service.ts`

**Features:**

1. **Data Transformation:**
   - Status mapping: Viva Goals → OKRStatus enum
     - "Not Started" → `NOT_STARTED`
     - "On Track" → `ON_TRACK`
     - "At Risk" → `AT_RISK`
     - "Behind" → `AT_RISK`
     - "Off Track" → `OFF_TRACK`
     - "Closed"/"Completed" → `COMPLETED`
     - "Postponed"/"Cancelled" → `CANCELLED`

2. **Goal Type Mapping:**
   - "Aspirational Goal" → `ASPIRATIONAL`
   - "Committed Goal" → `COMMITTED`

3. **Metric Type Inference:**
   - Infers from Start/Target relationship:
     - Start < Target → `INCREASE`
     - Start > Target → `DECREASE`
     - Start = Target → `MAINTAIN`
     - Start=0, Target=100, Unit="%" → `REACH`

4. **Current Value Calculation:**
   - Calculates absolute value from percentage:
     - `currentValue = startValue + (actualProgress / 100.0 * (targetValue - startValue))`

5. **User Name Resolution:**
   - Exact name matching (case-insensitive)
   - Looks up users by `name` field within tenant
   - Handles multiple owners (first → ownerId, rest → contributors)

6. **Cycle Resolution:**
   - Finds existing cycle by name and dates
   - Creates new cycle if not found
   - Uses `OkrCycleService.create()`

7. **Team Resolution:**
   - Finds team by name (case-insensitive)
   - Takes first team if semicolon-separated
   - Returns null if not found (optional field)

8. **Parent Relationship Handling:**
   - Extracts parent ID from "Aligned To" column
   - Links Objectives to parent Objectives
   - Links Key Results to parent Objectives with weight
   - Converts weight percentage (0-100%) to decimal (0.0-1.0)

9. **Deduplication:**
   - Uses `externalId + source + tenantId` for deduplication
   - Updates existing records if found
   - Creates new records if not found

10. **Error Handling:**
    - Continues processing on individual row errors
    - Returns detailed error list with row numbers
    - Returns warnings for skipped Deliverables

---

### Phase 4: API Endpoint ✅

**File Modified:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts`

**Endpoint:**
- `POST /okr/import`

**Request Body:**
```json
{
  "csvContent": "Id,Title,Team,...",
  "tenantId": "org-123"
}
```

**Response:**
```json
{
  "success": true,
  "objectivesCreated": 10,
  "objectivesUpdated": 2,
  "keyResultsCreated": 25,
  "keyResultsUpdated": 5,
  "errors": [],
  "warnings": ["Skipped 3 Deliverable(s) - Deliverables are not supported"]
}
```

**Security:**
- Requires `create_okr` permission
- Enforces tenant isolation via `OkrTenantGuard`
- Rate limited via `RateLimitGuard`

---

### Phase 5: Module Registration ✅

**File Modified:**
- `services/core-api/src/modules/okr/okr.module.ts`

**Changes:**
- Added `VivaGoalsCSVParserService` to providers
- Added `OkrImportService` to providers
- Services are automatically injected into controller

---

## CSV Format Support

The implementation supports the Viva Goals CSV export format with these columns:

| CSV Column | Mapped To | Transformation |
|------------|-----------|----------------|
| Id | `externalId` | Direct mapping |
| Title | `title` | Direct mapping |
| Team | `teamId` | Name → Team lookup |
| Creator | `createdBy` | Name → User lookup |
| Owner | `ownerId` + contributors | Name → User lookup, multiple owners |
| Period | `cycleId` | Period name → Cycle lookup/create |
| Start Date | `startDate` | Date parsing |
| End Date | `endDate` | Date parsing |
| Description | `description` | Direct mapping |
| Aligned To | `parentId` / `weight` | Regex parsing |
| Unit | `unit` | Direct mapping |
| Target | `targetValue` | Number → Float |
| Object Type | Routing logic | Filters Objectives/Key Results |
| Goal Type | `goalType` | Enum mapping |
| Start | `startValue` | Number → Float |
| Progress % | `progress` | Number → Float |
| Actual Progress | `currentValue` | Percentage → Absolute calculation |
| Status | `status` | Enum mapping |

---

## Usage Example

```typescript
// Frontend call
const response = await fetch('/api/okr/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    csvContent: csvFileContent,
    tenantId: 'org-123'
  })
});

const result = await response.json();
console.log(`Created ${result.objectivesCreated} objectives`);
console.log(`Created ${result.keyResultsCreated} key results`);
if (result.errors.length > 0) {
  console.error('Import errors:', result.errors);
}
```

---

## Testing Checklist

- [ ] Run database migration: `npm run db:migrate`
- [ ] Test CSV parsing with sample Viva Goals export
- [ ] Test import endpoint with valid CSV
- [ ] Test deduplication (re-import same CSV)
- [ ] Test error handling (invalid CSV, missing users, etc.)
- [ ] Test tenant isolation (user from different tenant)
- [ ] Test multiple owners handling
- [ ] Test parent-child relationships
- [ ] Test cycle creation
- [ ] Test status mapping for all statuses
- [ ] Test metric type inference
- [ ] Test current value calculation

---

## Known Limitations

1. **Deliverables:** Deliverables are skipped (not supported in current schema)
2. **User Matching:** Only exact name matching (no fuzzy matching)
3. **Team Creation:** Teams are not auto-created if not found
4. **Check-ins:** Historical check-in data is not imported
5. **File Upload:** Currently accepts CSV as text in request body (not multipart file upload)

---

## Next Steps (Optional Enhancements)

1. **UI Layer:**
   - Create file upload component
   - Create import preview/mapping UI
   - Create import progress/error display
   - Add import button to OKR page

2. **Enhanced Features:**
   - Support Excel format (in addition to CSV)
   - Fuzzy user name matching
   - Auto-create teams if not found
   - Import historical check-ins
   - Import creator information preservation
   - File upload via multipart/form-data

3. **Error Handling:**
   - More detailed validation errors
   - Row-by-row preview before import
   - Rollback on critical errors

---

## Files Changed

### Created:
- `services/core-api/src/modules/okr/viva-goals-csv-parser.service.ts`
- `services/core-api/src/modules/okr/okr-import.service.ts`
- `services/core-api/prisma/migrations/20250120000000_add_import_tracking_fields/migration.sql`
- `VIVA_GOALS_CSV_IMPORT_GAP_ANALYSIS.md`
- `VIVA_GOALS_IMPORT_IMPLEMENTATION.md`

### Modified:
- `services/core-api/prisma/schema.prisma`
- `services/core-api/src/modules/okr/okr-overview.controller.ts`
- `services/core-api/src/modules/okr/okr.module.ts`

---

## Migration Instructions

1. **Run Database Migration:**
   ```bash
   cd services/core-api
   npx prisma migrate dev --name add_import_tracking_fields
   ```

2. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Restart API Server:**
   ```bash
   npm run dev:core-api
   ```

---

## API Documentation

The import endpoint is documented via Swagger/OpenAPI:
- Endpoint: `POST /okr/import`
- Requires: `create_okr` permission
- Request: `{ csvContent: string, tenantId: string }`
- Response: `ImportResult` object with success counts and errors

---

**Implementation Status:** ✅ **Complete**  
**Ready for Testing:** ✅ **Yes**  
**Ready for Production:** ⚠️ **After Testing**

