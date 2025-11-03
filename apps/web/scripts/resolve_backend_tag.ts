/**
 * Resolves backend git tag from /system/status endpoint
 * 
 * Called during build process to fetch backend version information
 * and write it to a file for inclusion in version.json
 */

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
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

