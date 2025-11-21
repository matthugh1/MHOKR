# Viva Goals Feature Gaps - Manual Testing Guide

**Date:** 2025-01-27  
**Version:** 1.0  
**Purpose:** Step-by-step manual testing instructions for all new features

---

## Prerequisites

1. **Database Migration Applied**
   ```bash
   cd services/core-api
   npx prisma migrate deploy
   # OR if using db push:
   npx prisma db push
   ```

2. **Backend Running**
   ```bash
   cd services/core-api
   npm run start:dev
   # Should be running on http://localhost:3001
   ```

3. **Frontend Running**
   ```bash
   cd apps/web
   npm run dev
   # Should be running on http://localhost:3000
   ```

4. **Test User Account**
   - Logged in with valid JWT token
   - Has permissions to create/edit OKRs
   - Belongs to an organization with at least one active cycle

---

## Testing Checklist

### ✅ Phase 1: Database Migration Verification

#### 1.1 Verify Schema Changes

**Action:** Check that new fields exist in database

```sql
-- Connect to your database
psql -U postgres -d okr_nexus

-- Check GoalType enum exists
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'GoalType');
-- Expected: ASPIRATIONAL, COMMITTED

-- Check NOT_STARTED in OKRStatus enum
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OKRStatus')
ORDER BY enumlabel;
-- Expected: Should include NOT_STARTED

-- Check Objective table has new columns
\d "Objective"
-- Expected: Should show goalType, createdBy columns

-- Check KeyResult table has new columns
\d "KeyResult"
-- Expected: Should show goalType, createdBy, teamId columns

-- Check Initiative table has new columns
\d "Initiative"
-- Expected: Should show goalType, createdBy, teamId, progress columns
```

**✅ Success Criteria:**
- All columns exist
- Enums have correct values
- Foreign keys are set up

---

### ✅ Phase 2: API Endpoint Testing

#### 2.1 Test Objective Creation with GoalType

**Action:** Create an Objective via API with goalType

```bash
# Get your auth token (from browser localStorage or API)
TOKEN="your-jwt-token-here"
ORG_ID="your-org-id-here"
USER_ID="your-user-id-here"
CYCLE_ID="your-cycle-id-here"

# Test 1: Create Objective with COMMITTED goalType
curl -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Committed Objective\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"tenantId\": \"$ORG_ID\",
    \"goalType\": \"COMMITTED\",
    \"status\": \"NOT_STARTED\"
  }"

# Expected Response:
# - status: 201 Created
# - body.goalType: "COMMITTED"
# - body.status: "NOT_STARTED"
# - body.createdBy: should be your user ID
```

**✅ Success Criteria:**
- Request succeeds (201)
- Response includes goalType = "COMMITTED"
- Response includes status = "NOT_STARTED"
- Response includes createdBy = your user ID

**Test 2: Create Objective with default goalType (ASPIRATIONAL)**

```bash
curl -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Aspirational Objective\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"tenantId\": \"$ORG_ID\"
  }"

# Expected Response:
# - body.goalType: "ASPIRATIONAL" (default)
# - body.createdBy: should be your user ID
```

**✅ Success Criteria:**
- goalType defaults to "ASPIRATIONAL"
- createdBy is auto-populated

#### 2.2 Test Key Result Creation with Team

**Action:** Create a Key Result with teamId

```bash
# First, get a team ID (create one or use existing)
TEAM_ID="your-team-id-here"
OBJECTIVE_ID="objective-id-from-previous-test"

# Test: Create Key Result with teamId
curl -X POST http://localhost:3001/key-results \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test KR with Team\",
    \"objectiveId\": \"$OBJECTIVE_ID\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"metricType\": \"PERCENTAGE\",
    \"startValue\": 0,
    \"targetValue\": 100,
    \"goalType\": \"COMMITTED\",
    \"teamId\": \"$TEAM_ID\",
    \"status\": \"NOT_STARTED\"
  }"

# Expected Response:
# - status: 201 Created
# - body.goalType: "COMMITTED"
# - body.teamId: should match TEAM_ID
# - body.status: "NOT_STARTED"
# - body.createdBy: should be your user ID
```

**✅ Success Criteria:**
- Request succeeds
- teamId is set correctly
- All new fields are present

**Test: Create Key Result without teamId (should inherit from Objective)**

```bash
# First, create Objective with teamId
curl -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Parent Objective with Team\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"tenantId\": \"$ORG_ID\",
    \"teamId\": \"$TEAM_ID\"
  }"

# Then create KR without teamId
curl -X POST http://localhost:3001/key-results \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"KR Inheriting Team\",
    \"objectiveId\": \"<objective-id-from-above>\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"metricType\": \"PERCENTAGE\",
    \"startValue\": 0,
    \"targetValue\": 100
  }"

# Expected Response:
# - body.teamId: should match Objective's teamId
```

**✅ Success Criteria:**
- KR inherits teamId from Objective

#### 2.3 Test Initiative Creation with All New Fields

**Action:** Create an Initiative with goalType, teamId, and progress

```bash
OBJECTIVE_ID="your-objective-id-here"

curl -X POST http://localhost:3001/initiatives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Initiative\",
    \"objectiveId\": \"$OBJECTIVE_ID\",
    \"ownerId\": \"$USER_ID\",
    \"goalType\": \"COMMITTED\",
    \"teamId\": \"$TEAM_ID\",
    \"progress\": 75,
    \"status\": \"IN_PROGRESS\"
  }"

# Expected Response:
# - status: 201 Created
# - body.goalType: "COMMITTED"
# - body.teamId: should match TEAM_ID
# - body.progress: 75
# - body.createdBy: should be your user ID
```

**✅ Success Criteria:**
- All fields are set correctly
- Progress is between 0-100

**Test: Validate progress range**

```bash
# Test invalid progress (> 100)
curl -X POST http://localhost:3001/initiatives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Invalid Progress Test\",
    \"objectiveId\": \"$OBJECTIVE_ID\",
    \"ownerId\": \"$USER_ID\",
    \"progress\": 150
  }"

# Expected Response:
# - status: 400 Bad Request
# - Error message about progress range
```

**✅ Success Criteria:**
- Validation rejects invalid progress

#### 2.4 Test Update Operations

**Action:** Update existing entities with new fields

```bash
OBJECTIVE_ID="existing-objective-id"
KR_ID="existing-kr-id"
INITIATIVE_ID="existing-initiative-id"

# Update Objective goalType
curl -X PATCH http://localhost:3001/objectives/$OBJECTIVE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"goalType\": \"ASPIRATIONAL\",
    \"status\": \"NOT_STARTED\"
  }"

# Update Key Result teamId
curl -X PATCH http://localhost:3001/key-results/$KR_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"goalType\": \"COMMITTED\",
    \"teamId\": \"$TEAM_ID\"
  }"

# Update Initiative progress
curl -X PATCH http://localhost:3001/initiatives/$INITIATIVE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"progress\": 90,
    \"goalType\": \"COMMITTED\"
  }"
```

**✅ Success Criteria:**
- Updates succeed
- New values are reflected in responses

#### 2.5 Test Composite Creation

**Action:** Test composite OKR creation with new fields

```bash
curl -X POST http://localhost:3001/okr/create-composite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"objective\": {
      \"title\": \"Composite Test Objective\",
      \"ownerUserId\": \"$USER_ID\",
      \"cycleId\": \"$CYCLE_ID\",
      \"goalType\": \"COMMITTED\",
      \"visibilityLevel\": \"PUBLIC_TENANT\"
    },
    \"keyResults\": [
      {
        \"title\": \"KR 1\",
        \"metricType\": \"PERCENT\",
        \"targetValue\": 100,
        \"ownerUserId\": \"$USER_ID\",
        \"startValue\": 0,
        \"goalType\": \"COMMITTED\",
        \"teamId\": \"$TEAM_ID\"
      },
      {
        \"title\": \"KR 2\",
        \"metricType\": \"PERCENT\",
        \"targetValue\": 100,
        \"ownerUserId\": \"$USER_ID\",
        \"startValue\": 0,
        \"goalType\": \"ASPIRATIONAL\"
      }
    ]
  }"

# Expected Response:
# - objectiveId and keyResultIds returned
# - Verify in database that createdBy is set for all entities
```

**✅ Success Criteria:**
- Composite creation succeeds
- All entities have createdBy set
- GoalTypes are set correctly

---

### ✅ Phase 3: UI Component Testing

#### 3.1 Test GoalType Selector

**Action:** Test GoalType selector in creation forms

1. **Navigate to OKRs Page**
   - Go to http://localhost:3000/dashboard/okrs
   - Click "New Objective" button

2. **Test GoalType Selector**
   - ✅ GoalType selector appears in the form
   - ✅ Default is "Aspirational"
   - ✅ Can select "Committed"
   - ✅ Description tooltips appear
   - ✅ Selected value persists when navigating steps

3. **Create Objective**
   - Fill in title, owner, cycle
   - Select "Committed" goalType
   - Select "Not Started" status
   - Save/Submit

4. **Verify Display**
   - ✅ Objective appears in list
   - ✅ "Committed" badge displays next to title
   - ✅ "Not Started" badge displays

**✅ Success Criteria:**
- Selector works correctly
- Badge displays correctly
- Value saves correctly

#### 3.2 Test Key Result Creation with Team

**Action:** Test Key Result creation with Team selector

1. **Create Key Result**
   - Click "Add Key Result" on an Objective
   - OR click "New Key Result" button

2. **Test Team Selector**
   - ✅ Team selector appears (if teams are available)
   - ✅ Can select a team from dropdown
   - ✅ Can select "None"
   - ✅ If parent Objective has team, it's inherited (check default)

3. **Test GoalType**
   - ✅ GoalType selector appears
   - ✅ Can select Aspirational/Committed
   - ✅ Default is Aspirational

4. **Test Status**
   - ✅ "Not Started" appears in status dropdown
   - ✅ Can select "Not Started"

5. **Save and Verify**
   - ✅ Key Result saves successfully
   - ✅ Team badge displays (if team assigned)
   - ✅ GoalType badge displays
   - ✅ Status badge displays

**✅ Success Criteria:**
- All selectors work
- Badges display correctly
- Inheritance works

#### 3.3 Test Initiative Creation

**Action:** Test Initiative creation with all new fields

1. **Create Initiative**
   - Click "Add Initiative" on an Objective or Key Result
   - OR use "New Initiative" button

2. **Test GoalType Selector**
   - ✅ GoalType selector appears
   - ✅ Can select Aspirational/Committed

3. **Test Team Selector**
   - ✅ Team selector appears (if teams available)
   - ✅ Can select team or None
   - ✅ Inherits from parent if not set

4. **Test Progress Input**
   - ✅ Progress input field appears
   - ✅ Can enter number 0-100
   - ✅ Validation prevents > 100
   - ✅ Validation prevents < 0
   - ✅ Can leave empty (null)

5. **Save and Verify**
   - ✅ Initiative saves successfully
   - ✅ GoalType badge displays
   - ✅ Progress badge displays (e.g., "75%")
   - ✅ Team badge displays (if team assigned)

**✅ Success Criteria:**
- All fields work correctly
- Validation works
- Badges display correctly

#### 3.4 Test Edit Forms

**Action:** Test editing existing OKRs with new fields

1. **Edit Objective**
   - Click "Edit" on an Objective
   - ✅ GoalType selector shows current value
   - ✅ Can change GoalType
   - ✅ Can change Status to "Not Started"
   - ✅ Save changes
   - ✅ Changes reflect in display

2. **Edit Key Result**
   - Click "Edit" on a Key Result
   - ✅ GoalType selector shows current value
   - ✅ Team selector shows current team (or None)
   - ✅ Can change GoalType
   - ✅ Can change Team
   - ✅ Can change Status to "Not Started"
   - ✅ Save changes
   - ✅ Changes reflect in display

3. **Edit Initiative**
   - Click "Edit" on an Initiative
   - ✅ GoalType selector shows current value
   - ✅ Team selector shows current team
   - ✅ Progress input shows current value
   - ✅ Can change all fields
   - ✅ Save changes
   - ✅ Changes reflect in display

**✅ Success Criteria:**
- Edit forms load current values
- Changes save correctly
- Display updates correctly

#### 3.5 Test Status Filter

**Action:** Test "Not Started" status filter

1. **Navigate to OKRs Page**
   - Go to http://localhost:3000/dashboard/okrs

2. **Test Filter**
   - ✅ "Not Started" button appears in filter bar
   - ✅ Click "Not Started" filter
   - ✅ Only OKRs with "Not Started" status appear
   - ✅ Can combine with other filters (cycle, owner, etc.)
   - ✅ Can clear filter to show all

**✅ Success Criteria:**
- Filter works correctly
- Results are accurate
- Can combine with other filters

#### 3.6 Test Badge Display

**Action:** Verify badges display correctly

1. **Objective Badges**
   - ✅ GoalType badge appears (Aspirational/Committed)
   - ✅ Status badge includes "Not Started"
   - ✅ Badges are styled correctly

2. **Key Result Badges**
   - ✅ GoalType badge appears
   - ✅ Team badge appears (when team assigned)
   - ✅ Status badge includes "Not Started"

3. **Initiative Badges**
   - ✅ GoalType badge appears
   - ✅ Team badge appears (when team assigned)
   - ✅ Progress badge appears (e.g., "75%")
   - ✅ Status badge appears

**✅ Success Criteria:**
- All badges display correctly
- Badges only show when values are set
- Styling is consistent

---

### ✅ Phase 4: Integration Testing

#### 4.1 Test Complete Workflow

**Action:** Test end-to-end workflow with all new features

1. **Create Committed Objective**
   - Create Objective with:
     - GoalType: Committed
     - Status: Not Started
   - ✅ Saves successfully

2. **Add Key Results**
   - Add 2 Key Results:
     - KR1: GoalType Committed, Team assigned
     - KR2: GoalType Aspirational, No team
   - ✅ Both save successfully
   - ✅ KR1 shows team badge
   - ✅ Both show GoalType badges

3. **Add Initiatives**
   - Add Initiative to KR1:
     - GoalType: Committed
     - Team: Inherited from KR1
     - Progress: 50
   - ✅ Saves successfully
   - ✅ Shows all badges

4. **Update Progress**
   - Edit Initiative
   - Update Progress to 75
   - ✅ Progress badge updates

5. **Change Status**
   - Update Objective status to "On Track"
   - Update KR1 status to "On Track"
   - ✅ Status badges update

6. **Filter and View**
   - Use "Not Started" filter
   - ✅ Only shows OKRs with Not Started status
   - Clear filter
   - ✅ Shows all OKRs

**✅ Success Criteria:**
- Complete workflow works end-to-end
- All features work together
- No errors or issues

#### 4.2 Test Data Integrity

**Action:** Verify data integrity and relationships

1. **Check Database**
   ```sql
   -- Verify createdBy is set
   SELECT id, title, "createdBy", "goalType" 
   FROM "Objective" 
   WHERE "createdBy" IS NULL;
   -- Expected: Should return 0 rows (or only very old data)

   -- Verify teamId inheritance
   SELECT o.id, o."teamId" as obj_team, kr.id, kr."teamId" as kr_team
   FROM "Objective" o
   JOIN "KeyResult" kr ON kr."objectiveId" = o.id
   WHERE o."teamId" IS NOT NULL AND kr."teamId" IS NULL;
   -- Expected: Should show KRs that inherited teamId (or 0 rows if all explicitly set)

   -- Verify progress values are valid
   SELECT id, title, progress
   FROM "Initiative"
   WHERE progress IS NOT NULL AND (progress < 0 OR progress > 100);
   -- Expected: Should return 0 rows
   ```

**✅ Success Criteria:**
- No orphaned data
- No invalid values
- Relationships are correct

---

### ✅ Phase 5: Edge Cases and Validation

#### 5.1 Test Validation

**Action:** Test validation rules

1. **Invalid GoalType**
   ```bash
   curl -X POST http://localhost:3001/objectives \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d "{
       \"title\": \"Test\",
       \"ownerId\": \"$USER_ID\",
       \"cycleId\": \"$CYCLE_ID\",
       \"tenantId\": \"$ORG_ID\",
       \"goalType\": \"INVALID\"
     }"
   # Expected: 400 Bad Request
   ```

2. **Invalid Progress**
   ```bash
   curl -X POST http://localhost:3001/initiatives \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d "{
       \"title\": \"Test\",
       \"objectiveId\": \"$OBJECTIVE_ID\",
       \"ownerId\": \"$USER_ID\",
       \"progress\": 150
     }"
   # Expected: 400 Bad Request
   ```

3. **Invalid Team (cross-tenant)**
   ```bash
   # Try to assign team from different tenant
   # Expected: 404 Not Found or 403 Forbidden
   ```

**✅ Success Criteria:**
- Validation works correctly
- Appropriate error messages
- No invalid data saved

#### 5.2 Test Defaults and Inheritance

**Action:** Verify defaults and inheritance work correctly

1. **Default GoalType**
   - Create Objective without goalType
   - ✅ Defaults to ASPIRATIONAL

2. **Default createdBy**
   - Create any entity without createdBy
   - ✅ Auto-populated from auth token

3. **Team Inheritance**
   - Create Objective with teamId
   - Create KR without teamId
   - ✅ KR inherits teamId from Objective

4. **Status Default**
   - Create Objective without status
   - ✅ Defaults to ON_TRACK (existing behavior)

**✅ Success Criteria:**
- Defaults work correctly
- Inheritance works correctly

---

## Quick Test Script

Here's a quick script to test all API endpoints:

```bash
#!/bin/bash

# Set your values
TOKEN="your-token"
ORG_ID="your-org-id"
USER_ID="your-user-id"
CYCLE_ID="your-cycle-id"
TEAM_ID="your-team-id"

echo "Testing Viva Goals Features..."

# Test 1: Create Objective with COMMITTED
echo "1. Creating COMMITTED Objective..."
OBJ_RESPONSE=$(curl -s -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Committed Objective\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"tenantId\": \"$ORG_ID\",
    \"goalType\": \"COMMITTED\",
    \"status\": \"NOT_STARTED\"
  }")

OBJ_ID=$(echo $OBJ_RESPONSE | jq -r '.id')
echo "✅ Objective created: $OBJ_ID"
echo "   GoalType: $(echo $OBJ_RESPONSE | jq -r '.goalType')"
echo "   Status: $(echo $OBJ_RESPONSE | jq -r '.status')"
echo "   CreatedBy: $(echo $OBJ_RESPONSE | jq -r '.createdBy')"

# Test 2: Create KR with Team
echo "2. Creating Key Result with Team..."
KR_RESPONSE=$(curl -s -X POST http://localhost:3001/key-results \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test KR with Team\",
    \"objectiveId\": \"$OBJ_ID\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"metricType\": \"PERCENTAGE\",
    \"startValue\": 0,
    \"targetValue\": 100,
    \"goalType\": \"COMMITTED\",
    \"teamId\": \"$TEAM_ID\",
    \"status\": \"NOT_STARTED\"
  }")

KR_ID=$(echo $KR_RESPONSE | jq -r '.id')
echo "✅ Key Result created: $KR_ID"
echo "   GoalType: $(echo $KR_RESPONSE | jq -r '.goalType')"
echo "   TeamId: $(echo $KR_RESPONSE | jq -r '.teamId')"
echo "   Status: $(echo $KR_RESPONSE | jq -r '.status')"

# Test 3: Create Initiative with Progress
echo "3. Creating Initiative with Progress..."
INIT_RESPONSE=$(curl -s -X POST http://localhost:3001/initiatives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Initiative\",
    \"objectiveId\": \"$OBJ_ID\",
    \"ownerId\": \"$USER_ID\",
    \"goalType\": \"COMMITTED\",
    \"teamId\": \"$TEAM_ID\",
    \"progress\": 75
  }")

INIT_ID=$(echo $INIT_RESPONSE | jq -r '.id')
echo "✅ Initiative created: $INIT_ID"
echo "   GoalType: $(echo $INIT_RESPONSE | jq -r '.goalType')"
echo "   TeamId: $(echo $INIT_RESPONSE | jq -r '.teamId')"
echo "   Progress: $(echo $INIT_RESPONSE | jq -r '.progress')"

echo ""
echo "✅ All API tests completed successfully!"
echo "   Objective ID: $OBJ_ID"
echo "   Key Result ID: $KR_ID"
echo "   Initiative ID: $INIT_ID"
```

---

## Testing Checklist Summary

### Database
- [ ] Schema changes applied
- [ ] Enums created correctly
- [ ] Foreign keys set up
- [ ] Indexes created

### API Endpoints
- [ ] Create Objective with goalType
- [ ] Create Objective with NOT_STARTED
- [ ] Create Key Result with teamId
- [ ] Create Key Result with goalType
- [ ] Create Initiative with all new fields
- [ ] Update operations work
- [ ] Composite creation works
- [ ] Validation works

### UI Components
- [ ] GoalType selector works
- [ ] Team selector works
- [ ] Progress input works
- [ ] Status selector includes NOT_STARTED
- [ ] Badges display correctly
- [ ] Edit forms work
- [ ] Filter works

### Integration
- [ ] Complete workflow works
- [ ] Data integrity maintained
- [ ] Defaults work
- [ ] Inheritance works

---

## Common Issues and Solutions

### Issue: GoalType selector not appearing
**Solution:** Check that GoalTypeSelector component is imported and used in the form

### Issue: Team selector not appearing
**Solution:** Verify teams are available (check availableTeams prop is passed)

### Issue: Badges not displaying
**Solution:** Check that ObjectiveRow component includes badge rendering logic

### Issue: Validation errors
**Solution:** Verify API validation logic is working (check service methods)

### Issue: createdBy not set
**Solution:** Check that service methods auto-populate createdBy from userId

---

## Success Criteria

✅ **All tests pass**
✅ **No console errors**
✅ **No database errors**
✅ **UI displays correctly**
✅ **API responses include new fields**
✅ **Validation works correctly**
✅ **Badges display correctly**
✅ **Filters work correctly**

---

**Last Updated:** 2025-01-27  
**Testing Guide Version:** 1.0

