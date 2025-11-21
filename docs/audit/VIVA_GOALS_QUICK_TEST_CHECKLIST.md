# Viva Goals Features - Quick Test Checklist

**Quick reference for testing all new features**

---

## 🚀 Quick Start

1. **Apply Migration**
   ```bash
   cd services/core-api
   npx prisma migrate deploy
   ```

2. **Start Services**
   ```bash
   # Terminal 1: Backend
   cd services/core-api && npm run start:dev
   
   # Terminal 2: Frontend  
   cd apps/web && npm run dev
   ```

---

## ✅ Feature Tests (5 minutes)

### 1. GoalType (2 min)
- [ ] Create Objective → Select "Committed" → ✅ Badge shows "Committed"
- [ ] Create Objective → Leave default → ✅ Badge shows "Aspirational"
- [ ] Edit Objective → Change GoalType → ✅ Badge updates

### 2. NOT_STARTED Status (1 min)
- [ ] Create Objective → Select "Not Started" → ✅ Badge shows "Not Started"
- [ ] Filter bar → Click "Not Started" → ✅ Only Not Started OKRs show

### 3. Team Assignment (1 min)
- [ ] Create Key Result → Select Team → ✅ Team badge appears
- [ ] Create Key Result → No team → ✅ Inherits from Objective (if Objective has team)

### 4. Initiative Progress (1 min)
- [ ] Create Initiative → Enter Progress "75" → ✅ Badge shows "75%"
- [ ] Edit Initiative → Change Progress → ✅ Badge updates

---

## 🔍 API Quick Test

```bash
# Set variables
TOKEN="your-token"
ORG_ID="your-org-id"
USER_ID="your-user-id"
CYCLE_ID="your-cycle-id"

# Test 1: Create Objective with COMMITTED
curl -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"tenantId\": \"$ORG_ID\",
    \"goalType\": \"COMMITTED\",
    \"status\": \"NOT_STARTED\"
  }"
# ✅ Check: goalType="COMMITTED", status="NOT_STARTED", createdBy is set

# Test 2: Create KR with Team
curl -X POST http://localhost:3001/key-results \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test KR\",
    \"objectiveId\": \"<obj-id>\",
    \"ownerId\": \"$USER_ID\",
    \"cycleId\": \"$CYCLE_ID\",
    \"metricType\": \"PERCENTAGE\",
    \"startValue\": 0,
    \"targetValue\": 100,
    \"teamId\": \"<team-id>\",
    \"goalType\": \"COMMITTED\"
  }"
# ✅ Check: teamId is set, goalType="COMMITTED"

# Test 3: Create Initiative with Progress
curl -X POST http://localhost:3001/initiatives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Initiative\",
    \"objectiveId\": \"<obj-id>\",
    \"ownerId\": \"$USER_ID\",
    \"goalType\": \"COMMITTED\",
    \"progress\": 75
  }"
# ✅ Check: progress=75, goalType="COMMITTED"
```

---

## 🎯 UI Test Flow (10 minutes)

### Test 1: Create Committed Objective (2 min)
1. Go to OKRs page
2. Click "New Objective"
3. Fill title, owner, cycle
4. **Select "Committed" in GoalType**
5. **Select "Not Started" in Status**
6. Save
7. ✅ Verify: "Committed" badge + "Not Started" badge appear

### Test 2: Add Key Result with Team (2 min)
1. Click "Add Key Result" on Objective
2. Fill KR details
3. **Select "Committed" in GoalType**
4. **Select a Team** (if available)
5. **Select "Not Started" in Status**
6. Save
7. ✅ Verify: "Committed" badge + Team badge + "Not Started" badge

### Test 3: Add Initiative with Progress (2 min)
1. Click "Add Initiative" on Objective/KR
2. Fill Initiative details
3. **Select "Committed" in GoalType**
4. **Select a Team** (if available)
5. **Enter Progress: 75**
6. Save
7. ✅ Verify: "Committed" badge + Team badge + "75%" badge

### Test 4: Edit and Update (2 min)
1. Click "Edit" on Objective
2. Change GoalType to "Aspirational"
3. Change Status to "On Track"
4. Save
5. ✅ Verify: Badges update correctly

### Test 5: Filter by Status (1 min)
1. In filter bar, click "Not Started"
2. ✅ Verify: Only Not Started OKRs show
3. Click "All statuses"
4. ✅ Verify: All OKRs show

### Test 6: Verify Badges (1 min)
- ✅ Objective: GoalType badge visible
- ✅ Key Result: GoalType + Team badges visible
- ✅ Initiative: GoalType + Team + Progress badges visible

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| GoalType selector missing | Check component import |
| Team selector missing | Verify teams exist and prop is passed |
| Badges not showing | Check ObjectiveRow badge rendering |
| createdBy not set | Verify service auto-population logic |
| Validation errors | Check API service validation |

---

## ✅ Success Checklist

- [ ] Migration applied successfully
- [ ] All API endpoints accept new fields
- [ ] All UI components display new fields
- [ ] Badges show correctly
- [ ] Filters work correctly
- [ ] Validation works correctly
- [ ] No console errors
- [ ] No database errors

---

**Full Guide:** See `VIVA_GOALS_MANUAL_TESTING_GUIDE.md` for detailed instructions

