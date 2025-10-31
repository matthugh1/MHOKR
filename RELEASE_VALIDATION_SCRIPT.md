# Release Validation Script - End-to-End Smoke Check

**Purpose:** Validate the full stack from clean state on latest main, verify all governed demo surfaces (Analytics, OKRs, Builder, AI Dashboard), including BuildStamp, permissions, tenant isolation, and lock behavior.

---

## PHASE 0: PREP - Clean State Setup

### Step 1: Check Git Status and Switch to Main

```bash
# Show current status
git status

# Switch to main branch (detect which exists)
if git show-ref --verify --quiet refs/heads/main; then
  git checkout main
else
  git checkout master
fi

# Pull latest
git pull origin main 2>/dev/null || git pull origin master

# Show last 5 commits
git log --oneline -5
```

**Expected Output:**
- Clean working directory (no uncommitted changes, or stash them first)
- Successfully switched to `main` branch
- Latest commits pulled
- Last 5 commits shown with hashes and messages

---

### Step 2: Kill All Running Processes

```bash
# Kill all Node processes (macOS)
pkill -f node

# Stop all Docker containers
docker compose down

# Verify no Node processes running
ps aux | grep node | grep -v grep

# Verify Docker containers stopped
docker ps -a
```

**Expected Output:**
- No Node processes listed (or only grep itself)
- Docker containers stopped (empty list or only stopped containers)

---

### Step 3: Install Dependencies

**Package Manager Detection:**
- Found: `package-lock.json` → Using **npm**

```bash
# Install all dependencies (workspace bootstrap)
npm install

# Build shared packages if needed (check if packages need build)
cd packages/types && npm run build && cd ../..
cd packages/utils && npm run build 2>/dev/null || echo "utils build optional" && cd ../..
```

**Expected Output:**
- `npm install` completes without fatal errors
- Workspace packages installed
- Shared packages built successfully
- Exit code: 0

**Confirmation at End of Phase 0:**
- Branch: `main` (or `master`)
- Latest commit hash: `$(git rev-parse HEAD)`
- Package manager: **npm**
- Processes killed: Node processes, Docker containers
- Dependencies installed: ✓

---

## PHASE 1: BACKEND START

### Step 1: Start Infrastructure Services

```bash
# Start Docker Compose services (postgres, redis, keycloak)
docker compose up -d

# Wait for services to be healthy (30 seconds)
sleep 30

# Verify containers are running
docker ps --filter "name=okr-nexus" --format "table {{.Names}}\t{{.Status}}"
```

**Expected Output:**
- `okr-nexus-postgres` - Up (healthy)
- `okr-nexus-redis` - Up (healthy)
- `okr-nexus-keycloak` - Up (healthy)

---

### Step 2: Run Database Migrations

```bash
# Generate Prisma client and run migrations
cd services/core-api
npx prisma generate
npx prisma migrate deploy
cd ../..
```

**Expected Output:**
- Prisma client generated
- Migrations applied successfully
- No migration errors

---

### Step 3: Start Core API

```bash
# Start core-api in background (dev mode with watch)
cd services/core-api
npm run dev > /tmp/core-api.log 2>&1 &
CORE_API_PID=$!
cd ../..
echo "Core API PID: $CORE_API_PID"

# Wait for core-api to start (10 seconds)
sleep 10

# Check if process is still running
ps -p $CORE_API_PID
```

**Expected Output:**
- Core API process running (PID shown)
- Process still alive after 10 seconds
- Log file created at `/tmp/core-api.log`

---

### Step 4: Start API Gateway

```bash
# Start api-gateway in background
cd services/api-gateway
npm run dev > /tmp/api-gateway.log 2>&1 &
GATEWAY_PID=$!
cd ../..
echo "API Gateway PID: $GATEWAY_PID"

# Wait for gateway to start (10 seconds)
sleep 10

# Check if process is still running
ps -p $GATEWAY_PID
```

**Expected Output:**
- API Gateway process running (PID shown)
- Process still alive after 10 seconds
- Log file created at `/tmp/api-gateway.log`

---

### Step 5: Verify Backend Health Checks

```bash
# Check Core API health (direct)
curl -s http://localhost:3001/api/docs | head -20

# Check API Gateway health (proxy to core-api)
curl -s http://localhost:3000/api/docs | head -20

# Check API Gateway reports endpoint (requires auth, but should not 404)
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/reports/analytics/summary
```

**Expected Output:**
- Core API Swagger docs accessible (HTML response, not 404)
- API Gateway Swagger docs accessible (HTML response, not 404)
- Reports endpoint returns 401 Unauthorized (not 404) - this proves endpoint exists

---

### Step 6: Verify Required Backend Endpoints Exist

Create a test auth token first (you'll need to log in via Keycloak or use a test user):

```bash
# NOTE: Replace <TOKEN> with a valid JWT from login response
# These endpoints should NOT return 404 - they should return 401/403 if unauthorized

echo "=== Testing Required Endpoints ==="

# Analytics summary
echo "1. /api/reports/analytics/summary"
curl -s -w "\nHTTP: %{http_code}\n" -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/reports/analytics/summary

# Analytics feed
echo "\n2. /api/reports/analytics/feed"
curl -s -w "\nHTTP: %{http_code}\n" -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/reports/analytics/feed

# Overdue check-ins
echo "\n3. /api/reports/check-ins/overdue"
curl -s -w "\nHTTP: %{http_code}\n" -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/reports/check-ins/overdue

# CSV export
echo "\n4. /api/reports/export/csv"
curl -s -w "\nHTTP: %{http_code}\n" -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/reports/export/csv

# Activity for objective (replace :id with actual ID)
echo "\n5. /api/activity/objectives/:id"
curl -s -w "\nHTTP: %{http_code}\n" -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/activity/objectives/test-id

# Activity for key result (replace :id with actual ID)
echo "\n6. /api/activity/key-results/:id"
curl -s -w "\nHTTP: %{http_code}\n" -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/activity/key-results/test-id
```

**Expected Output:**
- All endpoints return HTTP 200, 401, or 403 (NOT 404)
- 401/403 indicates endpoint exists but requires auth/permissions
- 200 indicates endpoint is accessible with valid token

**If any endpoint returns 404 → STOP and report architecture breach**

---

## PHASE 2: FRONTEND START

### Step 1: Set Environment Variables

```bash
# Check if .env.local exists in apps/web
cd apps/web
if [ ! -f .env.local ]; then
  echo "Creating .env.local..."
  cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_GIT_SHA=$(git rev-parse --short HEAD)
EOF
fi
cat .env.local
cd ../..
```

**Expected Output:**
- `.env.local` file created/verified
- `NEXT_PUBLIC_API_URL=http://localhost:3000` (API Gateway)
- `NEXT_PUBLIC_ENV=development`
- `NEXT_PUBLIC_GIT_SHA=<short commit hash>`

---

### Step 2: Start Frontend

```bash
# Start web app in background
cd apps/web
npm run dev > /tmp/web-app.log 2>&1 &
WEB_PID=$!
cd ../..
echo "Web app PID: $WEB_PID"

# Wait for Next.js to compile (30 seconds)
sleep 30

# Check if process is still running
ps -p $WEB_PID

# Check if port 5173 is listening
lsof -i :5173 | grep LISTEN
```

**Expected Output:**
- Web app process running (PID shown)
- Process still alive after 30 seconds
- Port 5173 listening
- Log file created at `/tmp/web-app.log`

---

### Step 3: Verify Frontend is Accessible

```bash
# Check if frontend responds
curl -s http://localhost:5173 | head -20
```

**Expected Output:**
- HTML response (Next.js page, not error)
- Status code 200

**At End of Phase 2:**
- Frontend URL: `http://localhost:5173`
- Environment variables set: ✓
- Frontend accessible: ✓

---

## PHASE 3: UI VALIDATION SCRIPT (Manual Walkthrough Checklist)

**Open your browser and navigate to:** `http://localhost:5173`

---

### CHECK 1: LOGIN

**Steps:**
1. Navigate to login page (should redirect automatically if not logged in)
2. Log in with a **normal tenant user** (NOT a superuser)
   - Use Keycloak login at `http://localhost:8080` if needed
   - Or use existing test user credentials

**Expected Results:**
- ✓ No crash / blank screen
- ✓ You land on the default dashboard (`/dashboard` or similar)
- ✓ **BLOCKER CHECK:** The header of the first page shows BuildStamp in top-right
  - Format: `{version} • {env} • {sha}` (e.g., `1.0.0 • development • a1b2c3d`)
  - If BuildStamp is missing → **BLOCKER - STOP HERE**

**If BuildStamp Missing:**
```
❌ BLOCKER: BuildStamp not visible on dashboard header
   Location: /dashboard (first page after login)
   Expected: Top-right corner, format "version • env • sha"
   Actual: [describe what you see]
```

---

### CHECK 2: ANALYTICS PAGE (/dashboard/analytics)

**Steps:**
1. Navigate to `/dashboard/analytics`
2. Observe the page structure

**Expected Results:**

**Header:**
- ✓ SectionHeader component visible (titles "Execution Health" or similar)
- ✓ **BLOCKER CHECK:** BuildStamp visible in top-right (inline variant)
- If BuildStamp missing → **BLOCKER**

**KPI Cards:**
- ✓ KPI cards at top rendered using shared `StatCard` component
- ✓ No `NaN`, `undefined`, or `null%` in any metric
- ✓ Cards use design tokens: `rounded-xl border border-neutral-200 bg-white`

**Recent Activity Section:**
- ✓ SectionHeader component with title "Recent Activity"
- ✓ Activity items rendered using `ActivityItemCard` OR graceful empty state ("No recent activity")
- ✓ No crash / error boundary triggered

**CSV Export Button:**
- ✓ **For non-admin user:** Button SHOULD NOT render at all
- ✓ **For tenant admin/owner:** Button SHOULD render
- ✓ **If button visible:** Clicking should either:
  - Download CSV file, OR
  - Show inline error message (not explode page)

**If Issues Found:**
```
❌ [ISSUE TYPE]: Description
   Location: /dashboard/analytics
   Component: [StatCard/ActivityItemCard/BuildStamp]
   Expected: [what should happen]
   Actual: [what actually happens]
```

---

### CHECK 3: OKRS PAGE (/dashboard/okrs)

**Steps:**
1. Navigate to `/dashboard/okrs`
2. Observe objective cards
3. Try to edit a locked/published OKR
4. Open Activity drawer for an objective

**Expected Results:**

**Header:**
- ✓ SectionHeader component visible
- ✓ **BLOCKER CHECK:** BuildStamp visible in top-right (inline variant)
- If BuildStamp missing → **BLOCKER**

**Objective Cards:**
- ✓ Each objective in neutral white card using design tokens:
  - `rounded-xl border border-neutral-200 bg-white p-4 shadow-sm`
- ✓ Status badge from shared `StatusBadge` component (not custom inline spans)
- ✓ Cards use consistent spacing and typography

**Lock Behavior:**
- ✓ Try to edit a locked/published OKR
- ✓ **SHOULD NOT** silently allow edit
- ✓ **SHOULD** show `PublishLockWarningModal` with neutral lock explanation
- ✓ Lock message comes from `useTenantPermissions().getLockInfoForObjective()`
- ✓ Message matches backend `OkrGovernanceService` rules

**Activity Drawer:**
- ✓ Click "History" or activity icon on an objective/key result
- ✓ Drawer opens without crashing
- ✓ Activity entries rendered using `ActivityItemCard` component
- ✓ **BLOCKER CHECK:** Bottom of drawer shows footer variant of BuildStamp
  - Format: `{version} • {env} • {sha}` (centered, smaller text)
- ✓ Proves `/api/activity/objectives/:id` and `/api/activity/key-results/:id` are wired

**If Issues Found:**
```
❌ [ISSUE TYPE]: Description
   Location: /dashboard/okrs
   Component: [ObjectiveCard/ActivityDrawer/BuildStamp]
   Expected: [what should happen]
   Actual: [what actually happens]
```

---

### CHECK 4: BUILDER PAGE (/dashboard/builder)

**Steps:**
1. Navigate to `/dashboard/builder`
2. Observe header and edit panel
3. Select a locked node (if available)
4. Observe ReactFlow canvas

**Expected Results:**

**Header:**
- ✓ SectionHeader component with title "Builder" and subtitle
- ✓ **BLOCKER CHECK:** BuildStamp visible in top-right (inline variant)
  - This was added in Phase 17A
- If BuildStamp missing → **BLOCKER**

**Edit Panel (Right Side):**
- ✓ Edit panel styled using same neutral card tokens as OKRs/Analytics:
  - `rounded-xl border border-neutral-200 bg-white p-4 shadow-sm`
- ✓ All inputs disabled (readOnly) if selected node is locked by cycle or publish state
- ✓ Neutral inline lock message shown if editing is blocked
- ✓ Lock message comes from `useTenantPermissions()` hook

**ReactFlow Canvas:**
- ✓ Canvas renders without crashing even if graph is empty
- ✓ No console errors about missing ReactFlow props
- ✓ Matches `builder.smoke.test.tsx` assumptions

**If Issues Found:**
```
❌ [ISSUE TYPE]: Description
   Location: /dashboard/builder
   Component: [SectionHeader/BuildStamp/EditPanel]
   Expected: [what should happen]
   Actual: [what actually happens]
```

---

### CHECK 5: AI DASHBOARD (/dashboard/ai)

**Steps:**
1. Navigate to `/dashboard/ai`
2. Observe page structure
3. Check browser console for errors

**Expected Results:**

**Header:**
- ✓ SectionHeader component with Beta-style badge
- ✓ **BLOCKER CHECK:** BuildStamp visible in top-right (inline variant)
- If BuildStamp missing → **BLOCKER**

**Page Structure:**
- ✓ "Insights generated for you" section:
  - Uses `ActivityItemCard` list (not inline bespoke markup)
- ✓ "Risk signals this week" section:
  - Uses `StatCard` grid (not inline divs)
- ✓ "Executive summary draft" section:
  - Uses neutral white card (`Card` component)
  - Not inline bespoke card markup

**Console Errors:**
- ✓ No React errors about missing props
- ✓ No undefined field errors
- ✓ Copy looks like plausible preview/advisory surface (not "TODO wire LLM")

**If Issues Found:**
```
❌ [ISSUE TYPE]: Description
   Location: /dashboard/ai
   Component: [ActivityItemCard/StatCard/Card/BuildStamp]
   Expected: [what should happen]
   Actual: [what actually happens]
```

---

### CHECK 6: BUILDSTAMP COVERAGE

**Explicit Verification Required:**

Verify BuildStamp appears in ALL of these locations:

1. ✓ Analytics header (`/dashboard/analytics`) - **INLINE VARIANT**
2. ✓ OKRs header (`/dashboard/okrs`) - **INLINE VARIANT**
3. ✓ Builder header (`/dashboard/builder`) - **INLINE VARIANT**
4. ✓ AI header (`/dashboard/ai`) - **INLINE VARIANT**
5. ✓ ActivityDrawer footer (when drawer is open) - **FOOTER VARIANT**

**Format Check:**
- Inline variant: Top-right, small monospace text, format `{version} • {env} • {sha}`
- Footer variant: Bottom center, very small text, format `{version} • {env} • {sha}`

**If ANY Missing:**
```
❌ BLOCKER: BuildStamp missing from [LOCATION]
   Expected: [inline/footer] variant visible
   Actual: Not visible
   Audit Script Check: Should be caught by pre-merge-audit.js Check 10/11
```

---

### CHECK 7: PERMISSIONS + ISOLATION CHECK

**As Normal Tenant User:**

1. **CSV Export:**
   - ✓ Navigate to `/dashboard/analytics`
   - ✓ CSV export button SHOULD NOT be visible
   - If visible → **Permissions breach**

2. **Lock Behavior:**
   - ✓ Navigate to `/dashboard/okrs`
   - ✓ Try to edit a locked/published OKR
   - ✓ SHOULD get `PublishLockWarningModal` (not silent rejection)
   - ✓ SHOULD NOT be able to edit freely

3. **Tenant Isolation:**
   - ✓ Confirm you see OKRs for your tenant
   - ✓ Confirm you DO NOT see data from other orgs
   - ✓ Check that objective IDs/names make sense for your tenant
   - If cross-tenant data visible → **Architecture breach**

**As Tenant Admin/Owner (Second Login if Available):**

1. **CSV Export:**
   - ✓ Navigate to `/dashboard/analytics`
   - ✓ CSV export button SHOULD be visible
   - ✓ Clicking should work (download or show error, not crash)

2. **Lock Behavior:**
   - ✓ Try to edit a locked/published OKR
   - ✓ SHOULD STILL get lock messaging (admin does not bypass publish lock unless `OkrGovernanceService` explicitly allows)
   - ✓ Proves frontend and backend permission logic are in sync

**If Issues Found:**
```
❌ [ISSUE TYPE]: Permissions/Isolation Problem
   Location: [page]
   User Role: [normal user/admin]
   Expected: [what should happen]
   Actual: [what actually happens]
   Severity: [visual polish / demo credibility / architecture breach]
```

---

## PHASE 5: DEMO DATA SANITY (DO NOT SKIP)

**Goal:** Prove we actually have presentable data in the environment before we go near a stakeholder.

**This prevents:** "empty dashboard", "0 objectives", "nothing to show".

**Run these checks in browser as the normal tenant user (NOT superuser):**

---

### [5.1] Analytics Page Content Check

**Steps:**
1. Go to `/dashboard/analytics`
2. Observe the StatCard values and activity feed

**Assert:**

- ✓ Total Objectives StatCard value > 0
  - If value is 0 → Note as potential demo risk

- ✓ "% On Track" StatCard does NOT show "0%" unless you KNOW that's correct for this tenant
  - If showing 0% and you know there are on-track objectives → Data issue

- ✓ Recent Activity section:
  - Either:
    - Shows at least 1 ActivityItemCard, OR
    - Shows the empty-state card with friendly copy (bordered neutral card), not a console error
  - If showing console error or crash → Blocker

**If ALL 3 are "empty" (0 objectives, 0% on track, and empty feed):**
```
⚠️ DEMO RISK: ANALYTICS HAS NO SIGNAL
   Location: /dashboard/analytics
   Issue: All metrics show zero/empty
   Impact: Dashboard looks broken/unused
   Action: Either seed test data or mark as "DO NOT DEMO"
```

---

### [5.2] OKRs Page Content Check

**Steps:**
1. Go to `/dashboard/okrs`
2. Observe objective cards
3. Click "View activity" on an objective
4. Try to edit a locked objective

**Assert:**

- ✓ At least one ObjectiveCard renders
  - If no cards render → Check if tenant has objectives

- ✓ Each ObjectiveCard shows:
  - Title (not empty/null)
  - StatusBadge (On Track / At Risk / Off Track)
  - Progress % (not NaN or undefined)

- ✓ Clicking "View activity" (or equivalent) opens ActivityDrawer and:
  - Drawer renders at least one ActivityItemCard, OR
  - Shows the neutral "No recent activity." empty state inside the drawer
  - If drawer crashes → Blocker

- ✓ PublishLockWarningModal:
  - Trigger an edit on a locked objective
  - Modal appears with a human sentence about why it's locked (publish/cycle), not just "Forbidden"
  - If modal shows "Forbidden" or empty message → Needs fix

**If page is technically fine but visually barren (one empty objective called 'Test'):**
```
⚠️ DEMO RISK: OKR CONTENT NOT CREDIBLE
   Location: /dashboard/okrs
   Issue: Content exists but not executive-ready
   Impact: Looks like test data, not real usage
   Action: Either populate with realistic data or mark as "DO NOT DEMO"
```

---

### [5.3] Builder Content Check

**Steps:**
1. Go to `/dashboard/builder`
2. Observe ReactFlow canvas and right-hand panel
3. Select a node (if available)
4. Try to edit a locked node (if available)

**Assert:**

- ✓ ReactFlow canvas is visible (grey/white canvas with nodes or empty canvas, but it renders)
  - If canvas is blank/white without any UI → Blocker

- ✓ Right-hand inspector panel is visible in a bordered white card
  - Panel should show form fields or a message, not completely blank

- ✓ If the inspector panel is readOnly because of lock:
  - The neutral lock messaging shows
  - Controls are visibly disabled (not just hidden)

**If the builder loads but the right-hand panel is completely blank (no form, no message):**
```
⚠️ DEMO RISK: BUILDER SIDE PANEL EMPTY
   Location: /dashboard/builder
   Issue: Right-hand panel renders but shows nothing
   Impact: Builder appears broken
   Action: Fix panel rendering or mark as "DO NOT DEMO"
```

---

### [5.4] AI Dashboard Content Check

**Steps:**
1. Go to `/dashboard/ai`
2. Observe all three sections
3. Check console for errors

**Assert:**

- ✓ "Insights generated for you" shows:
  - At least 1 ActivityItemCard, OR
  - A neutral empty-state card (not console error)

- ✓ "Risk signals this week" shows:
  - 2+ StatCard metrics with values (not placeholders like "TBD" or "—")
  - If all show "—" or "No data available" → Note as demo risk

- ✓ "Executive summary draft" card contains:
  - Full-sentence narrative text (not "TODO wire LLM" or lorem ipsum)
  - If text is clearly placeholder → Mark as demo risk

**If the entire AI dashboard is clearly placeholder / lorem ("coming soon", "LLM goes here"):**
```
⚠️ DEMO RISK: AI DASHBOARD NOT EXECUTIVE SAFE
   Location: /dashboard/ai
   Issue: Content is clearly placeholder/not real
   Impact: Executives will see it's not production-ready
   Action: Either wire real LLM or mark as "DO NOT DEMO"
```

---

### Phase 5 Summary

**For each DEMO RISK identified:**
- Include screenshot reference when pasting PHASE 4 report into Slack / PR
- Mark severity: High (blocks demo) / Medium (hurts credibility) / Low (minor polish)

**If we have ANY DEMO RISK flagged as "EXECUTIVE SAFE = NO":**
- We can still test functionally
- We DO NOT demo to stakeholders like that
- Must fix before booking live time

---

## PHASE 6: CLEAN TEARDOWN (AFTER TESTING)

**Goal:** Leave the machine clean so the next run starts from a known baseline and we don't have zombie ports.

**After you've done PHASE 0–5:**

---

### [6.1] Stop Frontend Dev Server

```bash
# Stop web app (Ctrl+C equivalent)
kill $WEB_PID 2>/dev/null || echo "Web app PID not found or already stopped"

# Verify port 5173 is free
lsof -i :5173 || echo "Port 5173 is free"
```

**Expected:**
- Web app process killed
- Port 5173 no longer listening

---

### [6.2] Stop API Gateway and Core API

```bash
# Stop API Gateway
kill $GATEWAY_PID 2>/dev/null || echo "API Gateway PID not found or already stopped"

# Stop Core API
kill $CORE_API_PID 2>/dev/null || echo "Core API PID not found or already stopped"

# Verify ports are free
lsof -i :3000 || echo "Port 3000 is free"
lsof -i :3001 || echo "Port 3001 is free"
```

**Expected:**
- Both processes killed
- Ports 3000 and 3001 no longer listening

---

### [6.3] Shut Down Infra Containers

```bash
# Stop and remove all Docker containers
docker compose down

# Verify containers are stopped
docker ps --filter "name=okr-nexus" --format "table {{.Names}}\t{{.Status}}"
```

**Expected:**
- Containers for db/redis/keycloak/etc. are stopped and removed
- No orphan containers should remain
- Empty list or only stopped containers shown

---

### [6.4] Kill Any Leftover Node Processes

```bash
# Kill any remaining Node processes (just in case)
pkill -f node || true

# Verify no Node processes running
ps aux | grep node | grep -v grep || echo "No Node processes running"
```

**Expected:**
- Command exits 0 or with "no processes matched", both acceptable
- No Node processes listed (or only grep itself)

---

### [6.5] Git Status Snapshot

```bash
# Check for uncommitted changes
git status

# If there are diffs, either stash or commit them
# (Only if you intentionally tweaked env or config)
```

**Expected:**
- No uncommitted changes unless you intentionally tweaked env or config
- If there are diffs, either stash them or commit them before next run

---

### Teardown Confirmation

**After completing all teardown steps:**
- All processes stopped: ✓
- All ports free: ✓
- Docker containers down: ✓
- Git status clean: ✓

**Append to PHASE 4 report:**
```
TEARDOWN COMPLETE: local env returned to clean state, ready for next validation run.
```

**This teardown is mandatory after every validation run.**

---

## PHASE 4: REPORT FINDINGS

After completing all checks above, generate this structured report:

---

### 1. READY FOR DEMO

**List surfaces/pages/features that meet expectations:**

- [ ] Analytics page (`/dashboard/analytics`)
  - BuildStamp: ✓ / ✗
  - StatCard components: ✓ / ✗
  - CSV export (admin): ✓ / ✗
  - Activity feed: ✓ / ✗

- [ ] OKRs page (`/dashboard/okrs`)
  - BuildStamp: ✓ / ✗
  - ObjectiveCard components: ✓ / ✗
  - Lock messaging: ✓ / ✗
  - Activity drawer: ✓ / ✗

- [ ] Builder page (`/dashboard/builder`)
  - BuildStamp: ✓ / ✗
  - SectionHeader: ✓ / ✗
  - Edit panel styling: ✓ / ✗
  - Lock behavior: ✓ / ✗

- [ ] AI Dashboard (`/dashboard/ai`)
  - BuildStamp: ✓ / ✗
  - Component usage: ✓ / ✗
  - No console errors: ✓ / ✗

- [ ] BuildStamp Coverage
  - Analytics header: ✓ / ✗
  - OKRs header: ✓ / ✗
  - Builder header: ✓ / ✗
  - AI header: ✓ / ✗
  - ActivityDrawer footer: ✓ / ✗

- [ ] Permissions & Isolation
  - CSV export hidden (non-admin): ✓ / ✗
  - Lock messaging works: ✓ / ✗
  - Tenant isolation: ✓ / ✗

---

### 2. NEEDS FIX BEFORE DEMO

**List anything that visually or behaviorally undercuts credibility:**

**Example Format:**
```
❌ NEEDS FIX: [Issue Description]
   Location: /dashboard/[page]
   Impact: [Why this hurts demo credibility]
   Priority: [High/Medium/Low]
   Steps to Reproduce: [how to see the issue]
```

**Common Issues to Check:**
- NaN% or undefined values in metrics
- Unstyled divs (not using design tokens)
- Missing lock messaging
- CSV button visible to wrong persona
- Activity drawer crash
- BuildStamp missing (if not already blocker)
- Console errors visible to users

---

### 3. ARCHITECTURE BREACH (DO NOT MERGE)

**List anything that violates Phases 1-15 contract:**

**Example Format:**
```
🚨 ARCHITECTURE BREACH: [Violation Description]
   Location: [file/endpoint/page]
   Contract Violated: [which phase/rule]
   Evidence: [what proves the violation]
   Fix Required: [what must be fixed]
```

**Common Breaches to Check:**
- Tenant isolation not enforced through `OkrTenantGuard`
- Governance not enforced through `OkrGovernanceService`
- Reporting endpoints not under `/reports/*` (404s)
- Activity timeline not under `/activity/*` (404s)
- Pages missing BuildStamp where mandatory
- Pages bypassing `useTenantPermissions`
- Custom lock logic instead of `useTenantPermissions().getLockInfoForObjective()`

---

### 4. DEMO CONTENT RISK

**List any risk notes captured in PHASE 5:**

**Example Format:**
```
⚠️ DEMO RISK: [Risk Description]
   Location: /dashboard/[page]
   Severity: [High/Medium/Low]
   Impact: [Why this blocks or hurts demo]
   Screenshot: [reference if captured]
   Action Required: [what must be fixed before demo]
```

**Common Demo Risks:**
- Analytics has no signal (all zeros/empty)
- OKR content not credible (test data visible)
- Builder side panel empty
- AI dashboard not executive safe (placeholder content)

**If ANY DEMO RISK is flagged as "EXECUTIVE SAFE = NO":**
- Mark status as "DO NOT DEMO TO STAKEHOLDERS"
- This becomes part of the go/no-go call before booking live time

---

### 5. TEARDOWN STATUS

**After completing PHASE 6, append:**
```
TEARDOWN COMPLETE: local env returned to clean state, ready for next validation run.
```

---

## QUICK REFERENCE: Expected URLs and Ports

- **Frontend:** http://localhost:5173
- **API Gateway:** http://localhost:3000
- **Core API:** http://localhost:3001
- **Keycloak:** http://localhost:8080
- **Postgres:** localhost:5432
- **Redis:** localhost:6379

---

## ENFORCEMENT NOTES FOR CURSOR AGENT

**You MUST:**

• Keep PHASE 0–6 in RELEASE_VALIDATION_SCRIPT.md, in this exact order.

• NOT silently "optimise" or merge steps. Explicit is non-negotiable.

• Regenerate RELEASE_VALIDATION_SCRIPT.md in-place, not create a new file.

• Every future change to the platform (new surface / new page / new demo flow) MUST add:
  - BuildStamp location check
  - Permission and lock checks
  - Demo signal / content credibility check

• Refuse to mark us "ready to show" if Phase 5 produces ANY DEMO RISK flagged as "EXECUTIVE SAFE = NO".

• Ensure Phase 6 teardown is always documented and executed after every validation run.

• Treat missing BuildStamp as a BLOCKER (not just a warning).

• Treat demo content risks as blockers for stakeholder demos (even if functionality works).

---

**END OF VALIDATION SCRIPT**

