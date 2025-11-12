/**
 * Debug utility to decode and inspect JWT tokens
 * 
 * Usage in browser console:
 * import { decodeJWT, logTokenInfo } from '@/lib/jwt-debug'
 * logTokenInfo()
 */

export function decodeJWT(token: string) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format')
    }

    // Decode the payload (second part)
    const payload = parts[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    
    return decoded
  } catch (error) {
    console.error('Failed to decode JWT:', error)
    return null
  }
}

export function logTokenInfo() {
  if (typeof window === 'undefined') {
    console.log('This function only works in the browser')
    return
  }

  const token = localStorage.getItem('access_token')
  if (!token) {
    console.log('❌ No access token found in localStorage')
    return
  }

  console.log('🔍 JWT Token Info:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const decoded = decodeJWT(token)
  if (decoded) {
    console.log('📋 Payload:', decoded)
    console.log('')
    console.log('Key fields:')
    console.log(`  - User ID (sub): ${decoded.sub}`)
    console.log(`  - Email: ${decoded.email || 'N/A'}`)
    console.log(`  - Name: ${decoded.name || 'N/A'}`)
    console.log(`  - Organization ID: ${decoded.organizationId || 'NOT SET ❌'}`)
    console.log(`  - Expires: ${decoded.exp ? new Date(decoded.exp * 1000).toLocaleString() : 'N/A'}`)
    console.log(`  - Issued: ${decoded.iat ? new Date(decoded.iat * 1000).toLocaleString() : 'N/A'}`)
  } else {
    console.log('❌ Failed to decode token')
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}







