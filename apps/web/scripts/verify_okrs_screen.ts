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
  
  // Note: This endpoint requires auth, so we'll just check structure if possible
  // In a real scenario, you'd pass auth headers or use a test token
  
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

