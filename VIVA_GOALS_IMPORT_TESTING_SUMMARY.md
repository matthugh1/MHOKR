# Viva Goals Import Testing Summary

**Last Updated:** 2025-01-20

---

## Testing Options

### 1. ✅ Automated Integration Tests

**File:** `services/core-api/src/modules/okr/__tests__/viva-goals-import.integration.spec.ts`

**Run:**
```bash
cd services/core-api
npm test -- viva-goals-import.integration.spec.ts
```

**Coverage:**
- CSV parsing
- Topological sorting
- Deduplication
- Multiple owners
- Auto-create teams
- Check-in import
- Tenant isolation
- Error handling

---

### 2. ✅ Manual Test Script

**File:** `services/core-api/scripts/test-viva-goals-import.ts`

**Run:**
```bash
cd services/core-api
ts-node scripts/test-viva-goals-import.ts \
  ~/Downloads/VivaGoals_15229_new_view_2025_11_20_1763665314.csv \
  <tenant-id> \
  <user-id>
```

**Features:**
- Parses CSV and shows summary
- Imports data
- Shows detailed results (created/updated counts)
- Lists errors and warnings
- Verifies import in database

---

### 3. ✅ API Endpoint Testing

**Endpoint:** `POST /okr/import`

**Using curl:**
```bash
TOKEN="your-jwt-token"
TENANT_ID="your-tenant-id"
CSV_FILE="~/Downloads/VivaGoals_export.csv"

curl -X POST http://localhost:3000/okr/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"csvContent\": \"$(cat $CSV_FILE | sed 's/"/\\"/g')\", \"tenantId\": \"$TENANT_ID\"}"
```

**Using Postman:**
1. POST to `http://localhost:3000/okr/import`
2. Headers: `Authorization: Bearer <token>`
3. Body: `{"csvContent": "<csv>", "tenantId": "<id>"}`

---

## Quick Test Checklist

### ✅ Prerequisites
- [ ] Database migration applied
- [ ] API server running
- [ ] Valid JWT token
- [ ] Tenant ID
- [ ] CSV file ready

### ✅ Basic Test
- [ ] Run integration tests: `npm test -- viva-goals-import.integration.spec.ts`
- [ ] Run manual script with your CSV
- [ ] Test via API endpoint

### ✅ Verify Results
- [ ] Check import response (success, counts, errors)
- [ ] Verify Objectives in database
- [ ] Verify Key Results in database
- [ ] Verify check-ins imported
- [ ] Verify teams created
- [ ] Verify parent-child relationships

---

## Test Files Created

1. **Integration Tests:** `services/core-api/src/modules/okr/__tests__/viva-goals-import.integration.spec.ts`
2. **Manual Test Script:** `services/core-api/scripts/test-viva-goals-import.ts`
3. **Testing Guide:** `VIVA_GOALS_IMPORT_TESTING_GUIDE.md`

---

## Next Steps

1. **Run Tests:**
   ```bash
   cd services/core-api
   npm test -- viva-goals-import.integration.spec.ts
   ```

2. **Test with Real CSV:**
   ```bash
   ts-node scripts/test-viva-goals-import.ts \
     ~/Downloads/VivaGoals_15229_new_view_2025_11_20_1763665314.csv \
     <your-tenant-id> \
     <your-user-id>
   ```

3. **Test via API:**
   - Use Postman/curl with your CSV file
   - Check response for success/errors

4. **Verify in UI:**
   - Check OKR list page
   - Verify imported Objectives and Key Results
   - Check check-in history

---

**Status:** ✅ **Ready for Testing**

