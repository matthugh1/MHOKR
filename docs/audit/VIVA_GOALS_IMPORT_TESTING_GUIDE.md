# Viva Goals CSV Import Testing Guide

**Last Updated:** 2025-01-20

---

## Quick Start

### 1. Manual API Testing

#### Using curl:

```bash
# Get your JWT token first (login via your app)
TOKEN="your-jwt-token"
TENANT_ID="your-tenant-id"

# Read CSV file
CSV_CONTENT=$(cat /path/to/VivaGoals_export.csv)

# Import CSV
curl -X POST http://localhost:3000/okr/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"csvContent\": \"$CSV_CONTENT\", \"tenantId\": \"$TENANT_ID\"}"
```

#### Using Postman/Insomnia:

1. **Method:** POST
2. **URL:** `http://localhost:3000/okr/import`
3. **Headers:**
   - `Authorization: Bearer <your-jwt-token>`
   - `Content-Type: application/json`
4. **Body (JSON):**
   ```json
   {
     "csvContent": "<paste CSV content here>",
     "tenantId": "<your-tenant-id>"
   }
   ```

---

## Automated Tests

### Running Unit/Integration Tests

```bash
cd services/core-api

# Run all Viva Goals import tests
npm test -- viva-goals-import.integration.spec.ts

# Run with coverage
npm test -- --coverage viva-goals-import.integration.spec.ts

# Run in watch mode
npm test -- --watch viva-goals-import.integration.spec.ts
```

### Test Coverage

The test suite covers:
- ✅ CSV parsing (Objectives, Key Results, Check-ins)
- ✅ Topological sorting (parents before children)
- ✅ Deduplication (re-import updates)
- ✅ Multiple owners handling
- ✅ Auto-create teams
- ✅ Check-in import
- ✅ Tenant isolation
- ✅ Error handling
- ✅ Deliverable skipping

---

## Manual Testing Checklist

### Pre-requisites

- [ ] Database migration applied (`npx prisma migrate dev`)
- [ ] API server running (`npm run dev:core-api`)
- [ ] Valid JWT token for authenticated user
- [ ] Tenant ID for your organization
- [ ] Sample Viva Goals CSV file

### Test Scenarios

#### 1. Basic Import
- [ ] Import CSV with 1 Objective → Creates Objective
- [ ] Import CSV with 1 Objective + 1 Key Result → Creates both
- [ ] Verify Objective has correct fields (title, status, dates, etc.)
- [ ] Verify Key Result has correct fields (title, metric type, values, etc.)
- [ ] Verify Key Result is linked to Objective with correct weight

#### 2. Topological Sorting
- [ ] Import CSV with child Objective before parent → Parent imported first
- [ ] Import CSV with multi-level hierarchy → Correct order maintained
- [ ] Verify parent-child relationships are correct

#### 3. Deduplication
- [ ] Import same CSV twice → First creates, second updates
- [ ] Verify `objectivesCreated` vs `objectivesUpdated` counts
- [ ] Verify updated fields are changed correctly
- [ ] Verify `importedAt` timestamp is preserved on update

#### 4. Multiple Owners
- [ ] Import CSV with comma-separated owners → First owner set as ownerId
- [ ] Verify additional owners added as contributors
- [ ] Verify contributors are updated on re-import

#### 5. Auto-Create Teams
- [ ] Import CSV with new team name → Team created automatically
- [ ] Verify team is created in default workspace
- [ ] Verify Objective/Key Result linked to created team
- [ ] Re-import with same team → Uses existing team

#### 6. Check-in Import
- [ ] Import CSV with check-ins → CheckIn records created
- [ ] Verify check-in dates are preserved
- [ ] Verify check-in values are calculated correctly (percentage → absolute)
- [ ] Verify check-in notes are imported
- [ ] Re-import same CSV → Check-ins updated (deduplicated)

#### 7. Error Handling
- [ ] Import CSV with missing user → Error reported, import continues
- [ ] Import CSV with invalid dates → Error reported
- [ ] Import CSV with missing parent → Warning logged, import continues
- [ ] Verify error details in response (row number, externalId, error message)

#### 8. Tenant Isolation
- [ ] Import to Tenant A → Only creates in Tenant A
- [ ] Try to import to Tenant B with Tenant A token → 403 Forbidden
- [ ] Verify cross-tenant data is not accessible

#### 9. Status Mapping
- [ ] Import with "On Track" → Maps to `ON_TRACK`
- [ ] Import with "At Risk" → Maps to `AT_RISK`
- [ ] Import with "Behind" → Maps to `AT_RISK`
- [ ] Import with "Closed" → Maps to `COMPLETED`
- [ ] Import with "Not Started" → Maps to `NOT_STARTED`

#### 10. Metric Type Inference
- [ ] Import with Start=0, Target=100, Unit="%" → `REACH`
- [ ] Import with Start=0, Target=100 → `INCREASE`
- [ ] Import with Start=100, Target=50 → `DECREASE`
- [ ] Import with Start=50, Target=50 → `MAINTAIN`

#### 11. Current Value Calculation
- [ ] Import with Actual Progress=25%, Start=0, Target=100 → currentValue=25
- [ ] Import with Actual Progress=50%, Start=10, Target=100 → currentValue=55
- [ ] Verify calculation handles percentage vs absolute values

---

## Testing with Real CSV File

### Using Your Viva Goals Export

1. **Prepare CSV:**
   ```bash
   # Copy your CSV file
   cp ~/Downloads/VivaGoals_15229_new_view_2025_11_20_1763665314.csv test-import.csv
   ```

2. **Create Test Script:**
   ```typescript
   // test-import.ts
   import * as fs from 'fs';
   import axios from 'axios';

   const csvContent = fs.readFileSync('test-import.csv', 'utf-8');
   const token = 'your-jwt-token';
   const tenantId = 'your-tenant-id';

   axios.post('http://localhost:3000/okr/import', {
     csvContent,
     tenantId,
   }, {
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json',
     },
   })
   .then(response => {
     console.log('Import Result:', JSON.stringify(response.data, null, 2));
   })
   .catch(error => {
     console.error('Import Error:', error.response?.data || error.message);
   });
   ```

3. **Run Test:**
   ```bash
   ts-node test-import.ts
   ```

---

## Expected Response Format

### Success Response

```json
{
  "success": true,
  "objectivesCreated": 10,
  "objectivesUpdated": 2,
  "keyResultsCreated": 25,
  "keyResultsUpdated": 5,
  "errors": [],
  "warnings": [
    "Skipped 3 Deliverable(s) - Deliverables are not supported"
  ]
}
```

### Error Response

```json
{
  "success": false,
  "objectivesCreated": 8,
  "objectivesUpdated": 0,
  "keyResultsCreated": 20,
  "keyResultsUpdated": 0,
  "errors": [
    {
      "row": 15,
      "externalId": "2295704",
      "title": "Test Objective",
      "error": "Could not resolve owner for objective \"Test Objective\""
    }
  ],
  "warnings": []
}
```

---

## Debugging Tips

### Check Import Logs

```bash
# Watch API server logs
npm run dev:core-api

# Look for:
# - "Auto-created team..." messages
# - "Parent objective... not found" warnings
# - "Could not resolve user..." warnings
# - Import errors
```

### Verify Database

```bash
# Check imported Objectives
npx prisma studio
# Navigate to: objectives table
# Filter by: source = "VIVA_GOALS"

# Check imported Key Results
# Navigate to: key_results table
# Filter by: source = "VIVA_GOALS"

# Check check-ins
# Navigate to: check_ins table
```

### Common Issues

1. **"Could not resolve owner"**
   - User name doesn't match exactly
   - User doesn't exist in tenant
   - Solution: Create user or update CSV with correct name

2. **"Parent objective not found"**
   - Parent not in CSV or database
   - Topological sort issue
   - Solution: Check CSV includes all parents

3. **"Team not found"**
   - Team auto-creation failed
   - Workspace creation failed
   - Solution: Check logs for workspace creation errors

4. **Check-ins not imported**
   - Check-ins only imported for Key Results
   - User not found for check-in
   - Solution: Verify user exists and CSV has check-in data

---

## Performance Testing

### Large CSV Import

```bash
# Test with large CSV (1000+ rows)
time curl -X POST http://localhost:3000/okr/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @large-import.json
```

### Expected Performance

- Small CSV (< 100 rows): < 5 seconds
- Medium CSV (100-500 rows): < 30 seconds
- Large CSV (500-1000 rows): < 2 minutes

---

## Next Steps

After testing:
1. Review import results
2. Verify data in UI
3. Check for any errors/warnings
4. Test re-import for deduplication
5. Verify check-ins appear in Key Result history

---

## Support

If you encounter issues:
1. Check API logs for detailed error messages
2. Review `VIVA_GOALS_IMPORT_STATUS.md` for known issues
3. Check test file for examples: `viva-goals-import.integration.spec.ts`

