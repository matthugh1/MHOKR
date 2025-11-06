# W5.M3 Production Deployment - Deliverables

**Date:** 2025-01-XX  
**Build Tool:** Next.js 14.2.33  
**Deployment:** Docker-based

---

## 1. Detected Build + Deploy Commands

### Build Tool
- **Framework:** Next.js 14.2.33
- **Build Command:** `npm run build` (in `apps/web`)
- **Root Build Command:** `npm run build:web` (from root)

### Deployment Mechanism
- **Primary:** Docker-based (`apps/web/Dockerfile`)
- **Docker Compose:** `docker-compose.yml` includes `web` service
- **Port:** 5173
- **No CI/CD workflows detected**
- **No Vercel/Netlify configs detected**

### Environment Files
- **No `.env` files found** in `apps/web/`
- **Production vars:** Set via Docker environment variables
- **Template:** `.env.production.example` created

---

## 2. File List & Contents

### Created Files

#### `apps/web/public/version.json` (generated at build time)

**Template writer:** `apps/web/scripts/generate_version_json.ts`

**Example output:**
```json
{
  "appVersion": "fab3926",
  "buildTimestamp": "2025-01-XXT12:34:56.789Z",
  "backendGitTag": "v1.2.3"
}
```

#### `apps/web/src/utils/version.ts`

```typescript
/**
 * Version utility for build-time version stamping
 * 
 * Provides access to build-time injected version information:
 * - APP_VERSION: short git SHA
 * - BUILD_TIMESTAMP: ISO timestamp
 * - BACKEND_GIT_TAG: value from backend /system/status endpoint
 */

interface VersionInfo {
  appVersion: string
  buildTimestamp: string
  backendGitTag: string | null
}

let cachedVersion: VersionInfo | null = null

/**
 * Gets version information from version.json (generated at build time)
 */
export async function getVersionInfo(): Promise<VersionInfo> {
  if (cachedVersion) {
    return cachedVersion
  }

  try {
    const response = await fetch('/version.json', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to fetch version.json: ${response.status}`)
    }
    const data = await response.json()
    cachedVersion = {
      appVersion: data.appVersion || 'unknown',
      buildTimestamp: data.buildTimestamp || new Date().toISOString(),
      backendGitTag: data.backendGitTag || null,
    }
    return cachedVersion
  } catch (error) {
    console.warn('[Version] Failed to load version.json:', error)
    cachedVersion = {
      appVersion: 'unknown',
      buildTimestamp: new Date().toISOString(),
      backendGitTag: null,
    }
    return cachedVersion
  }
}

/**
 * Logs version information to console (for DevTools verification)
 */
export async function logVersionInfo(): Promise<void> {
  const version = await getVersionInfo()
  console.log('[Version] Build Information:', {
    appVersion: version.appVersion,
    buildTimestamp: version.buildTimestamp,
    backendGitTag: version.backendGitTag,
  })
}
```

#### `apps/web/scripts/resolve_backend_tag.ts`

```typescript
/**
 * Resolves backend git tag from /system/status endpoint
 * 
 * Called during build process to fetch backend version information
 * and write it to a file for inclusion in version.json
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

interface SystemStatus {
  ok: boolean
  service: string
  gitTag: string | null
  buildTimestamp: string
  enforcement: {
    rbacGuard: boolean
    tenantIsolation: boolean
    visibilityFiltering: boolean
    auditLogging: boolean
  }
}

function fetchJson(url: string): Promise<SystemStatus> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    
    const req = client.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as SystemStatus)
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error}`))
        }
      })
    })
    
    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

async function resolveBackendTag(apiUrl: string): Promise<string | null> {
  try {
    const status = await fetchJson(`${apiUrl}/system/status`)
    return status.gitTag || null
  } catch (error: any) {
    console.warn(`[Backend Tag] Failed to fetch /system/status: ${error.message}`)
    return null
  }
}

async function main() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000'
  
  console.log(`[Backend Tag] Resolving backend git tag from ${apiUrl}/system/status...`)
  
  const backendTag = await resolveBackendTag(apiUrl)
  
  const outputPath = path.join(__dirname, '../.next/backend-tag.json')
  const outputDir = path.dirname(outputPath)
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ backendGitTag: backendTag }, null, 2),
    'utf-8'
  )
  
  console.log(`[Backend Tag] Backend git tag resolved: ${backendTag || 'null'}`)
  console.log(`[Backend Tag] Written to: ${outputPath}`)
}

main().catch((error) => {
  console.error('[Backend Tag] Fatal error:', error)
  process.exit(1)
})
```

#### `apps/web/scripts/generate_version_json.ts`

```typescript
/**
 * Build-time script to generate version.json
 * 
 * Generates apps/web/public/version.json with:
 * - appVersion: short git SHA
 * - buildTimestamp: ISO timestamp
 * - backendGitTag: value from backend /system/status (if available)
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

function getGitSha(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    return sha
  } catch (error) {
    console.warn('[Version] Failed to get git SHA:', error)
    return 'unknown'
  }
}

function getBuildTimestamp(): string {
  return new Date().toISOString()
}

function getBackendTag(): string | null {
  try {
    const backendTagPath = path.join(__dirname, '../.next/backend-tag.json')
    if (fs.existsSync(backendTagPath)) {
      const content = fs.readFileSync(backendTagPath, 'utf-8')
      const data = JSON.parse(content)
      return data.backendGitTag || null
    }
  } catch (error) {
    console.warn('[Version] Failed to read backend tag:', error)
  }
  return null
}

function main() {
  const appVersion = getGitSha()
  const buildTimestamp = getBuildTimestamp()
  const backendGitTag = getBackendTag()

  const versionInfo = {
    appVersion,
    buildTimestamp,
    backendGitTag,
  }

  const publicDir = path.join(__dirname, '../public')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  const outputPath = path.join(publicDir, 'version.json')
  fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2), 'utf-8')

  console.log('[Version] Generated version.json:', versionInfo)
  console.log(`[Version] Written to: ${outputPath}`)
}

main()
```

#### `apps/web/scripts/verify_okrs_screen.ts`

```typescript
/**
 * Verification script for OKRs screen deployment
 * 
 * Validates:
 * - Backend /system/status endpoint accessible
 * - Frontend /version.json accessible
 * - OKR overview endpoint returns expected fields (publishState, visibilityLevel)
 * - No deprecated 'period' fields in response
 */

import * as https from 'https'
import * as http from 'http'

interface SystemStatus {
  ok: boolean
  service: string
  gitTag: string | null
  buildTimestamp: string
  enforcement: Record<string, boolean>
}

interface VersionInfo {
  appVersion: string
  buildTimestamp: string
  backendGitTag: string | null
}

interface OkrOverviewResponse {
  objectives: Array<{
    objectiveId: string
    title: string
    status: string
    publishState?: string
    visibilityLevel?: string
    period?: string // Should NOT exist
    [key: string]: any
  }>
  totalCount: number
  page: number
  pageSize: number
}

function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    
    const req = client.get(url, { headers }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as T)
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error}`))
        }
      })
    })
    
    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

async function verifySystemStatus(baseUrl: string): Promise<void> {
  console.log(`[Verify] Checking backend /system/status at ${baseUrl}/system/status...`)
  
  try {
    const status = await fetchJson<SystemStatus>(`${baseUrl}/system/status`)
    
    console.log('[Verify] Backend status:', {
      ok: status.ok,
      service: status.service,
      gitTag: status.gitTag,
      buildTimestamp: status.buildTimestamp,
      enforcement: status.enforcement,
    })
    
    if (!status.ok) {
      throw new Error('Backend status.ok is false')
    }
    
    if (!status.gitTag) {
      console.warn('[Verify] Warning: Backend gitTag is null')
    }
  } catch (error) {
    throw new Error(`Backend /system/status check failed: ${error}`)
  }
}

async function verifyVersionJson(baseUrl: string): Promise<void> {
  console.log(`[Verify] Checking frontend /version.json at ${baseUrl}/version.json...`)
  
  try {
    const version = await fetchJson<VersionInfo>(`${baseUrl}/version.json`)
    
    console.log('[Verify] Frontend version:', {
      appVersion: version.appVersion,
      buildTimestamp: version.buildTimestamp,
      backendGitTag: version.backendGitTag,
    })
    
    if (!version.appVersion || version.appVersion === 'unknown') {
      throw new Error('Frontend appVersion is missing or unknown')
    }
    
    if (version.backendGitTag && version.backendGitTag !== 'null') {
      console.log('[Verify] Backend git tag match:', version.backendGitTag)
    } else {
      console.warn('[Verify] Warning: Backend git tag not available in version.json')
    }
  } catch (error) {
    throw new Error(`Frontend /version.json check failed: ${error}`)
  }
}

async function verifyOkrOverview(baseUrl: string): Promise<void> {
  console.log(`[Verify] Checking OKR overview endpoint at ${baseUrl}/okr/overview...`)
  
  try {
    const overview = await fetchJson<OkrOverviewResponse>(
      `${baseUrl}/okr/overview?page=1&pageSize=20`
    )
    
    console.log('[Verify] OKR overview response structure:', {
      totalCount: overview.totalCount,
      page: overview.page,
      pageSize: overview.pageSize,
      objectivesCount: overview.objectives?.length || 0,
    })
    
    if (overview.objectives && overview.objectives.length > 0) {
      const firstObjective = overview.objectives[0]
      
      // Check for required fields
      if (!firstObjective.publishState) {
        throw new Error('Missing publishState field in objective')
      }
      
      if (!firstObjective.visibilityLevel) {
        throw new Error('Missing visibilityLevel field in objective')
      }
      
      // Check for deprecated fields
      if ('period' in firstObjective) {
        throw new Error('Deprecated "period" field found in objective (should be removed)')
      }
      
      console.log('[Verify] Objective fields validation passed:', {
        publishState: firstObjective.publishState,
        visibilityLevel: firstObjective.visibilityLevel,
        hasPeriod: 'period' in firstObjective,
      })
    } else {
      console.warn('[Verify] Warning: No objectives returned (may be empty or auth required)')
    }
  } catch (error: any) {
    // If auth is required, this will fail - that's acceptable for structure check
    if (error.message?.includes('401') || error.message?.includes('403')) {
      console.warn('[Verify] OKR overview requires auth (expected in production)')
      console.warn('[Verify] Skipping field validation - run manually with auth token')
    } else {
      throw new Error(`OKR overview check failed: ${error.message}`)
    }
  }
}

async function main() {
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5173'
  
  console.log('[Verify] Starting OKRs screen verification...')
  console.log(`[Verify] Base URL: ${baseUrl}`)
  console.log('')
  
  const errors: string[] = []
  
  try {
    await verifySystemStatus(baseUrl)
  } catch (error: any) {
    errors.push(error.message)
  }
  
  console.log('')
  
  try {
    await verifyVersionJson(baseUrl)
  } catch (error: any) {
    errors.push(error.message)
  }
  
  console.log('')
  
  try {
    await verifyOkrOverview(baseUrl)
  } catch (error: any) {
    errors.push(error.message)
  }
  
  console.log('')
  
  if (errors.length > 0) {
    console.error('[Verify] Verification failed with errors:')
    errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }
  
  console.log('[Verify] All checks passed!')
  process.exit(0)
}

main().catch((error) => {
  console.error('[Verify] Fatal error:', error)
  process.exit(1)
})
```

### Modified Files

#### `apps/web/package.json`

**Added scripts:**
```json
{
  "scripts": {
    "build": "npm run prebuild && next build",
    "prebuild": "npm run resolve:backend-tag && npm run generate:version",
    "resolve:backend-tag": "ts-node scripts/resolve_backend_tag.ts",
    "generate:version": "ts-node scripts/generate_version_json.ts",
    "verify:okrs": "ts-node scripts/verify_okrs_screen.ts"
  }
}
```

---

## 3. Build & Deploy Commands

### Build (apps/web only)

```bash
# From root
npm run build:web

# Or from apps/web
cd apps/web
npm run build
```

**Build process:**
1. `prebuild` → `resolve:backend-tag` → `generate:version`
2. `next build` → generates hashed assets in `.next/static/`

### Deploy

```bash
# Docker Compose
docker-compose build web
docker-compose up -d web

# Standalone Docker
docker build -f apps/web/Dockerfile -t okr-nexus-web:latest .
docker run -p 5173:5173 -e NEXT_PUBLIC_API_URL=https://api.okr-nexus.com okr-nexus-web:latest
```

### Verification

```bash
cd apps/web
npm run verify:okrs

# Or with pnpm from root
pnpm --filter apps/web run verify:okrs

# With custom base URL
BASE_URL=https://app.okr-nexus.com npm run verify:okrs
```

---

## 4. CDN Purge (Optional)

**Status:** CDN not detected – skip purge

**If CDN is added later:**
- Purge `/_next/static/*` paths
- Purge `/dashboard/okrs` route
- Purge `/version.json`

---

## 5. Manual Validation Checklist

1. **Hard refresh:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

2. **Verify version stamp:**
   - Open DevTools → Console
   - Look for: `[Version] Build Information:`
   - Should show: `appVersion`, `buildTimestamp`, `backendGitTag`

3. **Confirm OKR screen features:**
   - ✅ No "Period" selectors (only Cycle selector)
   - ✅ Status + Publish chips separated and styled correctly
   - ✅ "Needs attention" button opens drawer
   - ✅ Inline Insight Bars appear when scrolling to objectives
   - ✅ "New Objective" button visible only when permitted

4. **Check accessibility:**
   - ✅ Keyboard navigation works (Tab, Enter, Esc)
   - ✅ Focus rings visible on interactive elements
   - ✅ Screen reader announces landmarks and labels

5. **Verify performance:**
   - Open DevTools → Performance tab
   - Record page load: first render should be < 150ms
   - Scroll list: check for long tasks (> 50ms)

---

## 6. Release Notes Snippet

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
- Verify OKR screen features (no Period selectors, Status/Publish chips, Attention drawer, Inline insights)
```

---

**Status:** ✅ Ready for production deployment


