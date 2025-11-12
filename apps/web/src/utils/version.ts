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

