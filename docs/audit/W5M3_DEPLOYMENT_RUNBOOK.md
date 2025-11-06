# W5.M3 Production Deployment Runbook

**Generated:** 2025-01-XX  
**Scope:** Web app production build, version stamping, and deployment verification  
**Build Tool:** Next.js 14.2.33

---

## 1. Detected Build + Deploy Configuration

### Build Tool
- **Framework:** Next.js 14.2.33
- **Build Command:** `npm run build` (in `apps/web`)
- **Root Build Command:** `npm run build:web` (from root)

### Deployment Mechanism
- **Primary:** Docker-based deployment (`apps/web/Dockerfile`)
- **Docker Compose:** `docker-compose.yml` includes `web` service
- **No CI/CD workflows detected:** No `.github/workflows/*.yml` found
- **No Vercel/Netlify configs:** No `vercel.json` or `netlify.toml` found

### Environment Files
- **No `.env` files found** in `apps/web/`
- **Production env vars:** Set via Docker environment variables or `docker-compose.yml`
- **Example template:** `.env.production.example` created for reference

---

## 2. Version Stamping Implementation

### Build-Time Version Injection

**Files Created:**
- `apps/web/scripts/resolve_backend_tag.ts` - Fetches backend git tag from `/system/status`
- `apps/web/scripts/generate_version_json.ts` - Generates `public/version.json` with version info
- `apps/web/src/utils/version.ts` - Runtime utility to access version info
- `apps/web/src/components/VersionLogger.tsx` - Logs version to console on app load

**Build Process:**
1. `prebuild` script runs before `next build`
2. `resolve:backend-tag` fetches backend git tag from `/system/status` endpoint
3. `generate:version` creates `public/version.json` with:
   - `appVersion`: Short git SHA (`git rev-parse --short HEAD`)
   - `buildTimestamp`: ISO timestamp
   - `backendGitTag`: Value from backend `/system/status` (or `null` if unavailable)

**Version.json Template:**
```json
{
  "appVersion": "fab3926",
  "buildTimestamp": "2025-01-XXT...",
  "backendGitTag": "v1.2.3" // or null
}
```

---

## 3. Feature Flags Sanity Check

### Environment Variables for OKR Screen Features

**Current Status:** No feature flags found in codebase. All W5 features are enabled by default.

**Recommended Variables** (documented in `.env.production.example`):
- `NEXT_PUBLIC_INSIGHTS_ENABLED=true` (default: enabled)
- `NEXT_PUBLIC_ATTENTION_ENABLED=true` (default: enabled)
- `NEXT_PUBLIC_COMPOSITE_CREATION_ENABLED=true` (default: enabled)

**Note:** These flags are not currently implemented in the codebase. They are documented for future use if feature toggling is needed.

---

## 4. Build & Deploy Commands

### Clean Build (from root)
```bash
# Clean build artifacts
cd apps/web
rm -rf .next node_modules
cd ../..

# Install dependencies
npm install

# Build web app only
npm run build:web

# Or build from apps/web directory
cd apps/web
npm run build
```

### Docker Build & Deploy
```bash
# Build Docker image
docker build -f apps/web/Dockerfile -t okr-nexus-web:latest .

# Or via docker-compose
docker-compose build web

# Deploy via docker-compose
docker-compose up -d web

# Check logs
docker-compose logs -f web
```

### Build Output
- **Next.js build:** `apps/web/.next/` directory
- **Static assets:** `apps/web/.next/static/` (hashed filenames for cache-busting)
- **Version file:** `apps/web/public/version.json` (accessible at `/version.json`)

---

## 5. CDN Purge (Optional)

**CDN Configuration:** Not detected (no Cloudflare/Vercel/Netlify configs found)

**Status:** CDN not detected – skip purge

**Note:** If using a CDN in front of Docker deployment:
- Purge cache for `/_next/static/*` paths
- Purge cache for `/dashboard/okrs` route
- Purge cache for `/version.json`

---

## 6. Validation Checklist

### Automated Validation

**Run verification script:**
```bash
cd apps/web
npm run verify:okrs

# Or with custom base URL
BASE_URL=https://app.okr-nexus.com npm run verify:okrs
```

**Verification script checks:**
- ✅ Backend `/system/status` endpoint accessible
- ✅ Frontend `/version.json` accessible
- ✅ OKR overview endpoint structure (requires auth for full validation)
- ✅ No deprecated `period` fields in response
- ✅ Required fields present (`publishState`, `visibilityLevel`)

### Manual Validation Steps

1. **Hard refresh browser:**
   - Chrome/Edge: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Firefox: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)

2. **Verify version stamping:**
   - Open DevTools → Console
   - Look for: `[Version] Build Information:` log
   - Should show: `appVersion`, `buildTimestamp`, `backendGitTag`

3. **Confirm OKR screen features:**
   - ✅ No "Period" selectors (only Cycle selector)
   - ✅ Status + Publish chips separated and styled correctly
   - ✅ "Needs attention" button present and opens drawer
   - ✅ Inline Insight Bars appear when scrolling to objectives
   - ✅ "New Objective" button visible only when user has permission

4. **Check accessibility:**
   - ✅ Keyboard navigation works (Tab, Enter, Esc)
   - ✅ Focus rings visible on interactive elements
   - ✅ Screen reader announces landmarks and labels

5. **Verify performance:**
   - Open DevTools → Performance tab
   - Record page load: first render should be < 150ms
   - Scroll list: check for long tasks (> 50ms)

---

## 7. Deliverables Summary

### Files Created

**Scripts:**
- `apps/web/scripts/resolve_backend_tag.ts` - Backend tag resolver
- `apps/web/scripts/generate_version_json.ts` - Version.json generator
- `apps/web/scripts/verify_okrs_screen.ts` - Deployment verification script

**Utilities:**
- `apps/web/src/utils/version.ts` - Version info getter
- `apps/web/src/components/VersionLogger.tsx` - Console logger component

**Configuration:**
- `apps/web/.env.production.example` - Environment variables template

**Modified:**
- `apps/web/package.json` - Added build scripts (`prebuild`, `resolve:backend-tag`, `generate:version`, `verify:okrs`)
- `apps/web/next.config.js` - Added rewrites for version.json
- `apps/web/src/app/layout.tsx` - Added VersionLogger component

### Build Commands

**From root:**
```bash
npm run build:web
```

**From apps/web:**
```bash
npm run build
```

### Deploy Commands

**Docker:**
```bash
docker-compose build web
docker-compose up -d web
```

**Standalone Docker:**
```bash
docker build -f apps/web/Dockerfile -t okr-nexus-web:latest .
docker run -p 5173:5173 -e NEXT_PUBLIC_API_URL=https://api.okr-nexus.com okr-nexus-web:latest
```

### Verification Command

```bash
cd apps/web
npm run verify:okrs

# Or with pnpm from root
pnpm --filter apps/web run verify:okrs
```

---

## 8. Release Notes Snippet

```markdown
### W5.M3 Production Deployment

**Build Information:**
- App Version: [Git SHA from version.json]
- Build Timestamp: [ISO timestamp]
- Backend Git Tag: [From backend /system/status]

**Deployment Steps:**
1. Build: `npm run build:web`
2. Deploy: `docker-compose up -d web`
3. Verify: `npm run verify:okrs` (from apps/web)

**Features Deployed:**
- Inline insights and cycle health (W5.M2)
- UX polish, performance budgets, accessibility (W5.M3)
- Composite OKR creation flow (W5.M1)

**Validation:**
- Hard refresh browser (Cmd+Shift+R)
- Check DevTools console for version stamp
- Verify OKR screen features listed above
```

---

## 9. Troubleshooting

**Issue:** `version.json` not found
- **Solution:** Ensure `prebuild` script runs before `next build`
- **Check:** `apps/web/public/version.json` exists after build

**Issue:** Backend tag is `null`
- **Solution:** Ensure backend is running and `/system/status` is accessible
- **Check:** `NEXT_PUBLIC_API_URL` is set correctly in build environment

**Issue:** Build fails with `ts-node` not found
- **Solution:** Install dev dependencies: `npm install` (from root)
- **Check:** `ts-node` is in `devDependencies` of root `package.json`

**Issue:** Verification script fails with auth errors
- **Solution:** Expected for `/okr/overview` endpoint (requires auth)
- **Workaround:** Run manual validation steps instead

---

**Status:** ✅ Ready for production deployment

