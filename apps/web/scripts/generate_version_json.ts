/**
 * Build-time script to generate version.json
 * 
 * Generates apps/web/public/version.json with:
 * - appVersion: short git SHA
 * - buildTimestamp: ISO timestamp
 * - backendGitTag: value from backend /system/status (if available)
 */

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
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

